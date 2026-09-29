"use client";

import { useState, useTransition } from "react";
import { addContact, decideQuote, priceQuote, publishOffers, sendRecipient, startRound, withdrawOffer, type ActionResult } from "./actions";

const input = "w-full rounded-lg border border-slate-700 bg-ink px-3 py-2 text-sm outline-none focus:border-gold";
const btn = "rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:border-gold hover:text-gold disabled:opacity-50";
const primary = "rounded-full bg-gold px-4 py-1.5 text-xs font-medium text-ink hover:bg-gold-light disabled:opacity-50";

function useAction() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const run = (fn: () => Promise<ActionResult>) => {
    setMsg(null); setErr(null);
    start(async () => {
      const r = await fn();
      if (r.ok) setMsg(r.message ?? "Done"); else setErr(r.error);
    });
  };
  const Notice = () => (msg || err) ? <p className={`mt-2 text-xs ${err ? "text-red-400" : "text-emerald-300"}`}>{err ?? msg}</p> : null;
  return { pending, run, Notice };
}

export function StartRoundButton({ requestId, hasRound }: { requestId: string; hasRound: boolean }) {
  const { pending, run, Notice } = useAction();
  return (
    <div>
      <button className={primary} disabled={pending} onClick={() => run(() => startRound(requestId))}>
        {pending ? "Matching operators and drafting…" : hasRound ? "Start another round" : "Find operators and draft RFQs"}
      </button>
      <Notice />
    </div>
  );
}

export type RecipientView = {
  id: string; operator_id: string; operator_name: string; certificate_number: string | null; status: string;
  to_email: string | null; subject: string | null; body_text: string | null; match_reason: string | null; sent_at: string | null;
};

export function RecipientCard({ requestId, r }: { requestId: string; r: RecipientView }) {
  const { pending, run, Notice } = useAction();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState(r.subject ?? "");
  const [body, setBody] = useState(r.body_text ?? "");
  const [to, setTo] = useState(r.to_email ?? "");
  const [contactName, setContactName] = useState("");
  const sent = r.status !== "draft";
  return (
    <li className="rounded-xl border border-slate-800 bg-ink-soft p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`rounded-full px-2.5 py-0.5 text-xs capitalize ${sent ? "bg-slate-700 text-slate-200" : "bg-amber-900/50 text-amber-200"}`}>{r.status.replace(/_/g, " ")}</span>
        <span className="font-medium">{r.operator_name}</span>
        {r.certificate_number && <span className="text-xs text-slate-500">cert {r.certificate_number}</span>}
        <span className="ml-auto text-xs text-slate-500">{r.to_email ?? "no contact"}</span>
        <button className={btn} onClick={() => setOpen((o) => !o)}>{open ? "Hide" : sent ? "View" : "Review"}</button>
      </div>
      {r.match_reason && <p className="mt-2 text-xs text-slate-400">{r.match_reason}</p>}
      {open && (
        <div className="mt-4 space-y-3">
          {!r.to_email && !sent ? (
            <div className="rounded-lg border border-dashed border-slate-700 p-3">
              <p className="text-sm text-slate-300">No contact email for this operator. Add one to draft and send.</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <input className={input} placeholder="charter@operator.com" value={to} onChange={(e) => setTo(e.target.value)} />
                <input className={input} placeholder="Contact name (optional)" value={contactName} onChange={(e) => setContactName(e.target.value)} />
                <button className={primary} disabled={pending} onClick={() => run(() => addContact(requestId, r.operator_id, to, contactName || null))}>Save contact</button>
              </div>
            </div>
          ) : (
            <>
              <input className={input} value={to} onChange={(e) => setTo(e.target.value)} disabled={sent} />
              <input className={input} value={subject} onChange={(e) => setSubject(e.target.value)} disabled={sent} placeholder="Subject" />
              <textarea className={`${input} min-h-[220px] font-mono text-xs`} value={body} onChange={(e) => setBody(e.target.value)} disabled={sent} placeholder={r.body_text ? "" : "Draft was not generated. Write the email or save a contact and start a new round."} />
              {!sent && (
                <button className={primary} disabled={pending || !body || !subject || !to} onClick={() => run(() => sendRecipient(requestId, r.id, { subject, body, toEmail: to }))}>
                  {pending ? "Sending…" : "Approve and send"}
                </button>
              )}
              {sent && r.sent_at && <p className="text-xs text-slate-500">Sent {new Date(r.sent_at).toLocaleString()}</p>}
            </>
          )}
          <Notice />
        </div>
      )}
    </li>
  );
}

export type QuoteView = {
  id: string; operator_name: string; status: string; all_in_total: number | null; currency: string; aircraft_type: string | null;
  tail_number: string | null; fet_included: boolean | null; expires_at: string | null; confidence: number | null; review_notes: string | null;
  reply_text: string | null; extracted: Record<string, unknown>;
};
export type Policy = { tier: "value" | "preferred" | "premium"; label: string; default_markup_pct: number; min_margin_pct: number };

