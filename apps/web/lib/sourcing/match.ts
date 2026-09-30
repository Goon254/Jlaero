// Operator search for a trip (blueprint s10):
//   1. operators at or near the origin
//   2. operators at or near the destination
//   3. approved operators within the configurable radius (default 100 miles)
//   4. aircraft requirements (category, seats, range)
//   5. availability signals (declared status, live ADS-B on the ground)
// The approved network (operators + operator_aircraft the company maintains)
// is searched first; FAA Part 135 "prospects" are a fallback while the network
// is being built, and can be switched off in settings. Excluded and inactive
// operators are never returned. Only certificate holders are considered, which
// keeps privately owned aircraft out by construction.
import { AIRCRAFT_CATEGORY_LABELS, haversineNm, type AircraftCategory } from "@jlaero/shared";
import { db } from "@/lib/db";

// Approximate state centroids: a cheap "is this operator's fleet registered
// near the origin" signal until operators declare bases.
const STATE_CENTROIDS: Record<string, [number, number]> = {
  AL: [32.8, -86.8], AK: [64.7, -152.4], AZ: [34.3, -111.7], AR: [34.9, -92.4], CA: [37.2, -119.5],
  CO: [39.0, -105.5], CT: [41.6, -72.7], DE: [39.0, -75.5], DC: [38.9, -77.0], FL: [28.6, -82.4],
  GA: [32.7, -83.4], HI: [20.8, -156.3], ID: [44.4, -114.6], IL: [40.0, -89.2], IN: [39.9, -86.3],
  IA: [42.1, -93.5], KS: [38.5, -98.4], KY: [37.5, -85.3], LA: [31.1, -92.0], ME: [45.4, -69.2],
  MD: [39.0, -76.8], MA: [42.3, -71.8], MI: [44.3, -85.4], MN: [46.3, -94.3], MS: [32.7, -89.7],
  MO: [38.4, -92.5], MT: [47.1, -109.6], NE: [41.5, -99.8], NV: [39.3, -116.6], NH: [43.7, -71.6],
  NJ: [40.1, -74.7], NM: [34.4, -106.1], NY: [42.9, -75.5], NC: [35.6, -79.4], ND: [47.5, -100.5],
  OH: [40.3, -82.8], OK: [35.6, -97.5], OR: [43.9, -120.6], PA: [40.9, -77.8], RI: [41.7, -71.6],
  SC: [33.9, -80.9], SD: [44.4, -100.2], TN: [35.9, -86.4], TX: [31.5, -99.3], UT: [39.3, -111.7],
  VT: [44.1, -72.7], VA: [37.5, -78.9], WA: [47.4, -120.5], WV: [38.6, -80.6], WI: [44.6, -90.0], WY: [43.0, -107.6],
};

// Operators that hold Part 135 certificates but do not sell ad hoc charter:
// fractional programs, air ambulance, cargo, airlines. Kept out of RFQs.
const NON_CHARTER = /netjets|flexjet|ameriflight|guardian flight|air methods|reach air|life ?flight|med ?flight|medical|ambulance|cargo|freight|express|airlines?\b|airways|fedex|ups\b|wheels up|jet linx|vista|xo\b|flyexclusive|drone|anduril|top aces|draken|tactical|parts/i;

const CATEGORY_ORDER: AircraftCategory[] = [
  "turboprop", "very_light_jet", "light_jet", "midsize_jet", "super_midsize_jet", "heavy_jet", "ultra_long_range",
];

// Practical still-air range by category (nm), conservative.
const RANGE_NM: Record<string, number> = {
  turboprop: 1200, very_light_jet: 1000, light_jet: 1600, midsize_jet: 2000,
  super_midsize_jet: 2800, heavy_jet: 3600, ultra_long_range: 6000,
};

export function categoriesForTrip(pax: number, distanceNm: number, pref: AircraftCategory | null): AircraftCategory[] {
  const feasible = CATEGORY_ORDER.filter((c) => (RANGE_NM[c] ?? 0) >= distanceNm * 1.1);
  const bySeats = feasible.filter((c) => {
    const seats: Record<string, number> = { turboprop: 9, very_light_jet: 5, light_jet: 7, midsize_jet: 8, super_midsize_jet: 10, heavy_jet: 14, ultra_long_range: 16 };
    return (seats[c] ?? 0) >= pax;
  });
  if (pref) {
    const idx = CATEGORY_ORDER.indexOf(pref);
    const up = CATEGORY_ORDER[idx + 1];
    return [pref, ...(up && bySeats.includes(up) ? [up] : [])].filter((c) => bySeats.includes(c) || c === pref);
  }
  // Smallest three feasible categories: cheapest realistic options.
  return bySeats.slice(0, 3);
}

