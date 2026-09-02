"use client";

import { useState, useTransition } from "react";
import { completeTrip, startCheckout, startTrip, type PayState } from "./paymentActions";

export function PayPanel({
  bookingId,
  role,
  bookingStatus,
  total,
  capturedTotal,
}: {
  bookingId: string;
  role: "buyer" | "provider";
  bookingStatus: string;
  total: number;
  capturedTotal: number;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<PayState>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res?.error) setError(res.error);
    });
  }

  const remaining = Math.max(0, total - capturedTotal);
  const deposit = Math.round(total * 0.25 * 100) / 100;

  const buyerPays =
    role === "buyer" && ["contract_signed", "deposit_paid"].includes(bookingStatus);
  const providerControls =
    role === "provider" && ["paid_in_full", "in_progress"].includes(bookingStatus);

  if (!buyerPays && !providerControls && capturedTotal === 0) return null;

  return (
    <section className="rounded-2xl border border-slate-800 bg-ink-soft p-5">
      <h2 className="font-semibold">Payment</h2>

      {capturedTotal > 0 && (
        <p className="mt-2 text-sm text-slate-300">
          Paid so far:{" "}
          <span className="font-medium text-emerald-400">
            ${capturedTotal.toLocaleString()}
          </span>
          {remaining > 0 && (
            <span className="text-slate-500"> · ${remaining.toLocaleString()} remaining</span>
          )}
        </p>
      )}

      {buyerPays && bookingStatus === "contract_signed" && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            disabled={pending}
            onClick={() => run(() => startCheckout(bookingId, "deposit"))}
            className="rounded-full border border-gold py-3 text-sm font-medium text-gold hover:bg-gold/10 disabled:opacity-60"
          >
            Pay 25% deposit · ${deposit.toLocaleString()}
          </button>
          <button
            disabled={pending}
            onClick={() => run(() => startCheckout(bookingId, "full"))}
            className="rounded-full bg-gold py-3 text-sm font-medium text-ink hover:bg-gold-light disabled:opacity-60"
          >
            Pay in full · ${total.toLocaleString()}
          </button>
        </div>
      )}

      {buyerPays && bookingStatus === "deposit_paid" && (
        <button
          disabled={pending}
          onClick={() => run(() => startCheckout(bookingId, "balance"))}
          className="mt-4 w-full rounded-full bg-gold py-3 text-sm font-medium text-ink hover:bg-gold-light disabled:opacity-60"
        >
          Pay balance · ${remaining.toLocaleString()}
        </button>
      )}

      {providerControls && bookingStatus === "paid_in_full" && (
        <button
          disabled={pending}
          onClick={() => run(() => startTrip(bookingId))}
          className="mt-4 w-full rounded-full bg-gold py-3 text-sm font-medium text-ink hover:bg-gold-light disabled:opacity-60"
        >
          Start trip
        </button>
      )}
      {providerControls && bookingStatus === "in_progress" && (
        <button
          disabled={pending}
          onClick={() => run(() => completeTrip(bookingId))}
          className="mt-4 w-full rounded-full bg-emerald-600 py-3 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
        >
          Complete trip and release payout
        </button>
      )}

      {role === "buyer" && bookingStatus === "deposit_paid" && (
        <p className="mt-2 text-center text-xs text-slate-500">
          Balance is due before departure.
        </p>
      )}
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      <p className="mt-3 text-center text-[11px] text-slate-600">
        Payments processed by Stripe. Test mode: use card 4242 4242 4242 4242.
      </p>
    </section>
  );
}
