import Link from "next/link";
import { BROKER_NEXT_STEP, formatLocal, TRIP_BOARD_GROUPS, type TripStatus } from "@jlaero/shared";
import { AlertTriangle, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/trips/access";
import { TripStatusPill } from "@/components/lux/status";
import { ButtonLink, Card, cx, EmptyState, PageHeader, Stat } from "@/components/lux/ui";

export const dynamic = "force-dynamic";

// Statuses where the broker, not the client or operator, holds the next move.
const BROKER_ACTION: TripStatus[] = [
  "new_request", "quotes_received", "broker_review", "client_selected", "payment_received",
  "operator_confirmation_pending", "confirmed", "itinerary_pending", "operational_issue", "replacement_search",
];

// Central dashboard of all active trips (spec s22).
export default async function DeskHome({ searchParams }: { searchParams: Promise<{ mine?: string }> }) {
  const user = await requireStaff("view");
  const { mine } = await searchParams;
  const onlyMine = mine === "1";
  const sql = db();
  const open = TRIP_BOARD_GROUPS.flatMap((g) => g.statuses);
  const trips = await sql`
    select t.id, t.trip_number, t.status, t.origin_icao, t.destination_icao, t.depart_at, t.passengers, t.updated_at, t.broker_id,
           c.full_name as client_name, a.tz, p.full_name as broker_name
    from trips t join clients c on c.id = t.client_id join airports a on a.icao = t.origin_icao
    left join profiles p on p.id = t.broker_id
    where t.status = any(${open}::trip_status[]) ${onlyMine ? sql`and t.broker_id = ${user.id}` : sql``}
    order by t.depart_at`;
  const [pay] = await sql`select count(*)::int as to_verify from trip_payments where status in ('submitted', 'received')`;
  const [rev] = await sql`select count(*)::int as to_review from trip_quotes q join trips t on t.id = q.trip_id
    where q.status = 'pending_review' and t.status not in ('cancelled', 'closed')`;
  const toVerify = Number(pay?.to_verify ?? 0);
  const toReview = Number(rev?.to_review ?? 0);

  const soon = trips.filter((t) => new Date(t.depart_at).getTime() - Date.now() < 72 * 3600000);
  const issues = trips.filter((t) => ["operational_issue", "replacement_search"].includes(t.status));
  const unconfirmedSoon = soon.filter((t) => !["confirmed", "itinerary_pending", "itinerary_ready", "within_72_hours", "active", "completed", "feedback_requested"].includes(t.status));
  const needsMe = trips.filter((t) => BROKER_ACTION.includes(t.status));

  return (
    <div>
      <PageHeader
        eyebrow="Broker desk"
        title="Dashboard"
        subtitle="Every active trip, from request to feedback. AI does the searching and sorting; you make the calls."
        actions={
          <>
            <ButtonLink href={onlyMine ? "/desk" : "/desk?mine=1"} variant="secondary">{onlyMine ? "All trips" : "My trips"}</ButtonLink>
            {user.isBroker && <ButtonLink href="/desk/trips/new"><Plus className="h-4 w-4" aria-hidden /> New trip</ButtonLink>}
          </>
        }
      />

      {(issues.length > 0 || unconfirmedSoon.length > 0) && (
        <div className="mb-8 space-y-2" role="region" aria-label="Urgent">
          {[...issues, ...unconfirmedSoon.filter((t) => !issues.includes(t))].map((t) => (
            <Link key={t.id} href={`/desk/trips/${t.id}`} className="flex flex-wrap items-center gap-3 rounded-xl border border-bad/40 bg-bad-soft px-4 py-3 text-sm hover:border-bad">
              <AlertTriangle className="h-4 w-4 text-bad" aria-hidden />
              <span className="font-semibold text-bad">{t.trip_number}</span>
              <span>{issues.includes(t) ? "Replacement aircraft required" : "Departs within 72 hours and is not confirmed"}</span>
              <span className="text-fg-2">{t.origin_icao} to {t.destination_icao} · {formatLocal(t.depart_at, t.tz, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
            </Link>
          ))}
        </div>
      )}

      <div className="mb-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Active trips" value={trips.length} />
        <Stat label="Waiting on you" value={needsMe.length} hint="Broker action needed" />
        <Stat label="Quotes to verify" value={toReview} hint="AI-extracted, pending review" />
        <Stat label="Payments to verify" value={toVerify} hint={user.isFinance ? <Link href="/desk/payments" className="underline">Open payments</Link> : "Finance"} />
      </div>

      {trips.length === 0 ? (
        <EmptyState title="No active trips" body="New requests from the app and from email land here automatically." action={user.isBroker ? <ButtonLink href="/desk/trips/new">Create a trip</ButtonLink> : undefined} />
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 pb-4">
          <div className="grid min-w-[1100px] grid-cols-6 gap-4">
            {TRIP_BOARD_GROUPS.map((g) => {
              const col = trips.filter((t) => g.statuses.includes(t.status));
              return (
                <section key={g.key} aria-label={g.label} className="min-w-0">
                  <h2 className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-fg-3">
                    {g.label} <span className="rounded-full bg-neutral-soft px-2 py-0.5">{col.length}</span>
                  </h2>
                  <div className="space-y-2">
                    {col.map((t) => (
                      <Link key={t.id} href={`/desk/trips/${t.id}`} className="block">
                        <Card padded={false} className={cx("p-3 transition hover:border-line-strong", BROKER_ACTION.includes(t.status) && "border-l-4 border-l-accent", g.key === "issues" && "border-l-4 border-l-bad")}>
                          <p className="text-xs text-fg-3">{t.trip_number}</p>
                          <p className="mt-0.5 font-semibold">{t.origin_icao} to {t.destination_icao}</p>
                          <p className="truncate text-sm text-fg-2">{t.client_name}</p>
                          <p className="text-xs text-fg-3">{formatLocal(t.depart_at, t.tz, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · {t.passengers} pax</p>
                          <div className="mt-2"><TripStatusPill status={t.status} /></div>
                          {BROKER_ACTION.includes(t.status) && <p className="mt-2 text-xs text-accent-text">{BROKER_NEXT_STEP[t.status as TripStatus]}</p>}
                          {!t.broker_id && <p className="mt-1 text-xs text-warn">Unassigned</p>}
                        </Card>
                      </Link>
                    ))}
                    {!col.length && <p className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-xs text-fg-3">None</p>}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
