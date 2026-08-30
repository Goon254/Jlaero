"use client";

import { useActionState, useState } from "react";
import { AirportInput } from "@/components/AirportInput";
import { requestCharter, type RequestState } from "./actions";

const input =
  "w-full rounded-lg border border-slate-700 bg-ink-soft px-4 py-3 outline-none focus:border-gold";

export function RequestForm({
  aircraftId,
  homeBase,
  signedIn,
}: {
  aircraftId: string;
  homeBase: string | null;
  signedIn: boolean;
}) {
  const [state, formAction, pending] = useActionState<RequestState, FormData>(
    requestCharter.bind(null, aircraftId),
    {}
  );
  const [tripType, setTripType] = useState<"one_way" | "round_trip">("one_way");

  if (!signedIn) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-ink-soft p-6 text-center">
        <p className="text-sm text-slate-300">Sign in to request this aircraft.</p>
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
      <h2 className="font-semibold">Request this aircraft</h2>
      <p className="mt-1 text-xs text-slate-400">
        The operator responds with a full quote. No payment yet.
      </p>

      <div className="mt-4 flex rounded-full border border-slate-800 p-1 text-sm">
        {(["one_way", "round_trip"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTripType(t)}
            className={`flex-1 rounded-full py-1.5 ${
              tripType === t ? "bg-gold text-ink" : "text-slate-400"
            }`}
          >
            {t === "one_way" ? "One way" : "Round trip"}
          </button>
        ))}
      </div>
      <input type="hidden" name="trip_type" value={tripType} />

      <div className="mt-4 space-y-3">
        <AirportInput name="origin" defaultValue={homeBase} placeholder="From" required />
        <AirportInput name="destination" placeholder="To" required />
        <div className="grid grid-cols-2 gap-3">
          <input name="depart_date" type="date" required className={input} />
          <input name="depart_time" type="time" defaultValue="10:00" className={input} />
        </div>
        {tripType === "round_trip" && (
          <div className="grid grid-cols-2 gap-3">
            <input name="return_date" type="date" className={input} />
            <input name="return_time" type="time" defaultValue="10:00" className={input} />
          </div>
        )}
        <input
          name="passengers"
          type="number"
          min={1}
          required
          placeholder="Passengers"
          className={input}
        />
        <label className="flex items-center gap-3 text-sm text-slate-300">
          <input type="checkbox" name="pets" className="h-4 w-4 accent-gold" />
          Traveling with pets
        </label>
        <textarea
          name="special_requests"
          rows={2}
          placeholder="Catering, ground transport, other requests (optional)"
          className={input}
        />
      </div>

      {state.error && <p className="mt-3 text-sm text-red-400">{state.error}</p>}

      <button
        disabled={pending}
        className="mt-4 w-full rounded-full bg-gold py-3 font-medium text-ink hover:bg-gold-light disabled:opacity-60"
      >
        {pending ? "Sending…" : "Request quote"}
      </button>
    </form>
  );
}
