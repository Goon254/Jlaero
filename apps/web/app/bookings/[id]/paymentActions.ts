"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canTransition, platformFee } from "@jlaero/shared";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { stripe, DEPOSIT_RATE } from "@/lib/stripe";

export type PayState = { error?: string; ok?: boolean };

async function loadAsParty(bookingId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: booking } = await supabase
    .from("bookings")
    .select(
      "id, status, buyer_id, provider_id, currency, accepted_quote_id, aircraft_id"
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return null;
  const role =
    booking.buyer_id === user.id
      ? ("buyer" as const)
      : booking.provider_id === user.id
        ? ("provider" as const)
        : null;
  if (!role) return null;
  return { supabase, booking, role, userId: user.id };
}

// Buyer signs the charter agreement; booking moves to contract_signed.
export async function signContract(
  bookingId: string,
  _prev: PayState,
  formData: FormData
): Promise<PayState> {
  const ctx = await loadAsParty(bookingId);
  if (!ctx) return { error: "Not found" };
  const { booking, role } = ctx;

  if (!canTransition(booking.status, "contract_signed", role)) {
    return { error: "The agreement can be signed once a quote is accepted" };
  }
  const name = String(formData.get("signer_name") ?? "").trim();
  if (name.length < 3) return { error: "Type your full legal name to sign" };
  if (formData.get("agree") !== "on") {
    return { error: "You must agree to the charter agreement" };
  }

  const hdrs = await headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    hdrs.get("x-real-ip") ??
    "unknown";

  const sql = db();
  await sql`
    insert into contracts (booking_id, quote_id, template_version, status,
                           buyer_signed_at, buyer_signer_name, buyer_signer_ip)
    values (${bookingId}, ${booking.accepted_quote_id}, 'v1', 'signed',
            now(), ${name.slice(0, 160)}, ${ip})
  `;
  await sql`
    update bookings set status = 'contract_signed' where id = ${bookingId}
  `;

  revalidatePath(`/bookings/${bookingId}`);
  return { ok: true };
}

// Buyer starts a Stripe Checkout for deposit, balance, or full payment.
export async function startCheckout(
  bookingId: string,
  kind: "deposit" | "balance" | "full"
): Promise<PayState> {
  const ctx = await loadAsParty(bookingId);
  if (!ctx) return { error: "Not found" };
  const { supabase, booking, role } = ctx;
  if (role !== "buyer") return { error: "Only the traveler pays" };

  const payableFrom =
    kind === "balance" ? ["deposit_paid"] : ["contract_signed"];
  if (!payableFrom.includes(booking.status)) {
    return { error: `Payment not available in status "${booking.status}"` };
  }
  if (!booking.accepted_quote_id) return { error: "No accepted quote" };

  const { data: quote } = await supabase
    .from("quotes")
    .select("total, currency")
    .eq("id", booking.accepted_quote_id)
    .maybeSingle();
  if (!quote) return { error: "Quote not found" };

  const totalCents = Math.round(Number(quote.total) * 100);
  const { data: captured } = await supabase
    .from("payments")
    .select("amount")
    .eq("booking_id", bookingId)
    .eq("status", "captured");
  const paidCents = Math.round(
    (captured ?? []).reduce((s, p) => s + Number(p.amount), 0) * 100
  );

  let amountCents: number;
  let label: string;
  if (kind === "deposit") {
    amountCents = Math.round(totalCents * DEPOSIT_RATE);
    label = "Charter deposit (25%)";
  } else if (kind === "balance") {
    amountCents = totalCents - paidCents;
    label = "Charter balance";
  } else {
    amountCents = totalCents - paidCents;
    label = "Charter payment";
  }
  if (amountCents <= 0) return { error: "Nothing left to pay" };

  const origin =
    (await headers()).get("origin") ?? "http://localhost:3000";
  const suffix = Math.random().toString(36).slice(2, 10);

  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: (quote.currency || "USD").toLowerCase(),
          unit_amount: amountCents,
          product_data: { name: `Jlaero ${label}` },
        },
      },
    ],
    metadata: { booking_id: bookingId, kind },
    payment_intent_data: {
      metadata: { booking_id: bookingId, kind },
      transfer_group: `booking_${bookingId}`,
    },
    success_url: `${origin}/bookings/${bookingId}?paid=1`,
    cancel_url: `${origin}/bookings/${bookingId}?paycancel=1`,
    integration_identifier: `jlaero-charter-${suffix}`,
  } as Parameters<ReturnType<typeof stripe>["checkout"]["sessions"]["create"]>[0]);

  const sql = db();
  await sql`
    insert into payments (booking_id, stripe_payment_intent, amount, platform_fee, currency, status)
    values (${bookingId}, ${session.id}, ${amountCents / 100},
            ${platformFee(amountCents / 100)}, ${quote.currency || "USD"}, 'pending')
  `;

  redirect(session.url!);
}

// Provider marks the trip started / completed. Completion releases the payout.
export async function startTrip(bookingId: string): Promise<PayState> {
  const ctx = await loadAsParty(bookingId);
  if (!ctx) return { error: "Not found" };
  const { supabase, booking, role } = ctx;
  if (!canTransition(booking.status, "in_progress", role)) {
    return { error: "Trip can start once fully paid" };
  }
  const { error } = await supabase
    .from("bookings")
    .update({ status: "in_progress" })
    .eq("id", bookingId);
  if (error) return { error: error.message };
  revalidatePath(`/bookings/${bookingId}`);
  return { ok: true };
}

export async function completeTrip(bookingId: string): Promise<PayState> {
  const ctx = await loadAsParty(bookingId);
  if (!ctx) return { error: "Not found" };
  const { supabase, booking, role } = ctx;
  if (!canTransition(booking.status, "completed", role)) {
    return { error: "Trip must be in progress to complete" };
  }

  const { error } = await supabase
    .from("bookings")
    .update({ status: "completed" })
    .eq("id", bookingId);
  if (error) return { error: error.message };

  // Release the payout: transfer captured funds minus the platform fee.
  const sql = db();
  const capturedRows = await sql`
    select coalesce(sum(amount), 0) as captured from payments
    where booking_id = ${bookingId} and status = 'captured'
  `;
  const capturedNum = Number(capturedRows[0]?.captured ?? 0);
  if (capturedNum > 0) {
    const fee = platformFee(capturedNum);
    const payoutAmount = Math.round((capturedNum - fee) * 100) / 100;
    const [acct] = await sql`
      select stripe_account_id, payouts_enabled from stripe_accounts
      where user_id = ${booking.provider_id}
    `;

    let transferId: string | null = null;
    let status = "pending";
    if (acct?.stripe_account_id) {
      try {
        const transfer = await stripe().transfers.create({
          amount: Math.round(payoutAmount * 100),
          currency: booking.currency.toLowerCase(),
          destination: acct.stripe_account_id,
          transfer_group: `booking_${bookingId}`,
          metadata: { booking_id: bookingId },
        });
        transferId = transfer.id;
        status = "in_transit";
      } catch {
        status = "pending"; // account not ready; retried when onboarding completes
      }
    }
    await sql`
      insert into payouts (provider_id, booking_id, stripe_transfer, amount, currency, status)
      values (${booking.provider_id}, ${bookingId}, ${transferId},
              ${payoutAmount}, ${booking.currency}, ${status})
    `;
  }

  revalidatePath(`/bookings/${bookingId}`);
  return { ok: true };
}
