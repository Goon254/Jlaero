#!/usr/bin/env node
// Imports the FAA Releasable Aircraft database (public, free, refreshed daily)
// and reduces it to US business aircraft: turbofan/turbojet jets with <= 19
// seats plus turboprops. Output: scripts/sourcing/out/business-aircraft.csv.
// With --db, upserts into registry_aircraft (needs SUPABASE_SERVICE_ROLE_KEY).
//
//   node scripts/sourcing/faa-registry.mjs [--db] [--refresh] [--no-turboprops]
//
// What this data gives: tail number, Mode S hex (for ADS-B position lookup),
// make/model, seats, year, registrant name + mailing address.
// What it does NOT give: emails, phones, or who operates the aircraft for
// charter. Registrant is often a trust or an owner's LLC; the charter operator
// (Part 135 certificate holder) is mapped separately into `operators`.
import { existsSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { CACHE_DIR, OUT_DIR, parseFaaCsv, categorize, registrantKind, toCsv, supabase } from "./lib.mjs";

const args = new Set(process.argv.slice(2));
const ZIP = join(CACHE_DIR, "ReleasableAircraft.zip");
const URL = "https://registry.faa.gov/database/ReleasableAircraft.zip";

async function download() {
  const fresh = existsSync(ZIP) && Date.now() - statSync(ZIP).mtimeMs < 24 * 3600 * 1000;
  if (fresh && !args.has("--refresh")) return;
  console.log("Downloading FAA registry (about 75 MB)...");
  // registry.faa.gov rejects the default fetch user agent with 403.
  const r = await fetch(URL, { headers: { "User-Agent": "Mozilla/5.0 (Macintosh) Jlaero sourcing/0.1" } });
  if (!r.ok) throw new Error(`FAA download failed: ${r.status}`);
  writeFileSync(ZIP, Buffer.from(await r.arrayBuffer()));
  execFileSync("unzip", ["-o", "-q", ZIP, "MASTER.txt", "ACFTREF.txt", "-d", CACHE_DIR]);
}

const ENGINE = { 2: "turboprop", 4: "turbojet", 5: "turbofan" };

async function main() {
  await download();
  if (!existsSync(join(CACHE_DIR, "MASTER.txt"))) execFileSync("unzip", ["-o", "-q", ZIP, "MASTER.txt", "ACFTREF.txt", "-d", CACHE_DIR]);
  const ref = new Map();
  for (const r of parseFaaCsv(readFileSync(join(CACHE_DIR, "ACFTREF.txt"), "utf8"))) ref.set(r["CODE"], r);
  const master = parseFaaCsv(readFileSync(join(CACHE_DIR, "MASTER.txt"), "utf8"));
  console.log(`Registry rows: ${master.length}, type refs: ${ref.size}`);

  const rows = [];
  for (const r of master) {
    const a = ref.get(r["MFR MDL CODE"]);
    if (!a) continue;
    const engine = ENGINE[a["TYPE-ENG"]];
    if (!engine || !["4", "5"].includes(a["TYPE-ACFT"])) continue;   // fixed wing only
    if (engine === "turboprop" && args.has("--no-turboprops")) continue;
    const seats = Number(a["NO-SEATS"]) || null;
    if (seats && seats > 19) continue;                                 // airliners out
    const mfr = a["MFR"], model = a["MODEL"];
    if (/^(BOEING|AIRBUS)$/.test(mfr) && !/BBJ|ACJ/.test(model)) continue;
    if (!r["MODE S CODE HEX"]) continue;
    rows.push({
      n_number: r["N-NUMBER"],
      icao_hex: r["MODE S CODE HEX"].toLowerCase(),
      serial_number: r["SERIAL NUMBER"] || null,
      mfr_model_code: r["MFR MDL CODE"],
      manufacturer: mfr, model,
      category: categorize(mfr, model, seats, engine),
      seats, year_mfr: Number(r["YEAR MFR"]) || null,
      engine_type: engine,
      registrant_name: r["NAME"] || null,
      registrant_kind: registrantKind(r["NAME"], r["TYPE REGISTRANT"]),
      registrant_city: r["CITY"] || null, registrant_state: r["STATE"] || null,
      registrant_zip: r["ZIP CODE"] || null, registrant_country: r["COUNTRY"] || null,
      status_code: r["STATUS CODE"] || null,
    });
  }
  const byCat = {}, byKind = {};
  for (const x of rows) { byCat[x.category] = (byCat[x.category] ?? 0) + 1; byKind[x.registrant_kind] = (byKind[x.registrant_kind] ?? 0) + 1; }
  console.log(`Business aircraft: ${rows.length}`);
  console.table(byCat); console.table(byKind);

  const out = join(OUT_DIR, "business-aircraft.csv");
  writeFileSync(out, toCsv(rows));
  console.log(`Wrote ${out}`);

  if (args.has("--db")) {
    const db = supabase();
    console.log("Upserting into registry_aircraft...");
    await db.upsert("registry_aircraft", rows, "n_number");
    await db.close();
    console.log("Done.");
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
