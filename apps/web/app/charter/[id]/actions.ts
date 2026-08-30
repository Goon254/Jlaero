"use server";

import { redirect } from "next/navigation";
import { bookingRequestSchema } from "@jlaero/shared";
import { createClient } from "@/lib/supabase/server";

export type RequestState = { error?: string };

function str(v: FormDataEntryValue | null): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s === "" ? undefined : s;
}

export async function requestCharter(
  aircraftId: string,
  _prev: RequestState,
  formData: FormData
): Promise<RequestState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login`);

  const tripType = str(formData.get("trip_type")) === "round_trip" ? "round_trip" : "one_way";
  const origin = str(formData.get("origin"));
  const destination = str(formData.get("destination"));
  const departDate = str(formData.get("depart_date"));
  const departTime = str(formData.get("depart_time")) ?? "12:00";
  const returnDate = str(formData.get("return_date"));
  const returnTime = str(formData.get("return_time")) ?? "12:00";
  const passengers = Number(formData.get("passengers") || 0) || undefined;

  if (!origin || !destination) return { error: "Origin and destination are required" };
  if (!departDate) return { error: "Departure date is required" };
  if (tripType === "round_trip" && !returnDate) {
    return { error: "Return date is required for a round trip" };
  }

  const legs = [
    {
      origin,
      destination,
      depart_at: new Date(`${departDate}T${departTime}:00Z`).toISOString(),
      passengers,
    },
    ...(tripType === "round_trip"
      ? [
          {
            origin: destination,
            destination: origin,
            depart_at: new Date(`${returnDate}T${returnTime}:00Z`).toISOString(),
            passengers,
          },
        ]
      : []),
  ];

  const parsed = bookingRequestSchema.safeParse({
    kind: "charter",
    aircraft_id: aircraftId,
    legs,
    pets: formData.get("pets") === "on",
    luggage_notes: str(formData.get("luggage_notes")),
    special_requests: str(formData.get("special_requests")),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid request" };
  }

  // provider_id is DERIVED server-side from the listing; never trusted from
  // the client (see ROADMAP 3b).
  const { data: aircraft } = await supabase
    .from("aircraft")
    .select("id, owner_id, status, currency")
    .eq("id", aircraftId)
    .eq("status", "active")
    .maybeSingle();
  if (!aircraft) return { error: "This listing is not available" };
  if (aircraft.owner_id === user.id) {
    return { error: "You cannot request your own aircraft" };
  }

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .insert({
      kind: "charter",
      buyer_id: user.id,
      provider_id: aircraft.owner_id,
      aircraft_id: aircraft.id,
      currency: aircraft.currency,
      pets: parsed.data.pets,
      luggage_notes: parsed.data.luggage_notes ?? null,
      special_requests: parsed.data.special_requests ?? null,
    })
    .select("id")
    .single();
  if (bookingError || !booking) {
    return { error: bookingError?.message ?? "Could not create the request" };
  }

  const legRows = parsed.data.legs.map((l, i) => ({
    booking_id: booking.id,
    position: i,
    origin: l.origin,
    destination: l.destination ?? null,
    depart_at: l.depart_at ?? null,
    passengers: l.passengers ?? null,
  }));
  const { error: legsError } = await supabase.from("booking_legs").insert(legRows);
  if (legsError) return { error: legsError.message };

  // One conversation per booking; buyer bootstraps then adds the provider.
  const { data: conversation } = await supabase
    .from("conversations")
    .insert({ booking_id: booking.id })
    .select("id")
    .single();
  if (conversation) {
    await supabase
      .from("conversation_participants")
      .insert({ conversation_id: conversation.id, user_id: user.id });
    await supabase
      .from("conversation_participants")
      .insert({ conversation_id: conversation.id, user_id: aircraft.owner_id });
  }

  redirect(`/bookings/${booking.id}`);
}
