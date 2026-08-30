#!/usr/bin/env node
// Seeds a demo operator with published aircraft via the public Supabase APIs.
// Safe to re-run: signs in if the account exists, skips aircraft it already
// created. Usage: node scripts/seed.mjs
import { deflateSync } from "node:zlib";

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://ncxieabeqtwkomvzykul.supabase.co";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "sb_publishable_2cMIl5ZFEbtDl-xMKOIovg_6DNNbXdD";
const EMAIL = "demo.operator@jlaero.com";
const PASSWORD = "DemoOperator2026!";

const AIRCRAFT = [
  {
    name: "Gulfstream G550 · N550JL",
    manufacturer: "Gulfstream", model: "G550", year: 2016,
    category: "ultra_long_range", seats: 14, tail_number: "N550JL",
    home_base: "KTEB", hourly_rate: 9500, daily_minimum_hours: 2,
    overnight_crew_fee: 1200, range_nm: 6750, min_runway_ft: 5000,
    argus_rating: "Platinum", wyvern_rating: "Wingman",
    cancellation_tier: "moderate", instant_book: true,
    description: "Flagship ultra-long-range cabin with forward crew rest, full galley, and Ka-band wifi. Typical missions: transatlantic and coast-to-coast.",
    color: [24, 52, 94],
  },
  {
    name: "Citation XLS+ · N42XL",
    manufacturer: "Cessna", model: "Citation XLS+", year: 2019,
    category: "midsize_jet", seats: 9, tail_number: "N42XL",
    home_base: "KVNY", hourly_rate: 4200, daily_minimum_hours: 2,
    overnight_crew_fee: 800, range_nm: 2100, min_runway_ft: 3600,
    argus_rating: "Gold", cancellation_tier: "flexible",
    description: "The workhorse of West Coast charter. Club seating for seven plus belted lav, WiFi, and generous baggage.",
    color: [94, 63, 24],
  },
  {
    name: "Phenom 300E · N300PB",
    manufacturer: "Embraer", model: "Phenom 300E", year: 2021,
    category: "light_jet", seats: 7, tail_number: "N300PB",
    home_base: "KPBI", hourly_rate: 3400, daily_minimum_hours: 1.5,
    range_nm: 2010, min_runway_ft: 3200, wyvern_rating: "Registered",
    cancellation_tier: "moderate", instant_book: true,
    description: "Best-in-class light jet out of Palm Beach. Florida to the Northeast nonstop with the lowest cabin altitude in its class.",
    color: [24, 94, 66],
  },
  {
    name: "Global 6000 · N600GX",
    manufacturer: "Bombardier", model: "Global 6000", year: 2015,
    category: "ultra_long_range", seats: 13, tail_number: "N600GX",
    home_base: "KJFK", hourly_rate: 10800, daily_minimum_hours: 2.5,
    overnight_crew_fee: 1500, range_nm: 6000, min_runway_ft: 5400,
    argus_rating: "Gold+", is_bao_stage: "Stage 2",
    cancellation_tier: "strict",
    description: "Three-zone cabin with stateroom, conference grouping, and full crew rest. New York to Europe or the Middle East nonstop.",
    color: [70, 24, 94],
  },
  {
    name: "King Air 350i · N350KA",
    manufacturer: "Beechcraft", model: "King Air 350i", year: 2018,
    category: "turboprop", seats: 9, tail_number: "N350KA",
    home_base: "KDAL", hourly_rate: 1900, daily_minimum_hours: 1.5,
    range_nm: 1800, min_runway_ft: 3300, cancellation_tier: "flexible",
    description: "Texas regional missions and short strips. The most economical way to move a team around the Southwest.",
    color: [94, 24, 40],
  },
];

// Minimal solid-color PNG generator (no dependencies).
function crc32(buf) {
  let c, table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function solidPng(w, h, [r, g, b]) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(w * 3)]);
  for (let x = 0; x < w; x++) { row[1 + x * 3] = r; row[2 + x * 3] = g; row[3 + x * 3] = b; }
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

async function api(path, options = {}, token = ANON) {
  const res = await fetch(`${URL_BASE}${path}`, {
    ...options,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${token}`,
      "Content-Type": options.contentType ?? "application/json",
      ...(options.headers ?? {}),
    },
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (!res.ok) throw new Error(`${path} -> ${res.status}: ${text.slice(0, 300)}`);
  return json;
}

async function main() {
  // 1. Sign up or sign in the demo operator
  let session;
  try {
    session = await api("/auth/v1/signup", {
      method: "POST",
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
  } catch {
    session = await api("/auth/v1/token?grant_type=password", {
      method: "POST",
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
  }
  const token = session.access_token;
  const userId = session.user?.id ?? session.id;
  if (!token || !userId) throw new Error("no session for demo operator");
  console.log(`demo operator: ${userId}`);

  // 2. Profile + owner role
  await api(`/rest/v1/profiles?id=eq.${userId}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      full_name: "Alex Demo",
      company_name: "Jlaero Demo Aviation",
      account_type: "business",
      home_base: "KTEB",
      bio: "Demo operator account seeded for development. Part 135 charter across the US with a mixed fleet from turboprops to ultra-long-range.",
    }),
  }, token);
  await api("/rest/v1/user_roles", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify([{ user_id: userId, role: "owner" }]),
  }, token);

  // 3. Aircraft
  const existing = await api(
    `/rest/v1/aircraft?owner_id=eq.${userId}&select=tail_number`,
    {},
    token
  );
  const have = new Set((existing ?? []).map((a) => a.tail_number));

  for (const spec of AIRCRAFT) {
    if (have.has(spec.tail_number)) {
      console.log(`skip ${spec.tail_number} (exists)`);
      continue;
    }
    const { color, ...fields } = spec;
    const [aircraft] = await api("/rest/v1/aircraft", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify([{ ...fields, owner_id: userId, status: "draft" }]),
    }, token);

    // photos: cover + one alternate shade
    for (let i = 0; i < 2; i++) {
      const shade = color.map((c) => Math.min(255, c + i * 35));
      const png = solidPng(640, 360, shade);
      const path = `${userId}/${aircraft.id}/seed-${i}.png`;
      await api(`/storage/v1/object/aircraft-photos/${path}`, {
        method: "POST",
        contentType: "image/png",
        body: png,
      }, token);
      await api("/rest/v1/aircraft_photos", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify([{ aircraft_id: aircraft.id, file_path: path, position: i }]),
      }, token);
    }

    await api(`/rest/v1/aircraft?id=eq.${aircraft.id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status: "active" }),
    }, token);
    console.log(`seeded ${spec.name}`);
  }

  console.log("done");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
