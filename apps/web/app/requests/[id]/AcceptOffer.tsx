"use client";

import { useState, useTransition } from "react";
import { acceptOffer } from "./actions";

export function AcceptOffer({ offerId, operatorName, price, currency }: { offerId: string; operatorName: string; price: number; currency: string }) {
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!confirm) {
    return <button onClick={() => setConfirm(true)} className="w-full rounded-full bg-gold py-2.5 text-sm font-medium text-ink hover:bg-gold-light">Choose this option</button>;
  }
  return (
    <div className="rounded-xl border border-slate-700 bg-ink p-4 text-sm">
      <p className="font-medium text-slate-100">Before you continue</p>
      <ul className="mt-2 space-y-1 text-slate-300">
        <li>Jlaero is acting as an air charter broker, not as the direct air carrier.</li>
        <li>This flight will be operated by <span className="font-medium text-slate-100">{operatorName}</span>, an FAA Part 135 certificated carrier in operational control of the aircraft.</li>
        <li>Your total is {currency} {price.toLocaleString()}, including taxes and fees stated in the offer. Third-party items you pay directly, if any, are listed in the offer.</li>
        <li>Jlaero&apos;s liability insurance position and the carrier&apos;s coverage limits are stated in your charter agreement before signature.</li>
      </ul>
      {error && <p className="mt-2 text-red-400">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button disabled={pending} onClick={() => start(async () => { const r = await acceptOffer(offerId); if (r && "error" in r) setError(r.error); })}
          className="rounded-full bg-gold px-5 py-2 text-sm font-medium text-ink hover:bg-gold-light disabled:opacity-60">
          {pending ? "Booking…" : "I understand, book it"}
        </button>
        <button onClick={() => setConfirm(false)} className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300">Back</button>
      </div>
    </div>
  );
}
