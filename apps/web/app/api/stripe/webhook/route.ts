import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Fulfillment is driven from here, never from the success page. Handles both
// synchronous card payments and delayed-notification methods (ACH later):
// completed + async_payment_succeeded, gated on payment_status.
export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "no signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }

  const sql = db();

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status === "unpaid") break; // async method still pending

      const bookingId = session.metadata?.booking_id;
      const kind = session.metadata?.kind;
      if (!bookingId) break;

      const pi =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id ?? null;

      await sql`
        update payments set status = 'captured',
               stripe_payment_intent = coalesce(${pi}, stripe_payment_intent)
        where booking_id = ${bookingId}
          and stripe_payment_intent = ${session.id}
          and status = 'pending'
      `;

      const target = kind === "deposit" ? "deposit_paid" : "paid_in_full";
      // Forward-only guard: never move a cancelled/completed booking.
      await sql`
        update bookings set status = ${target}
        where id = ${bookingId}
          and status in ('contract_signed', 'deposit_paid')
      `;
      break;
    }

    case "checkout.session.async_payment_failed": {
      const session = event.data.object as Stripe.Checkout.Session;
      await sql`
        update payments set status = 'failed'
        where stripe_payment_intent = ${session.id} and status = 'pending'
      `;
      break;
    }

    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const pi =
        typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : charge.payment_intent?.id;
      if (!pi) break;
      if (charge.refunded) {
        await sql`
          update payments set status = 'refunded'
          where stripe_payment_intent = ${pi} and status = 'captured'
        `;
        // If every captured payment is refunded, the booking becomes refunded.
        const bookingId = charge.metadata?.booking_id;
        if (bookingId) {
          await sql`
            update bookings set status = 'refunded'
            where id = ${bookingId} and status = 'cancelled'
              and not exists (
                select 1 from payments
                where booking_id = ${bookingId} and status = 'captured'
              )
          `;
        }
      }
      break;
    }

    case "charge.dispute.created": {
      const dispute = event.data.object as Stripe.Dispute;
      const pi =
        typeof dispute.payment_intent === "string"
          ? dispute.payment_intent
          : dispute.payment_intent?.id;
      if (!pi) break;
      await sql`
        update bookings set status = 'disputed'
        where id in (
          select booking_id from payments where stripe_payment_intent = ${pi}
        )
        and status in ('deposit_paid', 'paid_in_full', 'in_progress', 'completed')
      `;
      break;
    }
  }

  return NextResponse.json({ received: true });
}
