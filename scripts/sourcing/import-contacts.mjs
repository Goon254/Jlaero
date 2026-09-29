#!/usr/bin/env node
// Imports researched operator contacts from a CSV with columns:
//   certificate,charter_desk_email,contact_name,website
// (the targets.csv produced by targets.mjs works as-is once filled in).
//   node scripts/sourcing/import-contacts.mjs scripts/sourcing/out/targets.csv
import { readFileSync } from "node:fs";
import { loadEnv } from "./lib.mjs";

const file = process.argv[2];
if (!file) { console.error("usage: import-contacts.mjs <csv>"); process.exit(1); }
loadEnv();
const { default: postgres } = await import("postgres");
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
const parse = (line) => line.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((c) => c.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"'));
const [head, ...lines] = readFileSync(file, "utf8").trim().split("\n");
const cols = head.split(",");
let added = 0, skipped = 0;
for (const line of lines) {
  const r = Object.fromEntries(cols.map((c, i) => [c, parse(line)[i] ?? ""]));
  const email = (r.charter_desk_email ?? "").trim().toLowerCase();
  if (!email || !r.certificate) { skipped += 1; continue; }
  const [op] = await sql`select id from operators where certificate_number = ${r.certificate}`;
  if (!op) { skipped += 1; continue; }
  await sql`insert into operator_contacts (operator_id, email, full_name, source, is_primary)
    values (${op.id}, ${email}, ${r.contact_name || null}, 'manual', true)
    on conflict (lower(email)) do update set operator_id = excluded.operator_id, full_name = coalesce(excluded.full_name, operator_contacts.full_name)`;
  await sql`update operators set website = coalesce(nullif(${r.website ?? ""}, ''), website), email_domain = coalesce(email_domain, ${email.split("@")[1]}) where id = ${op.id}`;
  added += 1;
}
await sql.end();
console.log(`contacts upserted: ${added}, rows skipped (no email or unknown certificate): ${skipped}`);