export function QuoteCard({ requestId, q, policies, suggested }: { requestId: string; q: QuoteView; policies: Policy[]; suggested: Policy["tier"] }) {
  const { pending, run, Notice } = useAction();
  const [showReply, setShowReply] = useState(false);
  const [notes, setNotes] = useState(q.review_notes ?? "");
  const [override, setOverride] = useState<string>(q.all_in_total != null ? String(q.all_in_total) : "");
  const [tier, setTier] = useState<Policy["tier"]>(suggested);
  const [competitor, setCompetitor] = useState("");
  const [competitorSource, setCompetitorSource] = useState("");
  const [manual, setManual] = useState("");
  const [headline, setHeadline] = useState("");
  const lowConfidence = (q.confidence ?? 0) < 0.7;
  const policy = policies.find((p) => p.tier === tier);
  const cost = Number(override || q.all_in_total || 0);
  const preview = policy && cost ? Math.ceil((cost * (1 + policy.default_markup_pct / 100)) / 50) * 50 : null;

  return (
    <li className="rounded-xl border border-slate-800 bg-ink-soft p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`rounded-full px-2.5 py-0.5 text-xs capitalize ${q.status === "approved" ? "bg-emerald-900/50 text-emerald-200" : q.status === "rejected" ? "bg-red-900/40 text-red-200" : "bg-amber-900/50 text-amber-200"}`}>{q.status.replace(/_/g, " ")}</span>
        <span className="font-medium">{q.operator_name}</span>
        <span className="text-sm text-slate-300">{q.aircraft_type ?? "aircraft not stated"}{q.tail_number ? ` · ${q.tail_number}` : ""}</span>
        <span className="ml-auto font-semibold tabular-nums">{q.all_in_total != null ? `${q.currency} ${Number(q.all_in_total).toLocaleString()}` : "no total"}</span>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        Confidence {q.confidence != null ? Math.round(q.confidence * 100) : "?"}%{lowConfidence ? " (below 70%: verify against the reply before approving)" : ""}
        {q.fet_included === false ? " · FET not included" : q.fet_included ? " · FET included" : ""}
        {q.expires_at ? ` · valid until ${new Date(q.expires_at).toLocaleString()}` : ""}
        {" · "}<button className="underline" onClick={() => setShowReply((s) => !s)}>{showReply ? "hide reply" : "read reply"}</button>
      </p>
      {showReply && <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-ink p-3 text-xs text-slate-300">{q.reply_text ?? "(no text)"}</pre>}

      {q.status === "pending_review" && (
        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
          <input className={input} type="number" step="1" value={override} onChange={(e) => setOverride(e.target.value)} placeholder="Operator all-in total" />
          <input className={input} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Review note" />
          <button className={primary} disabled={pending} onClick={() => run(() => decideQuote(requestId, q.id, "approved", notes, override ? Number(override) : null))}>Approve</button>
          <button className={btn} disabled={pending} onClick={() => run(() => decideQuote(requestId, q.id, "rejected", notes, null))}>Reject</button>
        </div>
      )}

      {q.status === "approved" && (
        <div className="mt-4 rounded-lg border border-slate-800 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Price this quote</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <select className={input} value={tier} onChange={(e) => setTier(e.target.value as Policy["tier"])}>
              {policies.map((p) => <option key={p.tier} value={p.tier}>{p.label} tier ({p.default_markup_pct}% default)</option>)}
            </select>
            <input className={input} value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Headline (auto if blank)" />
            <input className={input} type="number" value={competitor} onChange={(e) => setCompetitor(e.target.value)} placeholder="Competitor price to beat" />
            <input className={input} value={competitorSource} onChange={(e) => setCompetitorSource(e.target.value)} placeholder="Competitor (who)" />
            <input className={input} type="number" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Set price manually" />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button className={primary} disabled={pending || !cost} onClick={() => run(() => priceQuote(requestId, {
              quoteId: q.id, tier, competitorPrice: competitor ? Number(competitor) : null, competitorSource: competitorSource || null,
              manualPrice: manual ? Number(manual) : null, headline: headline || null,
            }))}>Create offer</button>
            {preview != null && <span className="text-xs text-slate-400">Policy price about ${preview.toLocaleString()}; minimum margin {policy?.min_margin_pct}%. Competitor or manual price adjusts within that floor.</span>}
          </div>
        </div>
      )}
      <Notice />
    </li>
  );
}

export type OfferView = { id: string; tier: string; headline: string; operator_cost: number; traveler_price: number; markup_pct: number; strategy: string; status: string; competitor_price: number | null; expires_at: string | null };

export function OffersPanel({ requestId, offers, canPublish }: { requestId: string; offers: OfferView[]; canPublish: boolean }) {
  const { pending, run, Notice } = useAction();
  return (
    <div>
      {!offers.length ? <p className="text-sm text-slate-500">No offers yet. Approve a quote, then price it.</p> : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="py-1">Tier</th><th>Offer</th><th className="text-right">Operator</th><th className="text-right">Traveler</th><th className="text-right">Margin</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {offers.map((o) => (
              <tr key={o.id} className="border-t border-slate-800">
                <td className="py-2 capitalize">{o.tier}</td>
                <td>{o.headline}{o.competitor_price ? <span className="block text-xs text-slate-500">beats {Number(o.competitor_price).toLocaleString()}</span> : null}</td>
                <td className="text-right tabular-nums text-slate-400">{Number(o.operator_cost).toLocaleString()}</td>
                <td className="text-right tabular-nums font-medium">{Number(o.traveler_price).toLocaleString()}</td>
                <td className="text-right tabular-nums">{Number(o.markup_pct)}%</td>
                <td className="capitalize text-slate-400">{o.status}</td>
                <td className="text-right">{["draft", "presented"].includes(o.status) && <button className={btn} disabled={pending} onClick={() => run(() => withdrawOffer(requestId, o.id))}>Withdraw</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {canPublish && (
        <button className={`${primary} mt-4`} disabled={pending} onClick={() => run(() => publishOffers(requestId))}>Present draft offers to traveler</button>
      )}
      <Notice />
    </div>
  );
}
