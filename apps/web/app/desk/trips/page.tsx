import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { formatLocal, OPEN_TRIP_STATUSES, TRIP_BOARD_GROUPS, type TripStatus } from "@jlaero/shared";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/trips/access";
import { ButtonLink, EmptyState, Input, PageHeader, cx } from "@/components/lux/ui";
import { TripStatusPill } from "@/components/lux/status";
import { Table, Tabs, Td, qs, shortDateTime } from "../_lib/table";

export const metadata = { title: "Trips | Jlaero Desk" };

type Params = { group?: string; mine?: string; q?: string; all?: string };

// All trips, filterable by board group, ownership and free-text search
// (trip number, client name or email, ICAO).
export default async function DeskTrips({ searchParams }: { searchParams: Promise<Params> }) {
  const user = await requireStaff("view");
  const params = await searchParams;
  const sql = db();
  const group = TRIP_BOARD_GROUPS.find((g) => g.key === params.group);
  const includeFinished = params.all === "1";
  const statuses: TripStatus[] = group
    ? group.statuses
    : includeFinished ? [...OPEN_TRIP_STATUSES, "closed", "cancelled"] : OPEN_TRIP_STATUSES;
  const q = params.q?.trim() ?? "";
  const like = `%${q}%`;

  const rows = await sql`
    select t.id, t.trip_number, t.status, t.depart_at, t.passengers, t.updated_at, t.origin_icao, t.destination_icao, t.source,
           c.full_name as client_name, c.company_name, c.email as client_email,
           b.full_name as broker_name, a.tz as origin_tz
    from trips t
    join clients c on c.id = t.client_id
    join airports a on a.icao = t.origin_icao
    left join profiles b on b.id = t.broker_id
    where t.status = any(${statuses}::trip_status[])
      ${params.mine === "1" ? sql`and t.broker_id = ${user.id}` : sql``}
      ${q ? sql`and (t.trip_number ilike ${like} or c.full_name ilike ${like} or c.email ilike ${like}
                     or c.company_name ilike ${like} or t.origin_icao ilike ${like} or t.destination_icao ilike ${like})` : sql``}
    order by case when t.status in ('closed', 'cancelled') then 1 else 0 end, t.depart_at asc
    limit 300`;

  const counts = await sql`select status, count(*)::int as n from trips where status = any(${OPEN_TRIP_STATUSES}::trip_status[]) group by status`;
  const countFor = (s: TripStatus[]) => counts.filter((c) => s.includes(c.status)).reduce((a, c) => a + Number(c.n), 0);
  const base: Params = { mine: params.mine, q: params.q, all: params.all };

  return (
    <>
      <PageHeader
        eyebrow="Trip management"
        title="Trips"
        subtitle="Every request, active trip and past booking in one place."
        actions={user.isBroker && <ButtonLink href="/desk/trips/new"><Plus className="h-4 w-4" aria-hidden />New trip</ButtonLink>}
      />

      <Tabs
        active={group?.key ?? "open"}
        items={[
          { key: "open", label: "All open", href: `/desk/trips${qs(base, { group: undefined })}`, count: countFor(OPEN_TRIP_STATUSES) },
          ...TRIP_BOARD_GROUPS.map((g) => ({ key: g.key, label: g.label, href: `/desk/trips${qs(base, { group: g.key })}`, count: countFor(g.statuses) })),
        ]}
      />

      <form method="GET" className="mb-5 flex flex-wrap items-center gap-3">
        {group && <input type="hidden" name="group" value={group.key} />}
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-3" aria-hidden />
          <label htmlFor="trip-search" className="sr-only">Search trips</label>
          <Input id="trip-search" name="q" defaultValue={q} placeholder="Trip number, client, email or airport" className="pl-9" />
        </div>
        <label className="inline-flex min-h-[44px] items-center gap-2 text-sm text-fg-2">
          <input type="checkbox" name="mine" value="1" defaultChecked={params.mine === "1"} className="h-4 w-4 accent-[var(--accent)]" />
          Assigned to me
        </label>
        {!group && (
          <label className="inline-flex min-h-[44px] items-center gap-2 text-sm text-fg-2">
            <input type="checkbox" name="all" value="1" defaultChecked={includeFinished} className="h-4 w-4 accent-[var(--accent)]" />
            Include closed and cancelled
          </label>
        )}
        <button type="submit" className="min-h-[44px] rounded-xl border border-line-strong bg-surface px-4 text-sm font-semibold hover:bg-raised">Apply</button>
      </form>

      {rows.length === 0 ? (
        <EmptyState title="No trips match" body={q ? "Try a different search or filter." : "New requests from the app and by email appear here."} />
      ) : (
        <Table head={["Trip", "Client", "Route", "Departure (local)", "Pax", "Status", "Broker", "Updated"]}>
          {rows.map((t) => (
            <tr key={t.id} className="hover:bg-raised">
              <Td>
                <Link href={`/desk/trips/${t.id}`} className="font-semibold text-fg underline-offset-4 hover:underline">{t.trip_number}</Link>
                {t.source === "email" && <p className="text-xs text-fg-3">by email</p>}
              </Td>
              <Td>
                <p className="font-medium">{t.client_name}</p>
                <p className="text-xs text-fg-3">{t.company_name || t.client_email}</p>
              </Td>
              <Td className="whitespace-nowrap font-mono text-xs">{t.origin_icao} to {t.destination_icao}</Td>
              <Td className="whitespace-nowrap">{formatLocal(t.depart_at, t.origin_tz, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</Td>
              <Td className="tabular-nums">{t.passengers}</Td>
              <Td><TripStatusPill status={t.status} /></Td>
              <Td className={cx(!t.broker_name && "text-fg-3")}>{t.broker_name ?? "Unassigned"}</Td>
              <Td className="whitespace-nowrap text-fg-2">{shortDateTime(t.updated_at)}</Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
