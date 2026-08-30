import Link from "next/link";
import { AIRCRAFT_CATEGORY_LABELS, type AircraftCategory } from "@jlaero/shared";
import { PageShell } from "@/components/PageShell";
import { publicPhotoUrl } from "@/lib/storage";
import { searchCharter } from "@/lib/searchCharter";

export default async function CharterSearch({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const { SearchForm } = await import("./SearchForm");

  const { results, tripDistanceNm } = await searchCharter({
    origin: params.origin || undefined,
    destination: params.destination || undefined,
    date: params.date || undefined,
    return_date: params.return_date || undefined,
    pax: params.pax ? Number(params.pax) : undefined,
    category: params.category || undefined,
    max_hourly: params.max_hourly ? Number(params.max_hourly) : undefined,
  });

  const hasQuery = Boolean(
    params.origin || params.destination || params.date || params.pax || params.category
  );

  return (
    <PageShell
      title="Charter a jet"
      subtitle="Search available private aircraft. Request a quote, negotiate in-app, fly."
    >
      <SearchForm defaults={params} />

      {tripDistanceNm && (
        <p className="mt-4 text-sm text-slate-400">
          Trip distance: about {tripDistanceNm.toLocaleString()} nm. Aircraft
          without the range or runway for this trip are hidden.
        </p>
      )}

      <section className="mt-8">
        {!results.length ? (
          <div className="rounded-2xl border border-dashed border-slate-700 p-12 text-center text-slate-400">
            {hasQuery
              ? "No aircraft match this trip yet. Try widening the dates or removing filters."
              : "No active listings yet. Are you an operator? List your aircraft in minutes."}
            <div className="mt-4">
              <Link href="/list" className="text-gold hover:underline">
                List your aircraft →
              </Link>
            </div>
          </div>
        ) : (
          <ul className="grid gap-6 md:grid-cols-2">
            {results.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/charter/${a.id}`}
                  className="block overflow-hidden rounded-2xl border border-slate-800 bg-ink-soft transition hover:border-gold"
                >
                  <div className="aspect-[16/9] bg-slate-900">
                    {a.cover_path ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={publicPhotoUrl("aircraft-photos", a.cover_path)}
                        alt={a.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-slate-600">
                        No photo
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="font-semibold">{a.name}</h2>
                        <p className="text-sm text-slate-400">
                          {[a.manufacturer, a.model].filter(Boolean).join(" ")}
                          {a.category
                            ? ` · ${AIRCRAFT_CATEGORY_LABELS[a.category as AircraftCategory] ?? a.category}`
                            : ""}
                        </p>
                      </div>
                      {a.hourly_rate && (
                        <p className="shrink-0 text-right">
                          <span className="font-semibold text-gold">
                            ${Number(a.hourly_rate).toLocaleString()}
                          </span>
                          <span className="text-xs text-slate-500">/hr</span>
                        </p>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      {a.seats && <Badge>{a.seats} seats</Badge>}
                      {a.home_base && <Badge>{a.home_base}</Badge>}
                      {a.distance_from_origin_nm != null && (
                        <Badge>{a.distance_from_origin_nm} nm from origin</Badge>
                      )}
                      {a.argus_rating && <Badge gold>ARGUS {a.argus_rating}</Badge>}
                      {a.wyvern_rating && <Badge gold>Wyvern {a.wyvern_rating}</Badge>}
                      {a.instant_book && <Badge gold>Instant book</Badge>}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  );
}

function Badge({ children, gold = false }: { children: React.ReactNode; gold?: boolean }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 ${
        gold ? "bg-gold/15 text-gold" : "bg-slate-800 text-slate-300"
      }`}
    >
      {children}
    </span>
  );
}
