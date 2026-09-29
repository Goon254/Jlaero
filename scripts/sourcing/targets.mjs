#!/usr/bin/env node
// Contact-research target list: the charter operators most worth reaching
// in each launch region, ranked by fitting business fleet. Output goes to
// out/targets.csv for whoever is researching websites and charter-desk
// emails (or for an email-finder tool run against the operator's domain).
//
//   node scripts/sourcing/targets.mjs [--per-region 40]
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { OUT_DIR, toCsv, supabase } from "./lib.mjs";

const REGIONS = {
  "New York metro": ["NY", "NJ", "CT", "PA", "DE"],
  "South Florida": ["FL"],
  "Southern California": ["CA", "NV", "AZ"],
  "Texas": ["TX", "OK"],
  "Chicago": ["IL", "WI", "IN", "MI", "OH"],
};
const NON_CHARTER = /netjets|flexjet|ameriflight|guardian flight|air methods|reach air|life ?flight|med ?flight|medical|ambulance|cargo|freight|express|airlines?\b|airways|fedex|ups\b|wheels up|jet linx|vista|xo\b|flyexclusive|drone|anduril|top aces|draken|tactical|parts/i;
const per = Number(process.argv[process.argv.indexOf("--per-region") + 1]) || 40;

const db = supabase();
const { default: postgres } = await import("postgres");
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
const rows = await sql`
  select o.id, o.name, o.certificate_number, o.website, o.email_domain, o.outreach_status,
         r.registrant_state as state, r.category, count(*) as n
  from operators o join registry_aircraft r on r.operator_id = o.id
  where r.category <> 'turboprop' or r.seats >= 6
  group by o.id, o.name, o.certificate_number, o.website, o.email_domain, o.outreach_status, r.registrant_state, r.category`;
await sql.end(); await db.close();

const out = [];
for (const [region, states] of Object.entries(REGIONS)) {
  const byOp = new Map();
  for (const r of rows) {
    if (!states.includes(r.state) || NON_CHARTER.test(r.name)) continue;
    const o = byOp.get(r.id) ?? { region, operator: r.name, certificate: r.certificate_number, website: r.website ?? "", email_domain: r.email_domain ?? "", status: r.outreach_status, fleet_in_region: 0, categories: new Set(), states: new Set() };
    o.fleet_in_region += Number(r.n); o.categories.add(r.category); o.states.add(r.state);
    byOp.set(r.id, o);
  }
  const list = [...byOp.values()].sort((a, b) => b.fleet_in_region - a.fleet_in_region).slice(0, per)
    .map((o) => ({ ...o, categories: [...o.categories].sort().join("|"), states: [...o.states].sort().join("|"), charter_desk_email: "", contact_name: "", notes: "" }));
  console.log(`${region}: ${byOp.size} operators, top ${list.length} listed`);
  out.push(...list);
}
const file = join(OUT_DIR, "targets.csv");
writeFileSync(file, toCsv(out));
console.log(`Wrote ${file} (${out.length} rows). Fill charter_desk_email and import with import-contacts.mjs.`);
