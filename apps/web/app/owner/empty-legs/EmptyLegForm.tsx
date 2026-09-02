"use client";

import { useActionState } from "react";
import { AirportInput } from "@/components/AirportInput";
import { createEmptyLeg, type EmptyLegState } from "./actions";

const input =
  "w-full rounded-lg border border-slate-700 bg-ink-soft px-4 py-3 outline-none focus:border-gold";

export function EmptyLegForm({ fleet }: { fleet: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<EmptyLegState, FormData>(
    createEmptyLeg,
    {}
  );

  if (!fleet.length) {
    return (
      <p className="rounded-xl border border-slate-800 bg-ink-soft p-4 text-sm text-slate-400">
        Publish an aircraft first, then post its empty legs here.
      </p>
    );
  }

  return (
    <form action={formAction} className="rounded-2xl border border-slate-800 bg-ink-soft/50 p-5">
      <h2 className="mb-4 font-semibold">Post an empty leg</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-slate-300">Aircraft</span>
          <select name="aircraft_id" className={input}>
            {fleet.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-300">From</span>
          <AirportInput name="origin" required />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-300">To</span>
          <AirportInput name="destination" required />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-300">Date</span>
          <input name="depart_date" type="date" required className={input} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-300">Departure time (UTC)</span>
          <input name="depart_time" type="time" defaultValue="12:00" className={input} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-300">Fixed price (USD, all-in)</span>
          <input name="price" type="number" required className={input} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-300">Seats available</span>
          <input name="seats" type="number" className={input} />
        </label>
      </div>
      {state.error && <p className="mt-3 text-sm text-red-400">{state.error}</p>}
      {state.ok && <p className="mt-3 text-sm text-emerald-400">Posted.</p>}
      <button
        disabled={pending}
        className="mt-4 rounded-full bg-gold px-5 py-2 text-sm font-medium text-ink hover:bg-gold-light disabled:opacity-60"
      >
        {pending ? "Posting…" : "Post empty leg"}
      </button>
    </form>
  );
}
