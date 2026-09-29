import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { AcceptOffer } from "./AcceptOffer";

const TIER_ORDER = { value: 0, preferred: 1, premium: 2 } as const;

export default async function RequestDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();
  const { data: req } = await supabase
    .from("trip_requests")
    .select("id, traveler_id, origin_icao, destination_icao, depart_at, return_at, passengers, category_pref, notes, status, booking_id, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!req || req.traveler_id !== user.id) notFound();

  const { data: offers } = await supabase
    .from("traveler_offer_cards")
    .select("id, tier, tier_label, tier_description, headline, includes, traveler_price, currency, expires_at, status, aircraft_type, fet_included")
    .eq("trip_request_id", id)
    .in("status", ["presented", "accepted"]);

  // Operator name for the Part 295 disclosure comes from the ops tables.
  const operatorByOffer = new Map<string, string>();
  if (offers?.length) {
    const rows = await db()`select o.id, op.name from traveler_offers o join operator_quotes q on q.id = o.operator_quote_id join operators op on op.id = q.operator_id where o.id = any(${offers.map((o) => o.id)})`;
    for (const r of rows) operatorByOffer.set(r.id, r.name);
  }
  const sorted = [...(offers ?? [])].sort((a, b) => TIER_ORDER[a.tier as keyof typeof TIER_ORDER] - TIER_ORDER[b.tier as keyof typeof TIER_ORDER]);
  const live = sorted.filter((o) => o.status === "presented" && (!o.expires_at || new Date(o.expires_at) > new Date()));

  return (
    <PageShell
      title={`${req.origin_icao} → ${req.destination_icao}`}
      subtitle={`${new Date(req.depart_at).toLocaleString()}${req.return_at ? ` · returns ${new Date(req.return_at).toLocaleString()}` : " · one way"} · ${req.passengers} passengers`}
    >
      {req.booking_id ? (
        <div className="rounded-2xl border border-emerald-900 bg-emerald-950/40 p-6">
          <p className="font-medium text-emerald-200">You accepted an option. Sign the agreement and pay to confirm the aircraft.</p>
          <Link href={`/bookings/${req.booking_id}`} className="mt-3 inline-block rounded-full bg-gold px-5 py-2 text-sm font-medium text-ink">Open booking</Link>
        </div>
      ) : live.length ? (
        <>
          <p className="text-sm text-slate-400">Each price is final and includes federal excise tax and segment fees unless noted. Options are held for a limited time.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {live.map((o) => (
              <div key={o.id} className={`flex flex-col rounded-2xl border p-5 ${o.tier === "preferred" ? "border-gold bg-ink-soft" : "border-slate-800 bg-ink-soft/60"}`}>
                <p className="text-xs uppercase tracking-wide text-gold">{o.tier_label}{o.tier === "preferred" ? " · recommended" : ""}</p>
                <p className="mt-2 text-lg font-semibold">{o.headline}</p>
                <p className="mt-1 text-sm text-slate-400">{o.tier_description}</p>
                <p className="mt-4 text-3xl font-semibold tabular-nums">{o.currency} {Number(o.traveler_price).toLocaleString()}</p>
                <ul className="mt-3 space-y-1 text-sm text-slate-300">
                  {(o.includes as string[]).map((i) => <li key={i}>· {i}</li>)}
                </ul>
                {o.expires_at && <p className="mt-3 text-xs text-slate-500">Held until {new Date(o.expires_at).toLocaleString()}</p>}
                <div className="mt-auto pt-5">
                  <AcceptOffer offerId={o.id} operatorName={operatorByOffer.get(o.id) ?? "the assigned carrier"} price={Number(o.traveler_price)} currency={o.currency} />
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-slate-800 bg-ink-soft p-8">
          <p className="font-medium">{req.status === "expired" ? "This request has expired." : "We are sourcing your aircraft."}</p>
          <p className="mt-2 text-sm text-slate-400">
            {req.status === "expired"
              ? "The departure has passed. Request a new trip any time."
              : "Our desk is asking certificated operators near your departure for availability and pricing. Options usually arrive within a few hours during business hours; we will email you when they are ready."}
          </p>
          {req.notes && <p className="mt-4 text-xs text-slate-500">Your notes: {req.notes}</p>}
        </div>
      )}
      <p className="mt-10 text-xs text-slate-500">
        Jlaero is an air charter broker and not a direct air carrier. The carrier operating your flight is named before you pay. You may cancel for a full refund if required disclosures are not provided in a reasonable time.
      </p>
    </PageShell>
  );
}
