import Link from "next/link";
import { Search } from "lucide-react";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/trips/access";
import { ActionForm } from "@/components/lux/ActionForm";
import { Card, EmptyState, Input, PageHeader, Pill } from "@/components/lux/ui";
import { Table, Tabs, Td, qs, shortDate } from "../_lib/table";
import { createOperator } from "./actions";
import { NETWORK_LABELS, networkTone, OperatorFields } from "./fields";

export const metadata = { title: "Operators | Jlaero Desk" };

const PAGE = 50;

type Params = { tab?: string; q?: string; page?: string; add?: string };

// Operator database (spec s4, s23; blueprint s5). The approved network is
// what the AI searches first; ~1,800 FAA Part 135 prospects sit behind it.
export default async function DeskOperators({ searchParams }: { searchParams: Promise<Params> }) {
  const user = await requireStaff("broker");
  const params = await searchParams;
  const tab = ["network", "prospect", "excluded", "inactive"].includes(params.tab ?? "") ? params.tab! : "network";
  const statuses = tab === "network" ? ["approved", "preferred"] : [tab];
  const q = params.q?.trim() ?? "";
  const like = `%${q}%`;
  const page = Math.max(1, Number(params.page) || 1);
  const sql = db();

  const counts = await sql`select network_status::text as s, count(*)::int as n from operators group by 1`;
  const count = (s: string[]) => counts.filter((c) => s.includes(c.s)).reduce((a, c) => a + c.n, 0);

  const rows = await sql`
    select o.id, o.name, o.certificate_number, o.network_status, o.base_icaos, o.hq_city, o.hq_state, o.search_priority,
           coalesce(pc.email, o.general_email) as contact_email,
           (select count(*)::int from operator_aircraft a where a.operator_id = o.id) as aircraft,
           (select count(*)::int from registry_aircraft r where r.operator_id = o.id) as faa_fleet,
           r.sent, r.quoted, r.declined,
           (select max(created_at) from trip_quotes q where q.operator_id = o.id) as last_quote
    from operators o
    left join lateral (select email from operator_contacts c where c.operator_id = o.id and c.unsubscribed_at is null
                       order by is_primary desc, created_at limit 1) pc on true
    left join lateral (select count(*) filter (where status not in ('draft', 'approved'))::int as sent,
                              count(*) filter (where status = 'quoted')::int as quoted,
                              count(*) filter (where status = 'declined')::int as declined
                       from rfq_recipients x where x.operator_id = o.id) r on true
    where o.network_status = any(${statuses}::operator_network_status[])
      ${q ? sql`and (o.name ilike ${like} or o.legal_name ilike ${like} or o.certificate_number ilike ${like}
                     or o.hq_state ilike ${q} or o.hq_city ilike ${like} or ${q.toUpperCase()} = any(o.base_icaos))` : sql``}
    order by (o.network_status = 'preferred') desc, o.search_priority desc, o.name
    limit ${PAGE + 1} offset ${(page - 1) * PAGE}`;
  const hasMore = rows.length > PAGE;
  const list = rows.slice(0, PAGE);
  const base: Params = { tab: params.tab, q: params.q };

  return (
    <>
      <PageHeader
        eyebrow="Operator management"
        title="Operators"
        subtitle="The approved network is searched first for every trip. Prospects are FAA Part 135 certificate holders not yet vetted."
      />

      <Tabs
        active={tab}
        items={[
          { key: "network", label: "Approved network", href: `/desk/operators${qs(base, { tab: undefined, page: undefined })}`, count: count(["approved", "preferred"]) },
          { key: "prospect", label: "Prospects", href: `/desk/operators${qs(base, { tab: "prospect", page: undefined })}`, count: count(["prospect"]) },
          { key: "excluded", label: "Excluded", href: `/desk/operators${qs(base, { tab: "excluded", page: undefined })}`, count: count(["excluded"]) },
          { key: "inactive", label: "Inactive", href: `/desk/operators${qs(base, { tab: "inactive", page: undefined })}`, count: count(["inactive"]) },
        ]}
      />

      <form method="GET" className="mb-5 max-w-md">
        {tab !== "network" && <input type="hidden" name="tab" value={tab} />}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-3" aria-hidden />
          <label htmlFor="op-search" className="sr-only">Search operators</label>
          <Input id="op-search" name="q" defaultValue={q} placeholder="Name, certificate, city, state or base ICAO" className="pl-9" />
        </div>
      </form>

      {user.isAdmin && (
        <details className="mb-6" open={params.add === "1"}>
          <summary className="inline-flex min-h-[44px] cursor-pointer items-center rounded-xl border border-line-strong bg-surface px-4 text-sm font-semibold hover:bg-raised">Add operator</summary>
          <Card className="mt-3">
            <ActionForm action={createOperator} submitLabel="Add operator">
              <OperatorFields op={null} prefix="new" />
            </ActionForm>
          </Card>
        </details>
      )}

      {list.length === 0 ? (
        <EmptyState
          title={tab === "network" && !q ? "No approved operators yet" : "No operators match"}
          body={tab === "network" && !q ? "Approve operators from the Prospects tab, or add the company's operator list. Until then the search falls back to FAA prospects." : "Try another search."}
        />
      ) : (
        <Table head={["Operator", "Status", "Bases", "Aircraft", "Contact", "RFQs sent", "Quoted", "Declined", "Last quote"]}>
          {list.map((o) => (
            <tr key={o.id} className="hover:bg-raised">
              <Td>
                <Link href={`/desk/operators/${o.id}`} className="font-semibold hover:underline">{o.name}</Link>
                <p className="text-xs text-fg-3">{[o.certificate_number, [o.hq_city, o.hq_state].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}</p>
              </Td>
              <Td><Pill tone={networkTone[o.network_status] ?? "neutral"}>{NETWORK_LABELS[o.network_status] ?? o.network_status}</Pill></Td>
              <Td className="font-mono text-xs">{(o.base_icaos as string[]).join(", ") || <span className="font-sans text-fg-3">Not set</span>}</Td>
              <Td className="tabular-nums">{o.aircraft}{o.faa_fleet > 0 && <span className="text-xs text-fg-3"> ({o.faa_fleet} FAA)</span>}</Td>
              <Td className="max-w-[220px] truncate">{o.contact_email ?? <span className="text-fg-3">None</span>}</Td>
              <Td className="tabular-nums">{o.sent}</Td>
              <Td className="tabular-nums">{o.quoted}</Td>
              <Td className="tabular-nums">{o.declined}</Td>
              <Td className="whitespace-nowrap">{o.last_quote ? shortDate(o.last_quote) : ""}</Td>
            </tr>
          ))}
        </Table>
      )}

      {(page > 1 || hasMore) && (
        <nav aria-label="Pages" className="mt-4 flex items-center justify-between text-sm">
          {page > 1 ? <Link href={`/desk/operators${qs(base, { page: String(page - 1) })}`} className="rounded-lg px-3 py-2 font-medium text-fg-2 hover:bg-neutral-soft">Previous</Link> : <span />}
          <span className="text-fg-3">Page {page}</span>
          {hasMore ? <Link href={`/desk/operators${qs(base, { page: String(page + 1) })}`} className="rounded-lg px-3 py-2 font-medium text-fg-2 hover:bg-neutral-soft">Next</Link> : <span />}
        </nav>
      )}
    </>
  );
}
