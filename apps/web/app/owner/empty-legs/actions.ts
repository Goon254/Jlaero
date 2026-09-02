"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type EmptyLegState = { error?: string; ok?: boolean };

function str(v: FormDataEntryValue | null): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s === "" ? undefined : s;
}

export async function createEmptyLeg(
  _prev: EmptyLegState,
  formData: FormData
): Promise<EmptyLegState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const aircraftId = str(formData.get("aircraft_id"));
  const origin = str(formData.get("origin"));
  const destination = str(formData.get("destination"));
  const date = str(formData.get("depart_date"));
  const time = str(formData.get("depart_time")) ?? "12:00";
  const price = Number(formData.get("price") || 0);
  const seats = Number(formData.get("seats") || 0) || null;

  if (!aircraftId || !origin || !destination || !date) {
    return { error: "Aircraft, route, and date are required" };
  }
  if (price <= 0) return { error: "Set a fixed price" };

  const { data: aircraft } = await supabase
    .from("aircraft")
    .select("id")
    .eq("id", aircraftId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!aircraft) return { error: "Not your aircraft" };

  const { error } = await supabase.from("empty_legs").insert({
    aircraft_id: aircraftId,
    origin: origin.toUpperCase(),
    destination: destination.toUpperCase(),
    depart_at: new Date(`${date}T${time}:00Z`).toISOString(),
    price,
    seats,
    status: "active",
  });
  if (error) return { error: error.message };
  revalidatePath("/owner/empty-legs");
  revalidatePath("/charter");
  return { ok: true };
}

export async function deactivateEmptyLeg(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("empty_legs").update({ status: "archived" }).eq("id", id);
  revalidatePath("/owner/empty-legs");
  revalidatePath("/charter");
}

// Books an empty leg at its fixed price: booking arrives pre-quoted so the
// buyer can accept, sign, and pay immediately.
export async function bookEmptyLeg(emptyLegId: string): Promise<EmptyLegState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: leg } = await supabase
    .from("empty_legs")
    .select("id, aircraft_id, origin, destination, depart_at, price, currency, seats, status, aircraft(owner_id)")
    .eq("id", emptyLegId)
    .eq("status", "active")
    .maybeSingle();
  if (!leg) return { error: "This empty leg is no longer available" };
  const ownerId = (leg.aircraft as unknown as { owner_id: string }).owner_id;
  if (ownerId === user.id) return { error: "This is your own flight" };
  if (new Date(leg.depart_at) < new Date()) return { error: "This flight has departed" };

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .insert({
      kind: "charter",
      status: "quoted",
      buyer_id: user.id,
      provider_id: ownerId,
      aircraft_id: leg.aircraft_id,
      currency: leg.currency,
      special_requests: `Empty leg ${leg.origin} -> ${leg.destination}`,
    })
    .select("id")
    .single();
  if (bookingError || !booking) {
    return { error: bookingError?.message ?? "Could not create the booking" };
  }

  await supabase.from("booking_legs").insert({
    booking_id: booking.id,
    position: 0,
    origin: leg.origin,
    destination: leg.destination,
    depart_at: leg.depart_at,
    passengers: leg.seats,
  });

  const { data: quote } = await supabase
    .from("quotes")
    .insert({
      booking_id: booking.id,
      version: 1,
      created_by: user.id,
      status: "sent",
      currency: leg.currency,
      total: leg.price,
      notes: "Fixed empty-leg price, all-in (taxes included by the operator).",
      expires_at: leg.depart_at,
    })
    .select("id")
    .single();
  if (quote) {
    await supabase.from("quote_line_items").insert({
      quote_id: quote.id,
      position: 0,
      kind: "other",
      description: `Empty leg ${leg.origin} -> ${leg.destination}, fixed price`,
      quantity: 1,
      unit_amount: leg.price,
      amount: leg.price,
    });
  }

  const { data: conversation } = await supabase
    .from("conversations")
    .insert({ booking_id: booking.id, created_by: user.id })
    .select("id")
    .single();
  if (conversation) {
    await supabase
      .from("conversation_participants")
      .insert({ conversation_id: conversation.id, user_id: user.id });
    await supabase
      .from("conversation_participants")
      .insert({ conversation_id: conversation.id, user_id: ownerId });
  }

  redirect(`/bookings/${booking.id}`);
}
