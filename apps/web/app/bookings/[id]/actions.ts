"use server";

import { revalidatePath } from "next/cache";
import {
  canTransition,
  computeFetAmounts,
  type BookingActor,
  type BookingStatus,
} from "@jlaero/shared";
import { createClient } from "@/lib/supabase/server";

export type EngineState = { error?: string; ok?: boolean };

type BookingRow = {
  id: string;
  kind: "charter" | "crew";
  status: BookingStatus;
  buyer_id: string;
  provider_id: string;
  aircraft_id: string | null;
  currency: string;
};

async function loadBookingAsParty(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, booking: null, actor: null as BookingActor | null, userId: "" };

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, kind, status, buyer_id, provider_id, aircraft_id, currency")
    .eq("id", id)
    .maybeSingle();
  if (!booking) return { supabase, booking: null, actor: null, userId: user.id };

  const actor: BookingActor | null =
    booking.buyer_id === user.id
      ? "buyer"
      : booking.provider_id === user.id
        ? "provider"
        : null;
  return { supabase, booking: booking as BookingRow, actor, userId: user.id };
}

function num(v: FormDataEntryValue | null): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Provider (or buyer, as a counter) sends a new quote version.
export async function sendQuote(
  bookingId: string,
  _prev: EngineState,
  formData: FormData
): Promise<EngineState> {
  const { supabase, booking, actor, userId } = await loadBookingAsParty(bookingId);
  if (!booking || !actor) return { error: "Not found" };
  if (!["requested", "quoted", "negotiating"].includes(booking.status)) {
    return { error: `Cannot quote a booking in status "${booking.status}"` };
  }
  if (booking.status === "requested" && actor !== "provider") {
    return { error: "Only the operator can send the first quote" };
  }

  // Line items arrive as parallel arrays
  const kinds = formData.getAll("item_kind").map(String);
  const descriptions = formData.getAll("item_description").map(String);
  const quantities = formData.getAll("item_quantity");
  const unitAmounts = formData.getAll("item_unit");

  const items: { kind: string; description: string; quantity: number; unit_amount: number; amount: number }[] = [];
  for (let i = 0; i < kinds.length; i++) {
    const quantity = num(quantities[i] ?? null) || 1;
    const unit = num(unitAmounts[i] ?? null);
    if (!kinds[i] || unit === 0) continue;
    const sign = kinds[i] === "discount" ? -1 : 1;
    items.push({
      kind: kinds[i]!,
      description: descriptions[i] || "",
      quantity,
      unit_amount: unit,
      amount: Math.round(sign * Math.abs(quantity * unit) * 100) / 100,
    });
  }
  if (!items.length) return { error: "Add at least one line item" };

  // FET for US charter: computed server-side, never client-supplied
  if (booking.kind === "charter") {
    const { data: legs } = await supabase
      .from("booking_legs")
      .select("passengers")
      .eq("booking_id", bookingId);
    const segments = legs?.length ?? 1;
    const pax = Math.max(...(legs ?? []).map((l) => l.passengers ?? 1), 1);
    const taxable = items.reduce((s, i) => s + i.amount, 0);
    const { fet, segmentFees } = computeFetAmounts(taxable, segments, pax);
    items.push({
      kind: "tax_fet",
      description: "US Federal Excise Tax (7.5%)",
      quantity: 1,
      unit_amount: fet,
      amount: fet,
    });
    items.push({
      kind: "tax_segment",
      description: `Segment fees (${segments} segments x ${pax} pax)`,
      quantity: 1,
      unit_amount: segmentFees,
      amount: segmentFees,
    });
  }
  const total = Math.round(items.reduce((s, i) => s + i.amount, 0) * 100) / 100;

  const expiresHours = num(formData.get("expires_hours")) || 72;
  const notes = String(formData.get("notes") ?? "").slice(0, 2000) || null;

  // Supersede any live quote, then insert the next version
  const { data: prior } = await supabase
    .from("quotes")
    .select("id, version")
    .eq("booking_id", bookingId)
    .order("version", { ascending: false });
  const liveIds = (prior ?? []).map((q) => q.id);
  if (liveIds.length) {
    await supabase
      .from("quotes")
      .update({ status: "superseded" })
      .in("id", liveIds)
      .eq("status", "sent");
  }
  const version = (prior?.[0]?.version ?? 0) + 1;

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .insert({
      booking_id: bookingId,
      version,
      created_by: userId,
      status: "sent",
      currency: booking.currency,
      total,
      notes,
      expires_at: new Date(Date.now() + expiresHours * 3600_000).toISOString(),
    })
    .select("id")
    .single();
  if (quoteError || !quote) return { error: quoteError?.message ?? "Quote failed" };

  const { error: itemsError } = await supabase.from("quote_line_items").insert(
    items.map((i, position) => ({ quote_id: quote.id, position, ...i }))
  );
  if (itemsError) return { error: itemsError.message };

  if (booking.status !== "quoted") {
    if (!canTransition(booking.status, "quoted", actor)) {
      return { error: "Not allowed from this status" };
    }
    await supabase.from("bookings").update({ status: "quoted" }).eq("id", bookingId);
  }

  revalidatePath(`/bookings/${bookingId}`);
  return { ok: true };
}

