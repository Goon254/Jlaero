import Link from "next/link";
import { notFound } from "next/navigation";
import { AIRCRAFT_CATEGORY_LABELS, type AircraftCategory } from "@jlaero/shared";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { suggestTier } from "@/lib/sourcing/pricing";
import { OffersPanel, QuoteCard, RecipientCard, StartRoundButton, type OfferView, type Policy, type QuoteView, type RecipientView } from "./Workbench";

export default async function SourcingWorkbench({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRole("admin");
  const sql = db();
  const [t] = await sql`select t.*, p.full_name, p.company_name, p.phone, o.name as origin_name, d.name as destination_name
    from trip_requests t join profiles p on p.id = t.traveler_id join airports o on o.icao = t.origin_icao join airports d on d.icao = t.destination_icao
    where t.id = ${id}`;
  if (!t) notFound();

  const [recipients, quotes, offers, policies, messages] = await Promise.all([
    sql`select r.id, r.operator_id, o.name as operator_name, o.certificate_number, r.status, r.to_email, r.subject, r.body_text, r.match_reason, r.sent_at, f.round
        from rfq_recipients r join rfqs f on f.id = r.rfq_id join operators o on o.id = r.operator_id
        where f.trip_request_id = ${id} order by f.round desc, r.status, o.name`,
    sql`select q.id, o.name as operator_name, o.argus_rating, o.wyvern_rating, q.status, q.all_in_total, q.currency, q.aircraft_type, q.tail_number, q.fet_included, q.expires_at, q.confidence, q.review_notes, q.extracted,
               m.text_body as reply_text
        from operator_quotes q join rfqs f on f.id = q.rfq_id join operators o on o.id = q.operator_id left join rfq_messages m on m.id = q.message_id
        where f.trip_request_id = ${id} order by q.created_at desc`,
    sql`select id, tier, headline, operator_cost, traveler_price, markup_pct, strategy, status, competitor_price, expires_at from traveler_offers where trip_request_id = ${id} order by traveler_price`,
    sql`select tier, label, default_markup_pct, min_margin_pct from pricing_policies where active order by default_markup_pct`,
    sql`select m.id, m.direction, m.kind, m.from_address, m.subject, m.received_at, m.created_at, o.name as operator_name
        from rfq_messages m left join rfq_recipients r on r.id = m.recipient_id left join operators o on o.id = r.operator_id
        left join rfqs f on f.id = m.rfq_id where f.trip_request_id = ${id} and m.direction = 'inbound' order by m.created_at desc limit 50`,
  ]);

  const cat = t.category_pref as AircraftCategory | null;
  const hasRound = recipients.length > 0;
  const draftOffers = offers.filter((o) => o.status === "draft").length;

  return (
    <main>
      <p className="text-sm"><Link href="/admin/sourcing" className="text-slate-400 hover:text-gold">← Sourcing</Link></p>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t.origin_icao} → {t.destination_icao}</h1>
          <p className="mt-1 text-sm text-slate-400">
            {t.origin_name} to {t.destination_name} · {new Date(t.depart_at).toLocaleString()}{t.return_at ? ` · returns ${new Date(t.return_at).toLocaleString()}` : " · one way"} · {t.passengers} pax · {cat ? AIRCRAFT_CATEGORY_LABELS[cat] : "any cabin"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Traveler {t.company_name || t.full_name}{t.phone ? ` · ${t.phone}` : ""} · status <span className="capitalize">{String(t.status).replace(/_/g, " ")}</span>{t.notes ? ` · "${t.notes}"` : ""}
          </p>
        </div>
        {["open", "sourcing", "offers_ready"].includes(t.status) && <StartRoundButton requestId={id} hasRound={hasRound} />}
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Operators and RFQ emails <span className="text-sm font-normal text-slate-500">({recipients.length})</span></h2>
        <p className="mt-1 text-sm text-slate-400">Each draft is written by the engine for that operator. Review, edit if needed, and approve to send. Nothing goes out without a click here.</p>
        <ul className="mt-4 space-y-3">
          {recipients.map((r) => <RecipientCard key={r.id} requestId={id} r={r as unknown as RecipientView} />)}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Quotes received <span className="text-sm font-normal text-slate-500">({quotes.length})</span></h2>
        <p className="mt-1 text-sm text-slate-400">Parsed from operator replies. Confirm the total against the reply, approve, then price it into a tier. A competitor price undercuts down to the policy floor.</p>
        <ul className="mt-4 space-y-3">
          {quotes.map((q) => {
            const ex = q.extracted as { aircraft?: { year?: number | null }[] };
            const suggested = suggestTier({ year: ex.aircraft?.[0]?.year ?? null, argus: q.argus_rating, wyvern: q.wyvern_rating });
            return <QuoteCard key={q.id} requestId={id} q={q as unknown as QuoteView} policies={policies as unknown as Policy[]} suggested={suggested} />;
          })}
        </ul>
        {messages.length > 0 && (
          <details className="mt-4 text-xs text-slate-500">
            <summary className="cursor-pointer">All inbound messages ({messages.length})</summary>
            <ul className="mt-2 space-y-1">
              {messages.map((m) => <li key={m.id}>{new Date(m.received_at ?? m.created_at).toLocaleString()} · {m.operator_name ?? m.from_address} · <span className="capitalize">{m.kind}</span> · {m.subject}</li>)}
            </ul>
          </details>
        )}
      </section>

      <section className="mt-10 rounded-2xl border border-slate-800 bg-ink-soft p-5">
        <h2 className="text-lg font-semibold">Offers to the traveler</h2>
        <p className="mt-1 text-sm text-slate-400">Up to one offer per tier is what the traveler sees. Operator cost and margin stay internal. Before payment the traveler is shown the Part 295 broker disclosure with the operator&apos;s name.</p>
        <div className="mt-4">
          <OffersPanel requestId={id} offers={offers as unknown as OfferView[]} canPublish={draftOffers > 0} />
        </div>
      </section>
    </main>
  );
}
