import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AIRCRAFT_CATEGORY_LABELS,
  CRUISE_SPEEDS_KTS,
  estimateFlightHours,
  haversineNm,
  type AircraftCategory,
} from "@jlaero/shared";
import { PageShell } from "@/components/PageShell";
import { createClient } from "@/lib/supabase/server";

// Programmatic SEO pages: /routes/teb-to-pbi (IATA) or /routes/kteb-to-kpbi.
// Primary organic channel for charter (ROADMAP P13).

type Airport = {
  icao: string;
  iata: string | null;
  name: string;
  municipality: string | null;
  latitude: number;
  longitude: number;
};

async function resolveRoute(slug: string): Promise<{ from: Airport; to: Airport } | null> {
  const m = slug.toLowerCase().match(/^([a-z0-9]{3,4})-to-([a-z0-9]{3,4})$/);
  if (!m) return null;
  const [_, a, b] = m;
  const supabase = await createClient();
  const find = async (code: string) => {
    const { data } = await supabase
      .from("airports")
      .select("icao, iata, name, municipality, latitude, longitude")
      .or(`iata.eq.${code},icao.eq.${code},ident.eq.${code}`)
      .limit(1);
    return (data?.[0] as Airport | undefined) ?? null;
  };
  const lookup = async (code: string) => {
    const upper = code!.toUpperCase();
    // Direct match, then the US convention fallback (PBI -> KPBI) which also
    // catches renamed airports whose historic code lives in `ident`.
    return (
      (await find(upper)) ??
      (upper.length === 3 ? await find(`K${upper}`) : null)
    );
  };
  const from = await lookup(a!);
  const to = await lookup(b!);
  if (!from || !to || from.icao === to.icao) return null;
  return { from, to };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ route: string }>;
}): Promise<Metadata> {
  const { route } = await params;
  const resolved = await resolveRoute(route);
  if (!resolved) return { title: "Route | Jlaero" };
  const fromCity = resolved.from.municipality ?? resolved.from.name;
  const toCity = resolved.to.municipality ?? resolved.to.name;
  return {
    title: `Private jet charter ${fromCity} to ${toCity} | Jlaero`,
    description: `Charter a private jet from ${fromCity} (${resolved.from.iata ?? resolved.from.icao}) to ${toCity} (${resolved.to.iata ?? resolved.to.icao}). Compare verified operators, itemized quotes, and empty-leg deals on Jlaero.`,
  };
}

export default async function RoutePage({
  params,
}: {
  params: Promise<{ route: string }>;
}) {
  const { route } = await params;
  const resolved = await resolveRoute(route);
  if (!resolved) notFound();
  const { from, to } = resolved;

  const distance = Math.round(
    haversineNm(from.latitude, from.longitude, to.latitude, to.longitude)
  );
  const fromCity = from.municipality ?? from.name;
  const toCity = to.municipality ?? to.name;

  const categories: AircraftCategory[] = [
    "light_jet",
    "midsize_jet",
    "super_midsize_jet",
    "heavy_jet",
  ];

  const supabase = await createClient();
  const { data: aircraft } = await supabase
    .from("aircraft")
    .select("id, name, category, seats, hourly_rate, home_base, range_nm")
    .eq("status", "active")
    .limit(50);
  const capable = (aircraft ?? []).filter(
    (a) => !a.range_nm || a.range_nm >= distance
  );

  const searchHref = `/charter?origin=${from.icao}&destination=${to.icao}`;

  return (
    <PageShell
      title={`Private jet charter: ${fromCity} → ${toCity}`}
      subtitle={`${from.name} (${from.iata ?? from.icao}) to ${to.name} (${to.iata ?? to.icao}) · about ${distance.toLocaleString()} nm`}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Service",
            name: `Private jet charter ${fromCity} to ${toCity}`,
            provider: { "@type": "Organization", name: "Jlaero" },
            areaServed: [fromCity, toCity],
            serviceType: "Private jet charter",
          }),
        }}
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {categories.map((c) => {
          const hours = estimateFlightHours(distance, c);
          const feasible = distance <= 4500 || c === "heavy_jet";
          if (!feasible) return null;
          return (
            <div key={c} className="rounded-2xl border border-slate-800 bg-ink-soft p-5">
              <p className="font-semibold">{AIRCRAFT_CATEGORY_LABELS[c]}</p>
              <p className="mt-1 text-2xl font-semibold text-gold">
                ~{Math.floor(hours)}h {Math.round((hours % 1) * 60)}m
              </p>
              <p className="mt-1 text-xs text-slate-500">
                est. flight time at ~{CRUISE_SPEEDS_KTS[c]} kts
              </p>
            </div>
          );
        })}
      </section>

      <div className="mt-8">
        <Link
          href={searchHref}
          className="inline-block rounded-full bg-gold px-8 py-3 font-medium text-ink hover:bg-gold-light"
        >
          See available aircraft for this route
        </Link>
      </div>

      {capable.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 font-semibold">
            Aircraft on Jlaero that can fly this route
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {capable.slice(0, 6).map((a) => (
              <li key={a.id}>
                <Link
                  href={`/charter/${a.id}`}
                  className="flex items-center justify-between rounded-xl border border-slate-800 bg-ink-soft px-4 py-3 text-sm hover:border-gold"
                >
                  <span>
                    {a.name}
                    <span className="ml-2 text-slate-500">
                      {a.seats ? `${a.seats} seats` : ""}
                    </span>
                  </span>
                  {a.hourly_rate && (
                    <span className="text-gold">
                      ${Number(a.hourly_rate).toLocaleString()}/hr
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10 max-w-2xl space-y-3 text-sm leading-relaxed text-slate-400">
        <h2 className="font-semibold text-slate-200">
          Chartering from {fromCity} to {toCity}
        </h2>
        <p>
          The great-circle distance from {from.name} to {to.name} is about{" "}
          {distance.toLocaleString()} nautical miles. On Jlaero you request the
          exact aircraft you want, receive an itemized quote from its verified
          operator (including US Federal Excise Tax where applicable),
          negotiate in-app, sign the charter agreement electronically, and pay
          securely. Watch the empty-legs board for fixed-price repositioning
          flights on this route at significant discounts.
        </p>
      </section>
    </PageShell>
  );
}
