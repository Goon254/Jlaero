import Link from "next/link";
import { Search } from "lucide-react";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/trips/access";
import { EmptyState, Input, PageHeader, Pill } from "@/components/lux/ui";
import { Table, Td, shortDate } from "../_lib/table";

export const metadata = { title: "Clients | Jlaero Desk" };

// Client management (spec s23): search, then open for history and details.
export default async function DeskClients({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireStaff("broker");
  const { q } = await searchParams;
  const like = `%${q?.trim() ?? ""}%`;
  const rows = await db()`
    select c.id, c.full_name, c.email, c.phone, c.company_name, c.user_id, c.first_time_private_flyer, c.created_at,
           count(t.id)::int as trips,
           count(t.id) filter (where t.status not in ('closed', 'cancelled', 'completed', 'feedback_requested'))::int as open_trips,
           max(t.depart_at) as last_trip
    from clients c left join trips t on t.client_id = c.id
    where ${q?.trim() ? db()`(c.full_name ilike ${like} or c.email ilike ${like} or c.company_name ilike ${like} or c.phone ilike ${like})` : db()`true`}
    group by c.id
    order by max(t.created_at) desc nulls last, c.created_at desc
    limit 200`;

  return (
    <>
      <PageHeader eyebrow="Client management" title="Clients" subtitle="Everyone who has requested a trip, by app or by email." />
      <form method="GET" className="mb-5 max-w-md">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-3" aria-hidden />
          <label htmlFor="client-search" className="sr-only">Search clients</label>
          <Input id="client-search" name="q" defaultValue={q} placeholder="Name, email, company or phone" className="pl-9" />
        </div>
      </form>
      {rows.length === 0 ? (
        <EmptyState title="No clients found" body={q ? "Try another search." : "Clients are created when a trip request arrives."} />
      ) : (
        <Table head={["Client", "Company", "Contact", "Trips", "Last departure", "Account", "Since"]}>
          {rows.map((c) => (
            <tr key={c.id} className="hover:bg-raised">
              <Td>
                <Link href={`/desk/clients/${c.id}`} className="font-semibold hover:underline">{c.full_name}</Link>
                {c.first_time_private_flyer && <p className="text-xs text-accent-text">First time flying private</p>}
              </Td>
              <Td>{c.company_name ?? <span className="text-fg-3">None</span>}</Td>
              <Td><p>{c.email}</p><p className="text-xs text-fg-3">{c.phone ?? ""}</p></Td>
              <Td className="tabular-nums">{c.trips}{c.open_trips > 0 && <span className="ml-2"><Pill tone="warn">{c.open_trips} open</Pill></span>}</Td>
              <Td className="whitespace-nowrap">{c.last_trip ? shortDate(c.last_trip) : ""}</Td>
              <Td>{c.user_id ? <Pill tone="ok">App account</Pill> : <Pill>Email only</Pill>}</Td>
              <Td className="whitespace-nowrap text-fg-2">{shortDate(c.created_at)}</Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
