#!/usr/bin/env node
// Imports the FAA "Certificated Aircraft Operators (Part 135 holders)" list,
// the weekly spreadsheet of every company legally allowed to fly charter and
// the tail numbers on each certificate. This is the operator list: the
// companies we send RFQs to. It has NO contact details; those are enriched
// separately (website lookup, email-finder tools, or the operator signing up).
//
//   node scripts/sourcing/faa-part135.mjs [--db] [--refresh]
//
// Outputs out/part135-operators.csv (one row per certificate holder) and
// out/part135-fleet.csv (one row per tail). With --db: upserts operators
// (keyed by certificate designator) and sets registry_aircraft.operator_id.
import { existsSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { CACHE_DIR, OUT_DIR, toCsv, supabase } from "./lib.mjs";

const args = new Set(process.argv.slice(2));
const XLSX = join(CACHE_DIR, "part135.xlsx");
const URL = "https://www.faa.gov/about/officeorg/headquartersoffices/avs/faa-certificated-aircraft-operators-legal-part-135-holders.xlsx";

// CHDO prefix -> FAA region, a coarse "where is this operator" until we have bases.
const REGION = { EA: "Eastern", GL: "Great Lakes", WP: "Western-Pacific", SW: "Southwest", NM: "Northwest Mountain", AL: "Alaska", SO: "Southern", CE: "Central", NE: "New England", AC: "Alaska" };

async function download() {
  const fresh = existsSync(XLSX) && Date.now() - statSync(XLSX).mtimeMs < 7 * 24 * 3600 * 1000;
  if (fresh && !args.has("--refresh")) return;
  console.log("Downloading FAA Part 135 operator list...");
  const r = await fetch(URL, { headers: { "User-Agent": "Mozilla/5.0 (Macintosh) Jlaero sourcing/0.1" } });
  if (!r.ok) throw new Error(`FAA download failed: ${r.status}`);
  writeFileSync(XLSX, Buffer.from(await r.arrayBuffer()));
}

// Minimal xlsx reader (shared strings + first sheet), no dependencies.
function readSheet() {
  const xml = (name) => execFileSync("unzip", ["-p", XLSX, name], { maxBuffer: 64 * 1024 * 1024 }).toString("utf8");
  const decode = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
  const strings = [...xml("xl/sharedStrings.xml").matchAll(/<si>(.*?)<\/si>/gs)]
    .map((m) => decode([...m[1].matchAll(/<t[^>]*>(.*?)<\/t>/gs)].map((t) => t[1]).join("")));
  const rows = [];
  for (const row of xml("xl/worksheets/sheet1.xml").matchAll(/<row[^>]*>(.*?)<\/row>/gs)) {
    const cells = [];
    for (const c of row[1].matchAll(/<c r="([A-Z]+)\d+"(?:[^>]*t="(\w+)")?[^>]*>(?:<v>(.*?)<\/v>)?/gs)) {
      const col = c[1].split("").reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
      cells[col] = c[2] === "s" ? strings[Number(c[3])] : decode(c[3] ?? "");
    }
    rows.push(cells);
  }
  return rows;
}

function loadRegistry() {
  const p = join(OUT_DIR, "business-aircraft.csv");
  if (!existsSync(p)) return new Map();
  const [head, ...lines] = readFileSync(p, "utf8").trim().split("\n");
  const cols = head.split(",");
  return new Map(lines.map((l) => { const cells = l.split(","); return [cells[0], Object.fromEntries(cols.map((c, i) => [c, cells[i]]))]; }));
}

async function main() {
  await download();
  const [header, ...data] = readSheet();
  const idx = Object.fromEntries(header.map((h, i) => [h.trim(), i]));
  const need = ["CFR", "CHDO", "DSGN", "Name", "Aircraft M/M/S", "Registration No."];
  for (const n of need) if (idx[n] == null) throw new Error(`column ${n} missing; header is ${header.join(" | ")}`);
  const registry = loadRegistry();

  const ops = new Map();
  const fleet = [];
  for (const r of data) {
    const dsgn = (r[idx.DSGN] ?? "").trim(); if (!dsgn) continue;
    const tail = (r[idx["Registration No."]] ?? "").trim().toUpperCase().replace(/^N/, "");
    const reg = registry.get(tail);
    const op = ops.get(dsgn) ?? { certificate_number: dsgn, name: (r[idx.Name] ?? "").trim(), cfr: (r[idx.CFR] ?? "").trim(),
      chdo: (r[idx.CHDO] ?? "").trim(), region: REGION[(r[idx.CHDO] ?? "").slice(0, 2)] ?? "", fleet_size: 0, business_fleet: 0, categories: new Set(), states: new Set(), tails: [] };
    op.fleet_size += 1; op.tails.push(tail);
    if (reg) { op.business_fleet += 1; op.categories.add(reg.category); if (reg.registrant_state) op.states.add(reg.registrant_state); }
    ops.set(dsgn, op);
    fleet.push({ certificate_number: dsgn, operator: op.name, n_number: tail, faa_type: (r[idx["Aircraft M/M/S"]] ?? "").trim(),
      in_registry: !!reg, category: reg?.category ?? "", icao_hex: reg?.icao_hex ?? "", registrant: reg?.registrant_name ?? "" });
  }
  const opRows = [...ops.values()].map((o) => ({ certificate_number: o.certificate_number, name: o.name, cfr: o.cfr, chdo: o.chdo, region: o.region,
    fleet_size: o.fleet_size, business_fleet: o.business_fleet, categories: [...o.categories].sort().join("|"), registrant_states: [...o.states].sort().join("|") }))
    .sort((a, b) => b.business_fleet - a.business_fleet);
  console.log(`Part 135 certificate holders: ${opRows.length}; tails: ${fleet.length}; tails matched to business aircraft: ${fleet.filter((f) => f.in_registry).length}`);
  console.log(`Operators with at least one business jet/turboprop: ${opRows.filter((o) => o.business_fleet > 0).length}`);
  writeFileSync(join(OUT_DIR, "part135-operators.csv"), toCsv(opRows));
  writeFileSync(join(OUT_DIR, "part135-fleet.csv"), toCsv(fleet));
  console.log(`Wrote ${join(OUT_DIR, "part135-operators.csv")} and part135-fleet.csv`);

  if (args.has("--db")) {
    const db = supabase();
    console.log("Upserting operators...");
    const payload = opRows.map((o) => ({ certificate_number: o.certificate_number, name: o.name, fleet_size: o.fleet_size, source: "faa_part135",
      notes: `FAA ${o.cfr}; CHDO ${o.chdo} (${o.region})` }));
    await db.upsert("operators", payload, "certificate_number");
    const ids = await db.operatorIds();
    // A few tails sit on two certificates (affiliated operators); first listing wins.
    const links = new Map();
    for (const f of fleet) if (f.in_registry && ids.has(f.certificate_number) && !links.has(f.n_number)) links.set(f.n_number, { n_number: f.n_number, operator_id: ids.get(f.certificate_number) });
    console.log(`Linking ${links.size} registry aircraft to operators...`);
    await db.linkOperators([...links.values()]);
    await db.close();
    console.log("Done.");
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
