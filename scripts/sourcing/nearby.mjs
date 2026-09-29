#!/usr/bin/env node
// "Which business aircraft are near this airport right now?"
// Pulls live ADS-B positions from a community feed (adsb.lol; airplanes.live as fallback),
// joins them to the FAA-derived registry list, and prints those on the ground
// or airborne within the radius. With --db, writes the positions into
// aircraft_positions so nearby_available_aircraft(icao) can answer the same
// question from Postgres.
//
//   node scripts/sourcing/nearby.mjs KTEB [radiusNm=50] [--db] [--all]
//
// Caveats (see docs/sourcing-research.md): aircraft in hangars do not transmit;
// community feeds have coverage gaps outside metro areas; FAA LADD-blocked
// aircraft ARE visible on these feeds, which is a policy question for us.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { OUT_DIR, haversineNm, supabase } from "./lib.mjs";

const [icao, radiusArg, ...rest] = process.argv.slice(2);
const flags = new Set([radiusArg, ...rest].filter((x) => x?.startsWith("--")));
const radius = Number(radiusArg && !radiusArg.startsWith("--") ? radiusArg : 50);
if (!icao) { console.error("usage: nearby.mjs KTEB [radiusNm] [--db] [--all]"); process.exit(1); }

// Feed choice is a licensing question, not just uptime. adsb.lol publishes its
// data under ODbL (commercial use not prohibited); airplanes.live is silent.
// adsb.fi and OpenSky forbid commercial use without a license, so they are
// deliberately not listed. The licensed upgrade path is FlightAware AeroAPI
// (from $100/mo) or an ADS-B Exchange enterprise contract.
const FEEDS = [
  { name: "adsb.lol", url: (lat, lon, r) => `https://api.adsb.lol/v2/point/${lat}/${lon}/${r}` },
  { name: "airplanes.live", url: (lat, lon, r) => `https://api.airplanes.live/v2/point/${lat}/${lon}/${r}` },
];

function loadRegistry() {
  const p = join(OUT_DIR, "business-aircraft.csv");
  if (!existsSync(p)) throw new Error("Run faa-registry.mjs first (missing out/business-aircraft.csv)");
  const [head, ...lines] = readFileSync(p, "utf8").trim().split("\n");
  const cols = head.split(",");
  const map = new Map();
  for (const line of lines) {
    // registry CSV has no embedded commas except quoted names; cheap parse is fine here
    const cells = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((c) => c.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"'));
    const row = Object.fromEntries(cols.map((c, i) => [c, cells[i]]));
    map.set(row.icao_hex, row);
  }
  return map;
}

async function airport(db, code) {
  const row = await db.airport(code);
  if (!row) throw new Error(`airport ${code} not in airports table`);
  return row;
}

async function fetchFeed(lat, lon, r) {
  for (const f of FEEDS) {
    try {
      const res = await fetch(f.url(lat, lon, r), { headers: { "User-Agent": "jlaero-sourcing/0.1" } });
      if (!res.ok) throw new Error(String(res.status));
      const d = await res.json();
      return { source: f.name, ac: d.ac ?? d.aircraft ?? [] };
    } catch (e) { console.warn(`${f.name} failed (${e.message}), trying next`); }
  }
  throw new Error("all ADS-B feeds failed");
}

async function main() {
  const db = supabase();
  const ap = await airport(db, icao.toUpperCase());
  const registry = loadRegistry();
  const { source, ac } = await fetchFeed(ap.latitude, ap.longitude, radius);
  const seenAt = new Date().toISOString();
  const hits = [];
  for (const a of ac) {
    const reg = registry.get((a.hex ?? "").toLowerCase());
    if (!reg || a.lat == null) continue;
    const onGround = a.alt_baro === "ground";
    if (!onGround && !flags.has("--all")) continue;
    hits.push({
      tail: `N${reg.n_number}`, hex: reg.icao_hex, type: `${reg.manufacturer} ${reg.model}`.slice(0, 32),
      category: reg.category, seats: reg.seats, on_ground: onGround,
      dist_nm: haversineNm(ap.latitude, ap.longitude, a.lat, a.lon).toFixed(1),
      registrant: (reg.registrant_name || "(withheld)").slice(0, 30),
      lat: a.lat, lon: a.lon, alt: a.alt_baro, gs: a.gs,
    });
  }
  hits.sort((x, y) => x.dist_nm - y.dist_nm);
  console.log(`${ap.icao} ${ap.name}: ${ac.length} aircraft within ${radius} nm via ${source}; ${hits.length} business aircraft${flags.has("--all") ? "" : " on the ground"}`);
  console.table(hits.map(({ lat, lon, alt, gs, hex, ...r }) => r));

  if (flags.has("--db")) {
    const rows = hits.map((h) => ({
      icao_hex: h.hex, n_number: h.tail.slice(1), latitude: h.lat, longitude: h.lon, on_ground: h.on_ground,
      altitude_ft: typeof h.alt === "number" ? h.alt : null, ground_speed_kt: h.gs ?? null,
      nearest_icao: h.on_ground && Number(h.dist_nm) < 3 ? ap.icao : null, nearest_nm: h.dist_nm,
      seen_at: seenAt, source,
    }));
    await db.upsert("aircraft_positions", rows, "icao_hex");
    console.log(`Stored ${rows.length} positions.`);
  }
  await db.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
