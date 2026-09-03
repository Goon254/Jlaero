// Native booking operations mirroring the web server actions' data flow.
// RLS is the enforcement layer; these helpers keep the client honest.
import { supabase } from "./supabase";

export async function requestCharter(params: {
  aircraftId: string;
  tripType: "one_way" | "round_trip";
  origin: string;
  destination: string;
  departDate: string; // YYYY-MM-DD
  returnDate?: string;
  passengers: number;
  notes?: string;
}): Promise<{ bookingId?: string; error?: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { data: aircraft } = await supabase
    .from("aircraft")
    .select("id, owner_id, status, currency")
    .eq("id", params.aircraftId)
    .eq("status", "active")
    .maybeSingle();
  if (!aircraft) return { error: "This listing is not available" };
  if (aircraft.owner_id === user.id) return { error: "You cannot request your own aircraft" };

  const norm = (c: string) => c.trim().toUpperCase();
  const legs = [
    {
      position: 0,
      origin: norm(params.origin),
      destination: norm(params.destination),
      depart_at: new Date(`${params.departDate}T10:00:00Z`).toISOString(),
      passengers: params.passengers,
    },
    ...(params.tripType === "round_trip" && params.returnDate
      ? [
          {
            position: 1,
            origin: norm(params.destination),
            destination: norm(params.origin),
            depart_at: new Date(`${params.returnDate}T10:00:00Z`).toISOString(),
            passengers: params.passengers,
          },
        ]
      : []),
  ];

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .insert({
      kind: "charter",
      buyer_id: user.id,
      provider_id: aircraft.owner_id,
      aircraft_id: aircraft.id,
      currency: aircraft.currency,
      special_requests: params.notes ?? null,
    })
    .select("id")
    .single();
  if (bookingError || !booking) return { error: bookingError?.message ?? "Request failed" };

  const { error: legsError } = await supabase
    .from("booking_legs")
    .insert(legs.map((l) => ({ ...l, booking_id: booking.id })));
  if (legsError) return { error: legsError.message };

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
      .insert({ conversation_id: conversation.id, user_id: aircraft.owner_id });
  }

  return { bookingId: booking.id };
}

export async function acceptQuote(
  bookingId: string,
  quoteId: string
): Promise<{ ok?: boolean; error?: string }> {
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

  const { data: legs } = await supabase
    .from("booking_legs")
    .select("depart_at")
    .eq("booking_id", bookingId)
    .not("depart_at", "is", null);
  const times = (legs ?? []).map((l) => new Date(l.depart_at as string).getTime());
  if (!times.length) return { error: "This booking has no scheduled legs" };

  await supabase.from("quotes").update({ status: "accepted" }).eq("id", quoteId);
  const { error } = await supabase
    .from("bookings")
    .update({
      status: "accepted",
      accepted_quote_id: quoteId,
      occupied_from: new Date(Math.min(...times) - 3 * 3600_000).toISOString(),
      occupied_to: new Date(Math.max(...times) + 24 * 3600_000).toISOString(),
    })
    .eq("id", bookingId);
  if (error) {
    await supabase.from("quotes").update({ status: "sent" }).eq("id", quoteId);
    if (error.code === "23P01") {
      return { error: "The aircraft was just booked for overlapping dates." };
    }
    return { error: error.message };
  }
  return { ok: true };
}

export async function cancelBooking(
  bookingId: string,
  actor: "buyer" | "provider"
): Promise<{ ok?: boolean; error?: string }> {
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
  return { ok: true };
}
