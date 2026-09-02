"use client";

import { useActionState } from "react";
import { AirportInput } from "@/components/AirportInput";
import { requestCrewHire, type CrewState } from "../actions";

const input =
  "w-full rounded-lg border border-slate-700 bg-ink-soft px-4 py-3 outline-none focus:border-gold";

export function HireForm({
  crewProfileId,
  signedIn,
}: {
  crewProfileId: string;
  signedIn: boolean;
}) {
  const [state, formAction, pending] = useActionState<CrewState, FormData>(
    requestCrewHire.bind(null, crewProfileId),
    {}
  );

  if (!signedIn) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-ink-soft p-6 text-center">
        <p className="text-sm text-slate-300">Sign in to hire this crew member.</p>
        <a
          href="/login"
          className="mt-4 inline-block rounded-full bg-gold px-6 py-2.5 text-sm font-medium text-ink hover:bg-gold-light"
        >
          Sign in
        </a>
      </div>
    );
  }

  return (
    <form action={formAction} className="rounded-2xl border border-slate-800 bg-ink-soft p-6">
      <h2 className="font-semibold">Request to hire</h2>
      <p className="mt-1 text-xs text-slate-400">
        They respond with a quote for the engagement. No payment yet.
      </p>
      <div className="mt-4 space-y-3">
        <AirportInput name="location" placeholder="Work location (airport)" required />
        <label className="block text-sm">
          <span className="mb-1 block text-slate-400">Engagement start</span>
          <input name="start_date" type="date" required className={input} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-400">Engagement end</span>
          <input name="end_date" type="date" required className={input} />
        </label>
        <textarea
          name="notes"
          rows={2}
          placeholder="Aircraft type, duty expectations, other details"
          className={input}
        />
      </div>
      {state.error && <p className="mt-3 text-sm text-red-400">{state.error}</p>}
      <button
        disabled={pending}
        className="mt-4 w-full rounded-full bg-gold py-3 font-medium text-ink hover:bg-gold-light disabled:opacity-60"
      >
        {pending ? "Sending…" : "Request hire"}
      </button>
    </form>
  );
}
