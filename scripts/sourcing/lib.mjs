// Shared helpers for the sourcing scripts (FAA registry import, ADS-B lookups).
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = dirname(fileURLToPath(import.meta.url));
export const CACHE_DIR = join(ROOT, ".cache");
export const OUT_DIR = join(ROOT, "out");
for (const d of [CACHE_DIR, OUT_DIR]) if (!existsSync(d)) mkdirSync(d, { recursive: true });

// Loads apps/web/.env so the scripts share the app's Supabase credentials.
export function loadEnv() {
  const p = join(ROOT, "..", "..", "apps", "web", ".env");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

// Database access. Prefers a direct Postgres connection (DATABASE_URL in
// apps/web/.env, the Supabase session pooler) because the sourcing tables are
// service-role only. Falls back to PostgREST with SUPABASE_SERVICE_ROLE_KEY.
export function supabase() {
  loadEnv();
  if (process.env.DATABASE_URL) return pgBackend(process.env.DATABASE_URL);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set DATABASE_URL, or NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, in apps/web/.env");
  return restBackend(url, key);
}

function pgBackend(dsn) {
  let sqlPromise;
  const sql = async () => (sqlPromise ??= import("postgres").then((m) => m.default(dsn, { max: 2, prepare: false, idle_timeout: 5 })));
  return {
    async upsert(table, rows, conflict) {
      if (!rows.length) return;
      const s = await sql();
      const cols = Object.keys(rows[0]);
      const updates = cols.filter((c) => c !== conflict);
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        await s`insert into ${s(table)} ${s(chunk, cols)} on conflict (${s(conflict)}) do update set ${s.unsafe(updates.map((c) => `"${c}" = excluded."${c}"`).join(", "))}`;
        process.stdout.write(`  ${table}: ${Math.min(i + 500, rows.length)}/${rows.length}\r`);
      }
      process.stdout.write("\n");
    },
    async airport(icao) {
      const s = await sql();
      const [row] = await s`select icao, name, latitude, longitude from airports where icao = ${icao}`;
      return row;
    },
    async operatorIds() {
      const s = await sql();
      return new Map((await s`select id, certificate_number from operators where certificate_number is not null`).map((o) => [o.certificate_number, o.id]));
    },
    // links: [{ n_number, operator_id }]. An UPDATE, not an upsert: Postgres
    // checks not-null constraints on the proposed row before conflict handling.
    async linkOperators(links) {
      const s = await sql();
      for (let i = 0; i < links.length; i += 1000) {
        const chunk = links.slice(i, i + 1000);
        await s`update registry_aircraft r set operator_id = v.operator_id::uuid
                from (values ${s.unsafe(chunk.map((l) => `('${l.n_number.replace(/'/g, "")}', '${l.operator_id}')`).join(","))}) as v(n_number, operator_id)
                where r.n_number = v.n_number`;
      }
    },
    async close() { if (sqlPromise) await (await sql()).end(); },
  };
}

function restBackend(url, key) {
  const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  async function select(table, query) {
    const r = await fetch(`${url}/rest/v1/${table}?${query}`, { headers });
    if (!r.ok) throw new Error(`${table} select failed: ${r.status} ${await r.text()}`);
    return r.json();
  }
  return {
    async upsert(table, rows, onConflict) {
      for (let i = 0; i < rows.length; i += 1000) {
        const chunk = rows.slice(i, i + 1000);
        const r = await fetch(`${url}/rest/v1/${table}?on_conflict=${onConflict}`, {
          method: "POST", headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify(chunk),
        });
        if (!r.ok) throw new Error(`${table} upsert failed: ${r.status} ${await r.text()}`);
        process.stdout.write(`  ${table}: ${Math.min(i + 1000, rows.length)}/${rows.length}\r`);
      }
      process.stdout.write("\n");
    },
    async airport(icao) { return (await select("airports", `icao=eq.${icao}&select=icao,name,latitude,longitude`))[0]; },
    async operatorIds() {
      return new Map((await select("operators", "select=id,certificate_number&certificate_number=not.is.null&limit=10000")).map((o) => [o.certificate_number, o.id]));
    },
    async linkOperators(links) {
      const byOp = new Map();
      for (const l of links) byOp.set(l.operator_id, [...(byOp.get(l.operator_id) ?? []), l.n_number]);
      for (const [operator_id, tails] of byOp) {
        const r = await fetch(`${url}/rest/v1/registry_aircraft?n_number=in.(${tails.map(encodeURIComponent).join(",")})`, {
          method: "PATCH", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ operator_id }),
        });
        if (!r.ok) throw new Error(`link failed: ${r.status} ${await r.text()}`);
      }
    },
    async close() {},
  };
}

// FAA files are comma-delimited with no quoting; trailing comma yields an empty last column.
export function parseFaaCsv(text) {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter(Boolean);
  const header = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    const row = {};
    header.forEach((h, i) => { row[h] = (cells[i] ?? "").trim(); });
    return row;
  });
}

// Heuristic charter category from make/model/seats. Good enough for sourcing
// filters; ops can correct individual rows in the admin.
const RULES = [
  [/KING AIR|PC-12|PC12|TBM|PIAGGIO|P180|CARAVAN|CONQUEST|CHEYENNE|MU-2|TURBO COMMANDER|PILATUS|DAHER|KODIAK|EPIC/, "turboprop"],
  [/MUSTANG|ECLIPSE|HONDAJET|HA-420|VISION|SF50|PHENOM 100|EMB-500|CIRRUS/, "very_light_jet"],
  [/PHENOM 300|EMB-505|CJ[1-4]|525|CITATION M2|BRAVO|ENCORE|LEARJET (31|35|36|40|45|70|75)|BEECHJET|400A|PREMIER|390|NEXTANT|HAWKER 400|PILATUS PC-24|PC-24/, "light_jet"],
  [/XLS|560XL|EXCEL|LEARJET 60|HAWKER (700|750|800|850|900)|HS-125|BAE 125|GATES|LEGACY 450|PRAETOR 500|EMB-545|LATITUDE|680A|CITATION III|650|ASTRA|1125|G100|G150|GALAXY|FALCON (10|20|50|200)/, "midsize_jet"],
  [/SOVEREIGN|680\b|CITATION X|(CESSNA|TEXTRON AVIATION INC) 750|LONGITUDE|(CESSNA|TEXTRON AVIATION INC) 700\b|CHALLENGER (300|350|3500)|BD-100|CL-600-2B16|LEGACY 500|PRAETOR 600|EMB-550|G200|G280|FALCON (2000|900)|HAWKER 4000/, "super_midsize_jet"],
  [/CHALLENGER (600|601|604|605|650)|CL-600-2B16|CL-600-1A11|CL-600-2A12|LEGACY 600|LEGACY 650|EMB-135BJ|FALCON 900|FALCON 50EX|G-IV|GIV|G400|G450|GV-SP|G350|G500\b|GVII-G500|LINEAGE/, "heavy_jet"],
  [/GLOBAL|BD-700|G550|GV\b|G650|GVI|G700|GVIII|G800|GVII-G600|G600|FALCON (7X|8X|6X|10X)|ACJ|BBJ/, "ultra_long_range"],
];
export function categorize(mfr, model, seats, engineType) {
  const s = `${mfr} ${model}`.toUpperCase();
  if (engineType === "turboprop") return "turboprop";
  for (const [re, cat] of RULES) if (re.test(s)) return cat;
  const n = Number(seats) || 0;
  if (n <= 6) return "very_light_jet";
  if (n <= 8) return "light_jet";
  if (n <= 10) return "midsize_jet";
  if (n <= 12) return "super_midsize_jet";
  if (n <= 16) return "heavy_jet";
  return "ultra_long_range";
}

export function registrantKind(name, typeCode) {
  const n = (name || "").toUpperCase();
  if (!n) return "unknown";
  if (/TRUSTEE|TRUST CO|TRUST COMPANY|\bTRUST\b|BANK OF UTAH|WELLS FARGO|WILMINGTON/.test(n)) return "trust";
  if (typeCode === "1") return "individual";
  if (typeCode === "5") return "government";
  if (/LLC|INC|CORP|CO\b|LTD|LP\b|AVIATION|AIR\b|JET|HOLDINGS|PARTNERS|COMPANY/.test(n)) return "company";
  return typeCode === "3" || typeCode === "7" || typeCode === "8" ? "company" : "unknown";
}

export function haversineNm(lat1, lon1, lat2, lon2) {
  const R = 3440.065, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function toCsv(rows) {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n") + "\n";
}
