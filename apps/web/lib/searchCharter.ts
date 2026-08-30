import { haversineNm } from "@jlaero/shared";
import { createClient } from "./supabase/server";

// v1 search per ROADMAP S8: active aircraft, seat/category/price filters,
// origin proximity (home base within a radius), date-vs-blocks availability,
// and range/runway feasibility when the data exists.

export const ORIGIN_RADIUS_NM = 250;

export type CharterSearchParams = {
  origin?: string; // ICAO
  destination?: string; // ICAO
  date?: string; // YYYY-MM-DD
  return_date?: string;
  pax?: number;
  category?: string;
  max_hourly?: number;
};

export type AircraftResult = {
  id: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  category: string | null;
  seats: number | null;
  home_base: string | null;
  hourly_rate: number | null;
  currency: string;
  argus_rating: string | null;
  wyvern_rating: string | null;
  is_bao_stage: string | null;
  instant_book: boolean;
  range_nm: number | null;
  min_runway_ft: number | null;
  cover_path: string | null;
  distance_from_origin_nm: number | null;
};

type Airport = { icao: string; latitude: number; longitude: number; longest_runway_ft: number | null };

export async function searchCharter(params: CharterSearchParams): Promise<{
  results: AircraftResult[];
  tripDistanceNm: number | null;
}> {
  const supabase = await createClient();

  let query = supabase
    .from("aircraft")
    .select(
      "id, name, manufacturer, model, category, seats, home_base, hourly_rate, currency, argus_rating, wyvern_rating, is_bao_stage, instant_book, range_nm, min_runway_ft, aircraft_photos(file_path, position)"
    )
    .eq("status", "active");

  if (params.pax) query = query.gte("seats", params.pax);
  if (params.category) query = query.eq("category", params.category);
  if (params.max_hourly) query = query.lte("hourly_rate", params.max_hourly);

  const { data: aircraft } = await query.limit(200);
  if (!aircraft?.length) return { results: [], tripDistanceNm: null };

  // Airport lookups for proximity + feasibility
  const codes = new Set<string>();
  for (const a of aircraft) if (a.home_base) codes.add(a.home_base);
  if (params.origin) codes.add(params.origin);
  if (params.destination) codes.add(params.destination);

  const { data: airports } = await supabase
    .from("airports")
    .select("icao, latitude, longitude, longest_runway_ft")
    .in("icao", [...codes]);
  const byIcao = new Map<string, Airport>(
    ((airports as Airport[]) ?? []).map((ap) => [ap.icao, ap])
  );

  const origin = params.origin ? byIcao.get(params.origin) : undefined;
  const dest = params.destination ? byIcao.get(params.destination) : undefined;
  const tripDistanceNm =
    origin && dest
      ? Math.round(
          haversineNm(origin.latitude, origin.longitude, dest.latitude, dest.longitude)
        )
      : null;

  // Availability: exclude aircraft with a block overlapping the trip dates
  let blockedIds = new Set<string>();
  if (params.date) {
    const from = `${params.date}T00:00:00Z`;
    const to = `${params.return_date ?? params.date}T23:59:59Z`;
    const { data: blocks } = await supabase
      .from("aircraft_availability")
      .select("aircraft_id")
      .in("aircraft_id", aircraft.map((a) => a.id))
      .eq("is_blocked", true)
      .lte("starts_at", to)
      .gte("ends_at", from);
    blockedIds = new Set((blocks ?? []).map((b) => b.aircraft_id));
  }

  const results: AircraftResult[] = [];
  for (const a of aircraft) {
    if (blockedIds.has(a.id)) continue;

    // Origin proximity
    let distanceFromOrigin: number | null = null;
    if (origin) {
      const base = a.home_base ? byIcao.get(a.home_base) : undefined;
      if (!base) continue;
      distanceFromOrigin = Math.round(
        haversineNm(origin.latitude, origin.longitude, base.latitude, base.longitude)
      );
      if (distanceFromOrigin > ORIGIN_RADIUS_NM) continue;
    }

    // Feasibility (only when data is present on both sides)
    if (tripDistanceNm && a.range_nm && a.range_nm < tripDistanceNm) continue;
    if (dest?.longest_runway_ft && a.min_runway_ft && dest.longest_runway_ft < a.min_runway_ft)
      continue;

    const cover = [...(a.aircraft_photos ?? [])].sort((x, y) => x.position - y.position)[0];
    results.push({
      id: a.id,
      name: a.name,
      manufacturer: a.manufacturer,
      model: a.model,
      category: a.category,
      seats: a.seats,
      home_base: a.home_base,
      hourly_rate: a.hourly_rate,
      currency: a.currency,
      argus_rating: a.argus_rating,
      wyvern_rating: a.wyvern_rating,
      is_bao_stage: a.is_bao_stage,
      instant_book: a.instant_book,
      range_nm: a.range_nm,
      min_runway_ft: a.min_runway_ft,
      cover_path: cover?.file_path ?? null,
      distance_from_origin_nm: distanceFromOrigin,
    });
  }

  results.sort((a, b) => {
    if (a.distance_from_origin_nm != null && b.distance_from_origin_nm != null) {
      return a.distance_from_origin_nm - b.distance_from_origin_nm;
    }
    return (a.hourly_rate ?? Infinity) - (b.hourly_rate ?? Infinity);
  });

  return { results, tripDistanceNm };
}