export type Candidate = {
  operator_id: string;
  name: string;
  certificate_number: string | null;
  contact_id: string | null;
  contact_email: string | null;
  contact_name: string | null;
  fleet: { n_number: string; model: string; category: string; seats: number | null; year: number | null }[];
  nearby_now: number;
  state_hint: string | null;
  network_status: string;
  score: number;
  reason: string;
};

export type TripContext = {
  id: string;
  trip_number: string;
  origin: { icao: string; name: string; latitude: number; longitude: number; tz: string | null };
  destination: { icao: string; name: string; latitude: number; longitude: number; tz: string | null };
  depart_at: Date;
  return_at: Date | null;
  passengers: number;
  category_pref: AircraftCategory | null;
  aircraft_preference: string | null;
  catering: boolean;
  vehicle: boolean;
  notes: string | null;
  sourcing_radius_nm: number;
  radius_miles: number;
  distanceNm: number;
  categories: AircraftCategory[];
};

const MILES_TO_NM = 0.868976;

export async function loadTrip(tripId: string): Promise<TripContext> {
  const sql = db();
  const [row] = await sql`
    select t.*, o.name as o_name, o.latitude as o_lat, o.longitude as o_lon, o.tz as o_tz,
           d.name as d_name, d.latitude as d_lat, d.longitude as d_lon, d.tz as d_tz
    from trips t
    join airports o on o.icao = t.origin_icao
    join airports d on d.icao = t.destination_icao
    where t.id = ${tripId}`;
  if (!row) throw new Error("trip not found");
  const distanceNm = Math.round(haversineNm(row.o_lat, row.o_lon, row.d_lat, row.d_lon));
  const pref = (row.aircraft_category as AircraftCategory | null) ?? null;
  const radiusMiles = Number(row.search_radius_miles);
  return {
    id: row.id,
    trip_number: row.trip_number,
    origin: { icao: row.origin_icao, name: row.o_name, latitude: row.o_lat, longitude: row.o_lon, tz: row.o_tz },
    destination: { icao: row.destination_icao, name: row.d_name, latitude: row.d_lat, longitude: row.d_lon, tz: row.d_tz },
    depart_at: row.depart_at,
    return_at: row.return_at,
    passengers: row.passengers,
    category_pref: pref,
    aircraft_preference: row.aircraft_preference,
    catering: row.catering_required,
    vehicle: row.vehicle_required,
    notes: row.special_requests,
    sourcing_radius_nm: Math.round(radiusMiles * MILES_TO_NM),
    radius_miles: radiusMiles,
    distanceNm,
    categories: categoriesForTrip(row.passengers, distanceNm, pref),
  };
}

