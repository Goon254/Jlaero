// Client-side reads for the trip pages. Everything goes through the RLS
// session client, so a client only ever sees their own records and the
// client-safe columns of trip_quotes.
import type { TripStatus } from "@jlaero/shared";
import { createClient } from "@/lib/supabase/server";

// trip_quotes is column-granted; never select anything outside this list.
export const OPTION_COLUMNS =
  "id, trip_id, status, option_rank, is_replacement, availability, aircraft_type, aircraft_category, year_mfr, passenger_capacity, headline, highlights, client_price, currency, expires_at, sent_at, selected_at";

export type Airport = { icao: string; iata: string | null; name: string; municipality: string | null; tz: string | null };

export type ClientTrip = {
  id: string;
  trip_number: string;
  status: TripStatus;
  origin_icao: string;
  destination_icao: string;
  departure_date: string;
  departure_time: string | null;
  depart_at: string;
  return_date: string | null;
  return_time: string | null;
  return_at: string | null;
  passengers: number;
  aircraft_category: string | null;
  aircraft_preference: string | null;
  vehicle_required: boolean;
  catering_required: boolean;
  special_requests: string | null;
  selected_quote_id: string | null;
  cancel_reason: string | null;
  created_at: string;
};

export type ClientOption = {
  id: string;
  trip_id: string;
  status: string;
  option_rank: number | null;
  is_replacement: boolean;
  availability: string;
  aircraft_type: string;
  aircraft_category: string | null;
  year_mfr: number | null;
  passenger_capacity: number | null;
  headline: string | null;
  highlights: string[];
  client_price: string | number;
  currency: string;
  expires_at: string | null;
  sent_at: string | null;
  selected_at: string | null;
};

export type ClientSettings = {
  company: { name: string; legal_name?: string; support_email?: string; support_phone?: string; address?: string };
  payment_instructions: Record<string, string>;
  cancellation_policy: { title: string; body: string };
};

export async function loadClientSettings(): Promise<ClientSettings> {
  const supabase = await createClient();
  const { data } = await supabase.from("app_settings").select("key, value").eq("client_visible", true);
  const map = Object.fromEntries((data ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value])) as {
    company?: ClientSettings["company"];
    payment_instructions?: Record<string, string>;
    cancellation_policy?: Partial<ClientSettings["cancellation_policy"]>;
  };
  return {
    company: { name: "Jlaero", ...(map.company ?? {}) },
    payment_instructions: map.payment_instructions ?? {},
    cancellation_policy: { title: "Cancellation policy", body: "", ...(map.cancellation_policy ?? {}) },
  };
}

export async function loadAirports(codes: string[]): Promise<Record<string, Airport>> {
  const supabase = await createClient();
  const { data } = await supabase.from("airports").select("icao, iata, name, municipality, tz").in("icao", [...new Set(codes)]);
  return Object.fromEntries(((data ?? []) as Airport[]).map((a) => [a.icao, a]));
}

export async function loadTrip(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("trips").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  const trip = data as ClientTrip;
  const airports = await loadAirports([trip.origin_icao, trip.destination_icao]);
  return { trip, origin: airports[trip.origin_icao] ?? null, destination: airports[trip.destination_icao] ?? null };
}

export function airportLabel(a: Airport | null, fallback: string) {
  if (!a) return fallback;
  return `${a.municipality ? `${a.municipality}, ` : ""}${a.name}`;
}

export function airportCode(a: Airport | null, fallback: string) {
  return a?.iata ?? a?.icao ?? fallback;
}
