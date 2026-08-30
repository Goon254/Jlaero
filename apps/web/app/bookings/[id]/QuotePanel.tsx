"use client";

import { useActionState, useState, useTransition } from "react";
import { QUOTE_LINE_KINDS } from "@jlaero/shared";
import { acceptQuote, sendQuote, type EngineState } from "./actions";

const input =
  "w-full rounded-lg border border-slate-700 bg-ink px-3 py-2 text-sm outline-none focus:border-gold";

const KIND_LABELS: Record<string, string> = {
  flight_time: "Flight time",
  positioning: "Positioning",
  daily_minimum: "Daily minimum",
  landing_fees: "Landing / handling",
  crew_overnight: "Crew overnight",
  catering: "Catering",
  fuel_surcharge: "Fuel surcharge",
  discount: "Discount",
  tax_fet: "Federal Excise Tax",
  tax_segment: "Segment fees",
  other: "Other",
};

export type QuoteView = {
  id: string;
  version: number;
  status: string;
  total: number;
  currency: string;
  expires_at: string | null;
  notes: string | null;
  quote_line_items: {
    kind: string;
    description: string | null;
    quantity: number;
    unit_amount: number;
    amount: number;
    position: number;
  }[];
};

export function QuotePanel({
  bookingId,
  quote,
  role,
  bookingStatus,
}: {
  bookingId: string;
  quote: QuoteView | null;
  role: "buyer" | "provider";
  bookingStatus: string;
}) {
  const canQuote =
    role === "provider" && ["requested", "quoted", "negotiating"].includes(bookingStatus);
  const canAccept =
    role === "buyer" &&
    quote?.status === "sent" &&
    ["quoted", "negotiating"].includes(bookingStatus) &&
    (!quote.expires_at || new Date(quote.expires_at) > new Date());

  const [showBuilder, setShowBuilder] = useState(!quote && canQuote);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [accepting, startAccept] = useTransition();

  return (
    <section className="rounded-2xl border border-slate-800 bg-ink-soft p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Quote</h2>
        {canQuote && (
          <button
            onClick={() => setShowBuilder((s) => !s)}
            className="rounded-full border border-slate-700 px-4 py-1.5 text-sm hover:border-gold hover:text-gold"
          >
            {showBuilder ? "Close builder" : quote ? "Revise quote" : "Send a quote"}
          </button>
        )}
      </div>

      {quote && !showBuilder && (
        <div className="mt-4">
          <p className="text-xs text-slate-500">
            Version {quote.version} · {quote.status}
            {quote.expires_at &&
              quote.status === "sent" &&
              ` · expires ${new Date(quote.expires_at).toLocaleString()}`}
          </p>
          <table className="mt-3 w-full text-sm">
            <tbody>
              {[...quote.quote_line_items]
                .sort((a, b) => a.position - b.position)
                .map((li, i) => (
                  <tr key={i} className="border-b border-slate-800/60">
                    <td className="py-2 pr-2">
                      {KIND_LABELS[li.kind] ?? li.kind}
                      {li.description && (
                        <span className="ml-1 text-slate-500">· {li.description}</span>
                      )}
                    </td>
                    <td className="py-2 text-right text-slate-400">
                      {li.quantity !== 1 ? `${li.quantity} x $${Number(li.unit_amount).toLocaleString()}` : ""}
                    </td>
                    <td className="py-2 pl-3 text-right font-medium">
                      {li.amount < 0 ? "-" : ""}$
                      {Math.abs(Number(li.amount)).toLocaleString()}
                    </td>
                  </tr>
                ))}
              <tr>
                <td className="pt-3 font-semibold">Total</td>
                <td />
                <td className="pt-3 text-right text-lg font-semibold text-gold">
                  ${Number(quote.total).toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>
          {quote.notes && (
            <p className="mt-3 rounded-lg bg-ink p-3 text-sm text-slate-300">{quote.notes}</p>
          )}
          {canAccept && (
            <div className="mt-4">
              <button
                disabled={accepting}
                onClick={() => {
                  setAcceptError(null);
                  startAccept(async () => {
                    const res = await acceptQuote(bookingId, quote.id);
                    if (res.error) setAcceptError(res.error);
                  });
                }}
                className="w-full rounded-full bg-emerald-600 py-3 font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
              >
                {accepting ? "Accepting…" : `Accept quote · $${Number(quote.total).toLocaleString()}`}
              </button>
              {acceptError && <p className="mt-2 text-sm text-red-400">{acceptError}</p>}
              <p className="mt-2 text-center text-xs text-slate-500">
                Accepting holds the aircraft for 24 hours while contracts and
                payment are completed.
              </p>
            </div>
          )}
        </div>
      )}

      {!quote && !showBuilder && (
        <p className="mt-3 text-sm text-slate-500">
          {role === "provider"
            ? "Send a quote to respond to this request."
            : "The operator has not quoted yet. You will be notified here."}
        </p>
      )}

      {showBuilder && canQuote && (
        <QuoteBuilder bookingId={bookingId} onDone={() => setShowBuilder(false)} />
      )}
    </section>
  );
}

function QuoteBuilder({ bookingId, onDone }: { bookingId: string; onDone: () => void }) {
  const [state, formAction, pending] = useActionState<EngineState, FormData>(
    async (prev, fd) => {
      const res = await sendQuote(bookingId, prev, fd);
      if (res.ok) onDone();
      return res;
    },
    {}
  );
  const [rows, setRows] = useState([
    { kind: "flight_time", description: "", quantity: "1", unit: "" },
  ]);

  const editableKinds = QUOTE_LINE_KINDS.filter((k) => !k.startsWith("tax_"));

  return (
    <form action={formAction} className="mt-4 space-y-3">
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_70px_110px_32px] items-center gap-2">
          <select
            name="item_kind"
            value={row.kind}
            onChange={(e) => update(i, { kind: e.target.value })}
            className={input}
          >
            {editableKinds.map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </select>
          <input
            name="item_description"
            value={row.description}
            onChange={(e) => update(i, { description: e.target.value })}
            placeholder="Description"
            className={input}
          />
          <input
            name="item_quantity"
            value={row.quantity}
            onChange={(e) => update(i, { quantity: e.target.value })}
            placeholder="Qty"
            className={input}
          />
          <input
            name="item_unit"
            value={row.unit}
            onChange={(e) => update(i, { unit: e.target.value })}
            placeholder="Unit $"
            className={input}
          />
          <button
            type="button"
            onClick={() => setRows((r) => r.filter((_, j) => j !== i))}
            className="text-slate-500 hover:text-red-400"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          setRows((r) => [...r, { kind: "other", description: "", quantity: "1", unit: "" }])
        }
        className="text-sm text-gold hover:underline"
      >
        + Add line
      </button>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="mb-1 block text-slate-400">Quote valid for (hours)</span>
          <input name="expires_hours" type="number" defaultValue={72} className={input} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-400">Note to traveler</span>
          <input name="notes" className={input} placeholder="Optional" />
        </label>
      </div>

      <p className="text-xs text-slate-500">
        US Federal Excise Tax (7.5%) and segment fees are added automatically.
      </p>
      {state.error && <p className="text-sm text-red-400">{state.error}</p>}
      <button
        disabled={pending}
        className="w-full rounded-full bg-gold py-2.5 font-medium text-ink hover:bg-gold-light disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send quote"}
      </button>
    </form>
  );

  function update(i: number, patch: Partial<(typeof rows)[number]>) {
    setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  }
}
