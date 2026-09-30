import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { formatLocal, type TripStatus } from "@jlaero/shared";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ClientShell } from "@/components/lux/ClientShell";
import { TripStatusPill } from "@/components/lux/status";
import { ButtonLink, EmptyState, PageHeader, Pill } from "@/components/lux/ui";
import { airportCode, loadAirports, type ClientTrip } from "./_lib/data";
import { CLIENT_ACTION, CLIENT_NEXT } from "./_lib/copy";

export const metadata = { title: "My trips | Jlaero" };

export default async function TripsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/trips");
  const supabase = await createClient();
  const { data } = await supabase
    .from("trips")
    .select("id, trip_number, status, origin_icao, destination_icao, depart_at, return_at, passengers, created_at")
    .order("depart_at", { ascending: false });
  const trips = (data ?? []) as ClientTrip[];
  const airports = await loadAirports(trips.flatMap((t) => [t.origin_icao, t.destination_icao]));
  const done = (s: TripStatus) => ["completed", "feedback_requested", "closed", "cancelled"].includes(s);
  const upcoming = trips.filter((t) => !done(t.status)).reverse();
  const past = trips.filter((t) => done(t.status));

  return (
    <ClientShell>
      <PageHeader eyebrow="My trips" title="Your trips" actions={<ButtonLink href="/request">Request a Charter</ButtonLink>} />
      {!trips.length ? (
        <EmptyState
          title="No trips yet"
          body="Tell us where you would like to go. We will send up to three aircraft options, usually the same day."
          action={<ButtonLink href="/request">Request a Charter</ButtonLink>}
        />
      ) : (
        <div className="space-y-10">
          {[{ label: "Upcoming and in progress", list: upcoming }, { label: "Past", list: past }].filter((g) => g.list.length).map((g) => (
            <section key={g.label} aria-labelledby={`h-${g.label}`}>
              <h2 id={`h-${g.label}`} className="mb-3 font-display text-xl font-semibold">{g.label}</h2>
              <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
                {g.list.map((t) => {
                  const o = airports[t.origin_icao] ?? null;
                  const d = airports[t.destination_icao] ?? null;
                  const needsYou = CLIENT_ACTION.includes(t.status);
                  return (
                    <li key={t.id}>
                      <Link href={`/trips/${t.id}`} className="flex items-center gap-4 px-5 py-4 transition hover:bg-raised">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-display text-lg font-semibold">
                              {airportCode(o, t.origin_icao)} <span className="text-fg-3">to</span> {airportCode(d, t.destination_icao)}
                            </p>
                            <TripStatusPill status={t.status} audience="client" />
                            {needsYou && <Pill tone="accent">Action needed</Pill>}
                          </div>
                          <p className="mt-1 text-sm text-fg-2">
                            {formatLocal(t.depart_at, o?.tz, { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                            {" · "}{t.passengers} passenger{t.passengers === 1 ? "" : "s"}{t.return_at ? " · Round trip" : ""}
                          </p>
                          <p className="mt-1 text-xs text-fg-3">{t.trip_number}{CLIENT_NEXT[t.status] ? ` · ${CLIENT_NEXT[t.status]}` : ""}</p>
                        </div>
                        <ChevronRight className="h-5 w-5 shrink-0 text-fg-3" aria-hidden />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </ClientShell>
  );
}
