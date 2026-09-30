import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Refreshes aircraft_positions for charter-operator aircraft only. Polls one
// ADS-B point query per region: the fixed launch metros plus the origin of
// every trip still being sourced. Runs every 10 minutes (vercel.json) with the
// CRON_SECRET bearer token Vercel sends.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LAUNCH_REGIONS: { icao: string; radius: number }[] = [
  { icao: "KTEB", radius: 60 },  // New York metro
  { icao: "KPBI", radius: 80 },  // South Florida
  { icao: "KVNY", radius: 70 },  // Los Angeles
  { icao: "KDAL", radius: 80 },  // Dallas
  { icao: "KPWK", radius: 60 },  // Chicago
];

type Feed = { hex?: string; r?: string; lat?: number; lon?: number; alt_baro?: number | "ground"; gs?: number };

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sql = db();
  const open = await sql`select distinct origin_icao as icao, round(search_radius_miles * 0.869) as radius from trips
    where status in ('new_request', 'searching', 'quotes_received', 'broker_review', 'operational_issue', 'replacement_search')`;
  const regions = new Map<string, number>();
  for (const r of [...LAUNCH_REGIONS, ...open]) regions.set(r.icao, Math.max(regions.get(r.icao) ?? 0, Math.min(Number(r.radius), 250)));

  const airports = await sql`select icao, latitude, longitude from airports where icao = any(${[...regions.keys()]})`;
  const tracked = new Set((await sql`select icao_hex from registry_aircraft where operator_id is not null`).map((r) => r.icao_hex as string));

  let stored = 0;
  const seenAt = new Date();
  for (const ap of airports) {
    const radius = regions.get(ap.icao)!;
    let ac: Feed[] = [];
    try {
      const res = await fetch(`https://api.adsb.lol/v2/point/${ap.latitude}/${ap.longitude}/${radius}`, {
        headers: { "User-Agent": "jlaero-sourcing/0.1" }, signal: AbortSignal.timeout(15000),
      });
      if (res.ok) ac = ((await res.json()) as { ac?: Feed[] }).ac ?? [];
    } catch (e) {
      console.warn("adsb fetch failed", ap.icao, String(e));
      continue;
    }
    const rows = ac
      .filter((a) => a.hex && tracked.has(a.hex.toLowerCase()) && a.lat != null && a.lon != null)
      .map((a) => ({
        icao_hex: a.hex!.toLowerCase(),
        n_number: a.r?.replace(/^N/, "") ?? null,
        latitude: a.lat!, longitude: a.lon!,
        on_ground: a.alt_baro === "ground",
        altitude_ft: typeof a.alt_baro === "number" ? a.alt_baro : null,
        ground_speed_kt: a.gs ?? null,
        seen_at: seenAt, source: "adsb.lol",
      }));
    if (!rows.length) continue;
    await sql`insert into aircraft_positions ${sql(rows, "icao_hex", "n_number", "latitude", "longitude", "on_ground", "altitude_ft", "ground_speed_kt", "seen_at", "source")}
      on conflict (icao_hex) do update set n_number = excluded.n_number, latitude = excluded.latitude, longitude = excluded.longitude,
        on_ground = excluded.on_ground, altitude_ft = excluded.altitude_ft, ground_speed_kt = excluded.ground_speed_kt,
        seen_at = excluded.seen_at, source = excluded.source, updated_at = now()`;
    stored += rows.length;
  }
  // Nearest airport with a usable runway for anything on the ground this pass.
  await sql`update aircraft_positions p set nearest_icao = n.icao, nearest_nm = n.dist
    from lateral (
      select a.icao, 3440.065 * acos(least(1.0, cos(radians(p.latitude)) * cos(radians(a.latitude)) * cos(radians(a.longitude) - radians(p.longitude)) + sin(radians(p.latitude)) * sin(radians(a.latitude)))) as dist
      from airports a
      where a.latitude between p.latitude - 0.5 and p.latitude + 0.5 and a.longitude between p.longitude - 0.6 and p.longitude + 0.6
        and coalesce(a.longest_runway_ft, 0) >= 3000
      order by dist limit 1
    ) n
    where p.seen_at = ${seenAt} and p.on_ground`;
  return NextResponse.json({ ok: true, regions: airports.length, stored });
}
