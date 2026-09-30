import Link from "next/link";
import { Star } from "lucide-react";
import { FEEDBACK_CATEGORIES } from "@jlaero/shared";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/trips/access";
import { ActionForm } from "@/components/lux/ActionForm";
import { Card, EmptyState, PageHeader, Pill, Stat } from "@/components/lux/ui";
import { Tabs, qs, shortDate } from "../_lib/table";
import { markFeedbackReviewed } from "./actions";

export const metadata = { title: "Feedback | Jlaero Desk" };

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${n} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => <Star key={i} className={i <= n ? "h-4 w-4 fill-current text-accent-text" : "h-4 w-4 text-line-strong"} aria-hidden />)}
    </span>
  );
}

export default async function DeskFeedback({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  await requireStaff("view");
  const { view } = await searchParams;
  const tab = view === "low" ? "low" : view === "unreviewed" ? "unreviewed" : "all";
  const sql = db();
  const rows = await sql`
    select f.*, t.trip_number, t.origin_icao, t.destination_icao, t.depart_at, c.full_name as client_name, c.id as client_id,
           r.full_name as reviewer, q.aircraft_type, op.name as operator_name
    from trip_feedback f join trips t on t.id = f.trip_id join clients c on c.id = f.client_id
    left join profiles r on r.id = f.reviewed_by
    left join trip_quotes q on q.id = t.selected_quote_id left join operators op on op.id = q.operator_id
    where ${tab === "low" ? sql`f.rating <= 3` : tab === "unreviewed" ? sql`f.reviewed_at is null` : sql`true`}
    order by f.created_at desc limit 200`;
  const s = (await sql`select count(*)::int as n, round(avg(rating)::numeric, 2) as avg,
    count(*) filter (where rating <= 3)::int as low, count(*) filter (where reviewed_at is null)::int as open from trip_feedback`)[0]!;

  return (
    <>
      <PageHeader eyebrow="Client feedback" title="Feedback" subtitle="Ratings and comments clients leave after each trip." />
      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <Stat label="Responses" value={s.n} />
        <Stat label="Average rating" value={s.avg ?? "None"} />
        <Stat label="3 stars or below" value={s.low} />
        <Stat label="Not reviewed" value={s.open} />
      </div>
      <Tabs active={tab} items={[
        { key: "all", label: "All", href: "/desk/feedback" },
        { key: "unreviewed", label: "Not reviewed", href: `/desk/feedback${qs({}, { view: "unreviewed" })}`, count: s.open },
        { key: "low", label: "Low ratings", href: `/desk/feedback${qs({}, { view: "low" })}`, count: s.low },
      ]} />
      {rows.length === 0 ? <EmptyState title="No feedback here yet" body="Clients get a feedback request automatically when a trip is completed." /> : (
        <div className="space-y-3">
          {rows.map((f) => {
            const cats = (f.categories ?? {}) as Record<string, number>;
            return (
              <Card key={f.id} className={f.rating <= 2 ? "border-bad/40" : undefined}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-3"><Stars n={f.rating} />{f.rating <= 3 && <Pill tone="bad">Follow up</Pill>}{f.reviewed_at && <Pill tone="ok">Reviewed</Pill>}</div>
                    <p className="mt-1 text-sm text-fg-2">
                      <Link href={`/desk/trips/${f.trip_id}`} className="font-semibold text-fg hover:underline">{f.trip_number}</Link>
                      {" · "}<Link href={`/desk/clients/${f.client_id}`} className="hover:underline">{f.client_name}</Link>
                      {" · "}{f.origin_icao} to {f.destination_icao}, {shortDate(f.depart_at)}
                      {f.aircraft_type && ` · ${f.aircraft_type}`}{f.operator_name && ` with ${f.operator_name}`}
                    </p>
                  </div>
                  {!f.reviewed_at ? (
                    <ActionForm action={markFeedbackReviewed} submitLabel="Mark reviewed" variant="secondary" inline>
                      <input type="hidden" name="feedbackId" value={f.id} />
                    </ActionForm>
                  ) : <p className="text-xs text-fg-3">Reviewed by {f.reviewer ?? "staff"}, {shortDate(f.reviewed_at)}</p>}
                </div>
                {f.comments && <blockquote className="mt-3 border-l-2 border-accent pl-3 text-sm">{f.comments}</blockquote>}
                {Object.keys(cats).length > 0 && (
                  <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-fg-2">
                    {FEEDBACK_CATEGORIES.filter(([k]) => cats[k] != null).map(([k, label]) => (
                      <div key={k} className="flex gap-1"><dt>{label}:</dt><dd className="font-semibold text-fg">{cats[k]}/5</dd></div>
                    ))}
                  </dl>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
