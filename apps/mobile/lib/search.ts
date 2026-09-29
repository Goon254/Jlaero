// Mobile charter search: mirrors apps/web/lib/searchCharter.ts.
// Active aircraft, seat/class filters, range and runway feasibility, and an
// ESTIMATED all-in price (hourly rate x estimated block hours). Final prices
// always come from the operator's quote.
import { estimateFlightHours, haversineNm, type AircraftCategory } from "@jlaero/shared";
import { supabase } from "./supabase";
import { publicPhotoUrl } from "./media";

export type SearchParams = {
  origin: string;
  destination: string;
  pax: number;
  roundTrip: boolean;
  categories?: AircraftCategory[];
};

export type SearchResult = {
  id: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  category: AircraftCategory | null;
  seats: number | null;
  home_base: string | null;
  hourly_rate: number | null;
  currency: string;
  instant_book: boolean;
  range_nm: number | null;
  argus_rating: string | null;
  wyvern_rating: string | null;
  is_bao_stage: string | null;
  cover: string | null;
  distanceFromOriginNm: number | null;
  estimatedHours: number | null;
  estimatedTotal: number | null;
};

type AirportRow = { icao: string; latitude: number | null; longitude: number | null; longest_runway_ft: number | null };

const ORIGIN_RADIUS_NM = 300;

async function airport(code: string): Promise<AirportRow | null> {
  const upper = code.trim().toUpperCase();
  for (const c of [upper, upper.length === 3 ? `K${upper}` : null]) {
    if (!c) continue;
    const { data } = await supabase
      .from("airports")
      .select("icao, latitude, longitude, longest_runway_ft")
      .or(`iata.eq.${c},icao.eq.${c},ident.eq.${c}`)
      .limit(1);
    if (data?.[0]) return data[0] as AirportRow;
  }
  return null;
}

export async function searchCharter(params: SearchParams): Promise<{
  results: SearchResult[];
  tripDistanceNm: number | null;
}> {
  const [from, to] = await Promise.all([airport(params.origin), airport(params.destination)]);
  const tripDistanceNm =
    from?.latitude && from.longitude && to?.latitude && to.longitude
      ? Math.round(haversineNm(from.latitude, from.longitude, to.latitude, to.longitude))
      : null;

  let query = supabase
    .from("aircraft")
    .select(
      "id, name, manufacturer, model, category, seats, home_base, hourly_rate, currency, instant_book, range_nm, min_runway_ft, argus_rating, wyvern_rating, is_bao_stage, aircraft_photos(file_path, position)"
    )
    .eq("status", "active");
  if (params.pax > 0) query = query.gte("seats", params.pax);
  if (params.categories?.length) query = query.in("category", params.categories);
  const { data } = await query.limit(80);
  const rows = data ?? [];

  const bases = [...new Set(rows.map((r) => r.home_base).filter(Boolean))] as string[];
  const { data: baseRows } = bases.length
    ? await supabase.from("airports").select("icao, latitude, longitude, longest_runway_ft").in("icao", bases)
    : { data: [] as AirportRow[] };
  const baseByIcao = new Map((baseRows ?? []).map((a) => [a.icao, a as AirportRow]));

  const legs = params.roundTrip ? 2 : 1;
  const results: SearchResult[] = [];
  for (const a of rows) {
    let distanceFromOriginNm: number | null = null;
    const base = a.home_base ? baseByIcao.get(a.home_base) : null;
    if (from?.latitude && from.longitude && base?.latitude && base.longitude) {
      distanceFromOriginNm = Math.round(haversineNm(from.latitude, from.longitude, base.latitude, base.longitude));
      if (distanceFromOriginNm > ORIGIN_RADIUS_NM) continue;
    }
    if (tripDistanceNm && a.range_nm && a.range_nm < tripDistanceNm) continue;
    if (to?.longest_runway_ft && a.min_runway_ft && to.longest_runway_ft < a.min_runway_ft) continue;

    const category = (a.category as AircraftCategory | null) ?? null;
    const hours = tripDistanceNm && category ? estimateFlightHours(tripDistanceNm, category) * legs : null;
    const total = hours && a.hourly_rate ? Math.round((hours * Number(a.hourly_rate)) / 10) * 10 : null;
    const cover = [...(a.aircraft_photos ?? [])].sort((x, y) => x.position - y.position)[0];

    results.push({
      id: a.id,
      name: a.name,
      manufacturer: a.manufacturer,
      model: a.model,
      category,
      seats: a.seats,
      home_base: a.home_base,
      hourly_rate: a.hourly_rate ? Number(a.hourly_rate) : null,
      currency: a.currency ?? "USD",
      instant_book: !!a.instant_book,
      range_nm: a.range_nm,
      argus_rating: a.argus_rating,
      wyvern_rating: a.wyvern_rating,
      is_bao_stage: a.is_bao_stage,
      cover: cover ? publicPhotoUrl("aircraft-photos", cover.file_path) : null,
      distanceFromOriginNm,
      estimatedHours: hours,
      estimatedTotal: total,
    });
  }

  results.sort((x, y) => {
    if (x.estimatedTotal != null && y.estimatedTotal != null) return x.estimatedTotal - y.estimatedTotal;
    if (x.estimatedTotal != null) return -1;
    if (y.estimatedTotal != null) return 1;
    return (x.distanceFromOriginNm ?? 1e9) - (y.distanceFromOriginNm ?? 1e9);
  });

  return { results, tripDistanceNm };
}

export type EmptyLeg = {
  id: string;
  origin: string;
  destination: string;
  depart_at: string;
  price: number;
  seats: number | null;
  aircraft: { id: string; name: string; category: string | null; cover: string | null };
};

export async function loadEmptyLegs(limit = 8): Promise<EmptyLeg[]> {
  const { data } = await supabase
    .from("empty_legs")
    .select("id, origin, destination, depart_at, price, seats, aircraft(id, name, category, aircraft_photos(file_path, position))")
    .eq("status", "active")
    .gte("depart_at", new Date().toISOString())
    .order("depart_at")
    .limit(limit);
  return (data ?? []).map((l) => {
    const a = l.aircraft as unknown as {
      id: string;
      name: string;
      category: string | null;
      aircraft_photos: { file_path: string; position: number }[];
    } | null;
    const cover = [...(a?.aircraft_photos ?? [])].sort((x, y) => x.position - y.position)[0];
    return {
      id: l.id,
      origin: l.origin,
      destination: l.destination,
      depart_at: l.depart_at,
      price: Number(l.price),
      seats: l.seats,
      aircraft: {
        id: a?.id ?? "",
        name: a?.name ?? "",
        category: a?.category ?? null,
        cover: cover ? publicPhotoUrl("aircraft-photos", cover.file_path) : null,
      },
    };
  });
}
