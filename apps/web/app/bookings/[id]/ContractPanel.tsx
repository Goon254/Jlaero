"use client";

import { useActionState, useState } from "react";
import { signContract, type PayState } from "./paymentActions";

export function ContractPanel({
  bookingId,
  role,
  bookingStatus,
  contract,
  summary,
}: {
  bookingId: string;
  role: "buyer" | "provider";
  bookingStatus: string;
  contract: {
    status: string;
    buyer_signer_name: string | null;
    buyer_signed_at: string | null;
  } | null;
  summary: { route: string; aircraftName: string; total: string; operator: string; traveler: string };
}) {
  const [state, formAction, pending] = useActionState<PayState, FormData>(
    signContract.bind(null, bookingId),
    {}
  );
  const [showText, setShowText] = useState(false);

  const needsSignature = bookingStatus === "accepted" && role === "buyer";
  const signed = contract?.status === "signed";

  if (!needsSignature && !signed && bookingStatus !== "accepted") return null;

  return (
    <section className="rounded-2xl border border-slate-800 bg-ink-soft p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Charter agreement</h2>
        {signed && (
          <span className="rounded-full bg-emerald-900/60 px-3 py-1 text-xs text-emerald-300">
            ✓ Signed by {contract?.buyer_signer_name}
          </span>
        )}
      </div>

      <button
        onClick={() => setShowText((s) => !s)}
        className="mt-2 text-sm text-gold hover:underline"
      >
        {showText ? "Hide agreement" : "Read the agreement"}
      </button>

      {showText && (
        <div className="mt-3 max-h-64 space-y-2 overflow-y-auto rounded-lg bg-ink p-4 text-xs leading-relaxed text-slate-300">
          <p className="font-semibold">AIR CHARTER AGREEMENT (Template v1)</p>
          <p>
            This Charter Agreement is entered into between {summary.operator}
            {" "}(the &quot;Operator&quot;) and {summary.traveler} (the
            &quot;Charterer&quot;) for the charter flight {summary.route} aboard{" "}
            {summary.aircraftName}, for the total charter price of{" "}
            {summary.total} as itemized in the accepted quote.
          </p>
          <p>
            1. CARRIER OF RECORD. The Operator is the air carrier of record and
            holds operational control of the flight at all times. Jlaero is a
            technology marketplace facilitating this booking and is not an air
            carrier or charter operator.
          </p>
          <p>
            2. PAYMENT. Payment is due through the Jlaero platform per the
            accepted quote. Funds are held by the platform and released to the
            Operator after flight completion.
          </p>
          <p>
            3. CANCELLATION. Cancellations follow the listing&apos;s published
            cancellation policy. Operator-initiated, weather, or mechanical
            cancellations refund the Charterer in full.
          </p>
          <p>
            4. PASSENGERS. The Charterer warrants the accuracy of the passenger
            manifest and compliance with applicable identification and customs
            requirements.
          </p>
          <p>
            5. LIABILITY. The Operator maintains insurance appropriate to the
            operation. To the maximum extent permitted by law, Jlaero disclaims
            liability arising from the operation of the flight.
          </p>
          <p className="text-slate-500">
            Template v1. To be reviewed by counsel before public launch
            (ROADMAP 3c).
          </p>
        </div>
      )}

      {needsSignature && !signed && (
        <form action={formAction} className="mt-4 space-y-3">
          <input
            name="signer_name"
            placeholder="Type your full legal name to sign"
            required
            className="w-full rounded-lg border border-slate-700 bg-ink px-4 py-3 text-sm outline-none focus:border-gold"
          />
          <label className="flex items-center gap-3 text-sm text-slate-300">
            <input type="checkbox" name="agree" required className="h-4 w-4 accent-gold" />
            I have read and agree to the charter agreement
          </label>
          {state.error && <p className="text-sm text-red-400">{state.error}</p>}
          <button
            disabled={pending}
            className="w-full rounded-full bg-gold py-3 font-medium text-ink hover:bg-gold-light disabled:opacity-60"
          >
            {pending ? "Signing…" : "Sign agreement"}
          </button>
        </form>
      )}

      {bookingStatus === "accepted" && role === "provider" && !signed && (
        <p className="mt-3 text-sm text-slate-400">
          Waiting for the traveler to sign. The 24h hold is on.
        </p>
      )}
    </section>
  );
}