// Buyer accepts the live quote: freeze it, place the calendar hold.
export async function acceptQuote(bookingId: string, quoteId: string): Promise<EngineState> {
  const { supabase, booking, actor } = await loadBookingAsParty(bookingId);
  if (!booking || !actor) return { error: "Not found" };
  if (!canTransition(booking.status, "accepted", actor)) {
    return { error: "Only the traveler can accept an open quote" };
  }

  const { data: quote } = await supabase
    .from("quotes")
    .select("id, status, expires_at")
    .eq("id", quoteId)
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (!quote || quote.status !== "sent") return { error: "This quote is no longer open" };
  if (quote.expires_at && new Date(quote.expires_at) < new Date()) {
    return { error: "This quote has expired; ask for a new one" };
  }

  // Occupancy from legs: 3h before first departure to 24h after the last.
  const { data: legs } = await supabase
    .from("booking_legs")
    .select("depart_at")
    .eq("booking_id", bookingId)
    .not("depart_at", "is", null);
  const times = (legs ?? []).map((l) => new Date(l.depart_at as string).getTime());
  if (!times.length) return { error: "This booking has no scheduled legs" };
  const occupiedFrom = new Date(Math.min(...times) - 3 * 3600_000).toISOString();
  const occupiedTo = new Date(Math.max(...times) + 24 * 3600_000).toISOString();

  await supabase.from("quotes").update({ status: "accepted" }).eq("id", quoteId);
  const { error } = await supabase
    .from("bookings")
    .update({
      status: "accepted",
      accepted_quote_id: quoteId,
      occupied_from: occupiedFrom,
      occupied_to: occupiedTo,
    })
    .eq("id", bookingId);

  if (error) {
    await supabase.from("quotes").update({ status: "sent" }).eq("id", quoteId);
    if (error.code === "23P01") {
      return {
        error:
          "The aircraft was just booked for overlapping dates. Ask the operator about alternatives.",
      };
    }
    return { error: error.message };
  }

  revalidatePath(`/bookings/${bookingId}`);
  return { ok: true };
}

export async function declineBooking(bookingId: string): Promise<EngineState> {
  const { supabase, booking, actor } = await loadBookingAsParty(bookingId);
  if (!booking || !actor) return { error: "Not found" };
  if (!canTransition(booking.status, "declined", actor)) {
    return { error: "Not allowed from this status" };
  }
  const { error } = await supabase
    .from("bookings")
    .update({ status: "declined" })
    .eq("id", bookingId);
  if (error) return { error: error.message };
  revalidatePath(`/bookings/${bookingId}`);
  return { ok: true };
}