export async function findCandidates(trip: TripContext, limit = 12, opts: { includeProspects?: boolean; excludeOperatorIds?: string[] } = {}): Promise<Candidate[]> {
  const sql = db();
  const includeProspects = opts.includeProspects ?? true;
  const exclude = opts.excludeOperatorIds ?? [];
  const byOp = new Map<string, Candidate & { states: Map<string, number>; nearOrigin: number; nearDest: number }>();
  const ensure = (r: { operator_id: string; name: string; certificate_number: string | null; contact_id: string | null; contact_email: string | null; contact_name: string | null; network_status: string }) => {
    let c = byOp.get(r.operator_id);
    if (!c) {
      c = {
        operator_id: r.operator_id, name: r.name, certificate_number: r.certificate_number,
        contact_id: r.contact_id, contact_email: r.contact_email, contact_name: r.contact_name,
        fleet: [], nearby_now: 0, state_hint: null, network_status: r.network_status, score: 0, reason: "",
        states: new Map(), nearOrigin: Infinity, nearDest: Infinity,
      };
      byOp.set(r.operator_id, c);
    }
    return c;
  };
  const contactJoin = sql`left join lateral (
      select id, email, full_name from operator_contacts
      where operator_id = o.id and unsubscribed_at is null and bounced_at is null
      order by is_primary desc, verified_at desc nulls last, created_at limit 1
    ) c on true`;

  // Network: the company's own operator and aircraft records.
  const network = await sql`
    select o.id as operator_id, o.name, o.certificate_number, o.network_status, o.search_priority, o.base_icaos,
           coalesce(c.email, o.general_email) as contact_email, c.id as contact_id, c.full_name as contact_name,
           a.aircraft_type, a.category, a.passenger_capacity, a.year_mfr, a.tail_number, a.availability_status,
           b.latitude as b_lat, b.longitude as b_lon, b.icao as b_icao
    from operators o
    ${contactJoin}
    left join operator_aircraft a on a.operator_id = o.id
    left join airports b on b.icao = a.home_base_icao
    where o.network_status in ('approved', 'preferred')
      and o.id <> all(${exclude}::uuid[])`;
  const baseAirports = new Map<string, { lat: number; lon: number }>();
  const baseCodes = [...new Set(network.flatMap((r) => (r.base_icaos as string[]) ?? []))];
  if (baseCodes.length) {
    for (const a of await sql`select icao, latitude, longitude from airports where icao = any(${baseCodes})`) {
      baseAirports.set(a.icao, { lat: a.latitude, lon: a.longitude });
    }
  }
  for (const r of network) {
    const c = ensure(r as never);
    (c as unknown as { priority: number }).priority = Number(r.search_priority ?? 0);
    const points: { lat: number; lon: number }[] = [];
    if (r.b_lat != null) points.push({ lat: r.b_lat, lon: r.b_lon });
    for (const code of (r.base_icaos as string[]) ?? []) { const p = baseAirports.get(code); if (p) points.push(p); }
    for (const p of points) {
      c.nearOrigin = Math.min(c.nearOrigin, haversineNm(trip.origin.latitude, trip.origin.longitude, p.lat, p.lon));
      c.nearDest = Math.min(c.nearDest, haversineNm(trip.destination.latitude, trip.destination.longitude, p.lat, p.lon));
    }
    if (r.aircraft_type) {
      const fits = (!r.category || trip.categories.includes(r.category)) && (!r.passenger_capacity || r.passenger_capacity >= trip.passengers)
        && !["maintenance", "unavailable"].includes(r.availability_status);
      if (fits) c.fleet.push({ n_number: r.tail_number ?? "", model: r.aircraft_type, category: r.category ?? "", seats: r.passenger_capacity, year: r.year_mfr });
    }
  }

  // Prospects: FAA Part 135 fleets, located by live ADS-B or registration state.
  if (includeProspects) {
    const rows = await sql`
      select o.id as operator_id, o.name, o.certificate_number, o.network_status,
             c.id as contact_id, coalesce(c.email, o.general_email) as contact_email, c.full_name as contact_name,
             r.n_number, r.model, r.category, r.seats, r.year_mfr, r.registrant_state,
             p.on_ground, p.latitude as p_lat, p.longitude as p_lon
      from operators o
      join registry_aircraft r on r.operator_id = o.id
      ${contactJoin}
      left join aircraft_positions p on p.icao_hex = r.icao_hex and p.seen_at > now() - interval '12 hours'
      where o.network_status = 'prospect'
        and o.outreach_status not in ('do_not_contact', 'declined')
        and o.id <> all(${exclude}::uuid[])
        and r.category = any(${trip.categories}::aircraft_category[])
        and (r.seats is null or r.seats >= ${trip.passengers})`;
    for (const r of rows) {
      if (NON_CHARTER.test(r.name)) continue;
      const c = ensure(r as never);
      c.fleet.push({ n_number: r.n_number, model: r.model, category: r.category, seats: r.seats, year: r.year_mfr });
      if (r.registrant_state) c.states.set(r.registrant_state, (c.states.get(r.registrant_state) ?? 0) + 1);
      if (r.on_ground && r.p_lat != null) {
        const dO = haversineNm(trip.origin.latitude, trip.origin.longitude, r.p_lat, r.p_lon);
        const dD = haversineNm(trip.destination.latitude, trip.destination.longitude, r.p_lat, r.p_lon);
        if (dO <= trip.sourcing_radius_nm || dD <= trip.sourcing_radius_nm) c.nearby_now += 1;
        c.nearOrigin = Math.min(c.nearOrigin, dO);
        c.nearDest = Math.min(c.nearDest, dD);
      }
    }
  }

  const radius = trip.sourcing_radius_nm;
  const out: Candidate[] = [];
  for (const c of byOp.values()) {
    const reasons: string[] = [];
    let score = 0;
    const inNetwork = c.network_status === "approved" || c.network_status === "preferred";
    if (c.network_status === "preferred") { score += 60; reasons.push("preferred operator"); }
    else if (c.network_status === "approved") { score += 40; reasons.push("approved operator"); }
    score += Math.min(Math.max((c as unknown as { priority?: number }).priority ?? 0, 0), 20);
    // Steps 1-3: origin first, then destination, then the wider radius.
    if (c.nearOrigin <= 15) { score += 50; reasons.push(`based at ${trip.origin.icao}`); }
    else if (c.nearOrigin <= radius) { score += 40; reasons.push(`based ${Math.round(c.nearOrigin / MILES_TO_NM)} mi from ${trip.origin.icao}`); }
    else if (c.nearDest <= 15) { score += 30; reasons.push(`based at ${trip.destination.icao}`); }
    else if (c.nearDest <= radius) { score += 25; reasons.push(`based ${Math.round(c.nearDest / MILES_TO_NM)} mi from ${trip.destination.icao}`); }
    else if (inNetwork && Number.isFinite(c.nearOrigin)) reasons.push(`outside the ${trip.radius_miles} mi radius`);
    if (c.nearby_now > 0) { score += 20 + Math.min(c.nearby_now, 5) * 4; reasons.push(`${c.nearby_now} suitable aircraft on the ground nearby now`); }
    let stateNear = false;
    if (!inNetwork) {
      let bestState: string | null = null, bestDist = Infinity;
      for (const [st] of c.states) {
        const cen = STATE_CENTROIDS[st];
        if (!cen) continue;
        const d = haversineNm(trip.origin.latitude, trip.origin.longitude, cen[0], cen[1]);
        if (d < bestDist) { bestDist = d; bestState = st; }
      }
      if (bestState && bestDist <= 400) { score += 10; stateNear = true; reasons.push(`fleet registered in ${bestState}`); }
      c.state_hint = bestState;
    }
    // Step 4: aircraft requirements.
    const fit = c.fleet.length;
    if (inNetwork && fit === 0 && byOp.size > 0) {
      const hasFleet = network.some((r) => r.operator_id === c.operator_id && r.aircraft_type);
      if (hasFleet) continue; // their declared fleet does not fit this trip
      reasons.push("fleet not on file");
    }
    score += Math.min(fit, 6) * 2;
    if (fit) reasons.push(`${fit} fitting aircraft: ${[...new Set(c.fleet.map((f) => f.model))].slice(0, 3).join(", ")}`);
    if (c.contact_email) score += 30; else reasons.push("no contact email yet");
    // Prospects must show some geographic signal to be worth an email: an
    // aircraft on the ground nearby now, or a fleet registered in the region.
    if (!inNetwork && c.nearby_now === 0 && !stateNear) continue;
    c.score = score;
    c.reason = reasons.join("; ");
    const { states, nearOrigin, nearDest, ...rest } = c;
    void states; void nearOrigin; void nearDest;
    out.push(rest);
  }
  out.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return out.slice(0, limit);
}

export function tripSummaryText(trip: TripContext) {
  const fmt = (d: Date) => d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
  return `${trip.trip_number}: ${trip.origin.icao} (${trip.origin.name}) to ${trip.destination.icao} (${trip.destination.name}), ${trip.distanceNm} nm, departing ${fmt(trip.depart_at)}${trip.return_at ? `, returning ${fmt(trip.return_at)}` : ", one way"}, ${trip.passengers} passengers, aircraft ${trip.aircraft_preference ?? (trip.category_pref ? AIRCRAFT_CATEGORY_LABELS[trip.category_pref] : "any suitable")}${trip.catering ? ", catering requested" : ""}${trip.vehicle ? ", ground vehicle requested" : ""}`;
}
