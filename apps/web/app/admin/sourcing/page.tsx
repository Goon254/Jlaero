import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";

const STATUS_STYLE: Record<string, string> = {
  open: "bg-amber-900/50 text-amber-200",
  sourcing: "bg-sky-900/50 text-sky-200",
  offers_ready: "bg-emerald-900/50 text-emerald-200",
  accepted: "bg-emerald-800/60 text-emerald-100",
  booked: "bg-slate-700 text-slate-200",
  closed: "bg-slate-800 text-slate-400",
  expired: "bg-slate-800 text-slate-500",
};

export default async function AdminSourcing() {
  await requireRole("admin");
  const sql = db();
  const rows = await sql`
    select t.id, t.origin_icao, t.destination_icao, t.depart_at, t.return_at, t.passengers, t.category_pref, t.status, t.created_at,
           p.full_name, p.company_name,
           (select count(*) from rfq_recipients r join rfqs f on f.id = r.rfq_id where f.trip_request_id = t.id and r.status = 'sent') as sent,
           (select count(*) from operator_quotes q join rfqs f on f.id = q.rfq_id where f.trip_request_id = t.id) as quotes,
           (select count(*) from traveler_offers o where o.trip_request_id = t.id and o.status = 'presented') as offers
    from trip_requests t join profiles p on p.id = t.traveler_id
    order by case t.status when 'open' then 0 when 'sourcing' then 1 when 'offers_ready' then 2 else 3 end, t.depart_at
    limit 200`;

  return (
    <main>
      <h1 className="text-2xl font-semibold">Sourcing</h1>
      <p className="mt-2 text-sm text-slate-400">
        Trip requests, in the order they need attention. Open a request to pick operators, approve RFQ emails, review quotes, and price offers.
      </p>
      {!rows.length ? (
        <div className="mt-10 rounded-2xl border border-dashed border-slate-700 p-12 text-center text-slate-400">No trip requests yet.</div>
      ) : (
        <ul className="mt-8 divide-y divide-slate-800 rounded-2xl border border-slate-800 bg-ink-soft">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/admin/sourcing/${r.id}`} className="flex flex-wrap items-center gap-4 px-5 py-4 hover:bg-slate-800/40">
                <span className={`rounded-full px-2.5 py-0.5 text-xs capitalize ${STATUS_STYLE[r.status] ?? ""}`}>{String(r.status).replace(/_/g, " ")}</span>
                <span className="font-medium">{r.origin_icao} → {r.destination_icao}</span>
                <span className="text-sm text-slate-400">
                  {new Date(r.depart_at).toLocaleDateString()} · {r.passengers} pax{r.category_pref ? ` · ${String(r.category_pref).replace(/_/g, " ")}` : ""}
                </span>
                <span className="ml-auto text-xs text-slate-500 tabular-nums">
                  {r.sent} sent · {r.quotes} quotes · {r.offers} offers
                </span>
                <span className="text-xs text-slate-500">{r.company_name || r.full_name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