export async function cancelBooking(bookingId: string): Promise<EngineState> {
  const { supabase, booking, actor } = await loadBookingAsParty(bookingId);
  if (!booking || !actor) return { error: "Not found" };
  if (!canTransition(booking.status, "cancelled", actor)) {
    return { error: "Not allowed from this status" };
  }

  // Refund engine for paid bookings: buyer cancellations follow the listing's
  // cancellation tier; provider cancellations always refund 100%.
  if (["deposit_paid", "paid_in_full"].includes(booking.status)) {
    const [{ refundPercent }, { stripe }, { db }] = await Promise.all([
      import("@jlaero/shared"),
      import("@/lib/stripe"),
      import("@/lib/db"),
    ]);

    let pct = 100;
    if (actor === "buyer") {
      const [{ data: aircraft }, { data: legs }] = await Promise.all([
        booking.aircraft_id
          ? supabase
              .from("aircraft")
              .select("cancellation_tier")
              .eq("id", booking.aircraft_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        supabase
          .from("booking_legs")
          .select("depart_at")
          .eq("booking_id", bookingId)
          .not("depart_at", "is", null)
          .order("depart_at")
          .limit(1),
      ]);
      const tier = (aircraft?.cancellation_tier ?? "moderate") as
        | "flexible"
        | "moderate"
        | "strict";
      const departAt = legs?.[0]?.depart_at;
      const hoursBefore = departAt
        ? Math.max(0, (new Date(departAt).getTime() - Date.now()) / 3600_000)
        : 0;
      pct = refundPercent(tier, hoursBefore);
    }

    if (pct > 0) {
      const sql = db();
      const captured = await sql`
        select id, stripe_payment_intent, amount from payments
        where booking_id = ${bookingId} and status = 'captured'
      `;
      for (const p of captured) {
        const pi = p.stripe_payment_intent as string;
        if (!pi?.startsWith("pi_")) continue;
        const refundCents = Math.round(Number(p.amount) * (pct / 100) * 100);
        if (refundCents <= 0) continue;
        try {
          await stripe().refunds.create({
            payment_intent: pi,
            amount: refundCents,
            metadata: { booking_id: bookingId, refund_pct: String(pct) },
          });
        } catch (e) {
          return {
            error: `Refund failed: ${e instanceof Error ? e.message : "unknown"}`,
          };
        }
      }
    }
  }

  const { error } = await supabase
    .from("bookings")
    .update({
      status: "cancelled",
      cancelled_by: actor,
      cancel_reason: "standard",
      occupied_from: null,
      occupied_to: null,
    })
    .eq("id", bookingId);
  if (error) return { error: error.message };
  revalidatePath(`/bookings/${bookingId}`);
  return { ok: true };
}

export async function addPassenger(
  bookingId: string,
  _prev: EngineState,
  formData: FormData
): Promise<EngineState> {
  const { supabase, booking, actor } = await loadBookingAsParty(bookingId);
  if (!booking || !actor) return { error: "Not found" };
  if (["completed", "cancelled", "declined", "expired", "refunded"].includes(booking.status)) {
    return { error: "This booking can no longer be edited" };
  }
  const name = String(formData.get("full_name") ?? "").trim();
  if (!name) return { error: "Name is required" };
  const dob = String(formData.get("date_of_birth") ?? "") || null;
  const { error } = await supabase.from("booking_passengers").insert({
    booking_id: bookingId,
    full_name: name.slice(0, 160),
    date_of_birth: dob,
  });
  if (error) return { error: error.message };
  revalidatePath(`/bookings/${bookingId}`);
  return { ok: true };
}

export async function removePassenger(bookingId: string, passengerId: string): Promise<void> {
  const { supabase, booking, actor } = await loadBookingAsParty(bookingId);
  if (!booking || !actor) return;
  await supabase
    .from("booking_passengers")
    .delete()
    .eq("id", passengerId)
    .eq("booking_id", bookingId);
  revalidatePath(`/bookings/${bookingId}`);
}
