"use client";

// Manual payment reporting (spec s10, blueprint s19). The client picks how
// they paid, sees the company's instructions, and reports a reference and an
// optional proof file. Card numbers are never collected here.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, CreditCard, Landmark, Wallet } from "lucide-react";
import { formatMoney, PAYMENT_METHOD_LABELS, PAYMENT_METHODS, type PaymentMethod } from "@jlaero/shared";
import { createClient } from "@/lib/supabase/client";
import { buttonClass, cx, inputClass } from "@/components/lux/ui";
import { submitPayment } from "./actions";

const ICONS: Record<PaymentMethod, typeof CreditCard> = {
  credit_card: CreditCard,
  ach: Building2,
  wire: Landmark,
  direct_deposit: Wallet,
};

export function PaymentForm({ tripId, paymentId, amount, currency, instructions, terms }: {
  tripId: string;
  paymentId: string;
  amount: number;
  currency: string;
  instructions: Record<string, string>;
  terms: string | null;
}) {
  const router = useRouter();
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (!method) return setError("Choose how you paid.");
    setBusy(true);
    setError(null);
    let proofPath: string | null = null;
    const file = f.get("proof");
    if (file instanceof File && file.size > 0) {
      if (file.size > 10 * 1024 * 1024) {
        setBusy(false);
        return setError("The proof file must be under 10 MB.");
      }
      const safe = file.name.replace(/[^A-Za-z0-9._-]/g, "_").slice(-80);
      proofPath = `${tripId}/client/${Date.now()}-${safe}`;
      const { error: upErr } = await createClient().storage.from("trip-docs").upload(proofPath, file, { upsert: false });
      if (upErr) {
        setBusy(false);
        return setError("The file could not be uploaded. Try again or submit without it.");
      }
    }
    const reference = String(f.get("reference") ?? "").trim() || null;
    const note = String(f.get("note") ?? "").trim() || null;
    const res = await submitPayment(tripId, { paymentId, method, reference, note, proofPath });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setDone(res.message ?? "Submitted.");
    router.refresh();
  }

  if (done) {
    return <p role="status" className="rounded-xl bg-ok-soft px-4 py-3 text-sm font-medium text-ok">{done}</p>;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <fieldset>
        <legend className="mb-3 text-sm font-medium text-fg">How are you paying {formatMoney(amount, currency)}?</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {PAYMENT_METHODS.map((m) => {
            const Icon = ICONS[m];
            const selected = method === m;
            return (
              <label
                key={m}
                className={cx(
                  "flex min-h-[64px] cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition",
                  selected ? "border-accent bg-accent-soft" : "border-line-strong bg-surface hover:bg-raised"
                )}
              >
                <input type="radio" name="method" value={m} checked={selected} onChange={() => setMethod(m)} className="sr-only" />
                <Icon className={cx("h-5 w-5 shrink-0", selected ? "text-accent-text" : "text-fg-2")} aria-hidden />
                <span className="font-medium">{PAYMENT_METHOD_LABELS[m]}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {method && (
        <div className="rounded-xl border border-line bg-raised p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-fg-3">{PAYMENT_METHOD_LABELS[method]} instructions</p>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">
            {instructions[method] || "Your broker will send the details for this payment method."}
          </p>
          {method === "credit_card" && (
            <p className="mt-2 text-xs text-fg-3">For your security we never ask for card numbers in this form. Use the secure link your broker sends.</p>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="reference" className="mb-1.5 block text-sm font-medium">Payment reference</label>
          <input id="reference" name="reference" className={inputClass} placeholder="Bank or transaction reference" />
          <p className="mt-1 text-xs text-fg-3">Helps us match your payment quickly.</p>
        </div>
        <div>
          <label htmlFor="proof" className="mb-1.5 block text-sm font-medium">Proof of payment (optional)</label>
          <input id="proof" name="proof" type="file" accept="application/pdf,image/*" className={cx(inputClass, "file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-soft file:px-3 file:py-1.5 file:text-sm file:text-fg")} />
        </div>
      </div>
      <div>
        <label htmlFor="note" className="mb-1.5 block text-sm font-medium">Note for your broker (optional)</label>
        <textarea id="note" name="note" rows={2} className={cx(inputClass, "min-h-[72px]")} />
      </div>
      {terms && <p className="text-xs text-fg-3">{terms}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy} aria-busy={busy} className={buttonClass("primary")}>
          {busy ? "Submitting..." : "I have sent this payment"}
        </button>
        <p aria-live="polite" className="text-sm text-bad">{error}</p>
      </div>
    </form>
  );
}
