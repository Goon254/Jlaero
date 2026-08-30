"use client";

import { useActionState } from "react";
import { addPassenger, removePassenger, type EngineState } from "./actions";

export function ManifestEditor({
  bookingId,
  passengers,
  editable,
}: {
  bookingId: string;
  passengers: { id: string; full_name: string; date_of_birth: string | null }[];
  editable: boolean;
}) {
  const [state, formAction, pending] = useActionState<EngineState, FormData>(
    addPassenger.bind(null, bookingId),
    {}
  );

  return (
    <section className="rounded-2xl border border-slate-800 bg-ink-soft p-5">
      <h2 className="font-semibold">Passenger manifest</h2>
      <p className="mt-1 text-xs text-slate-500">
        Full legal names as on ID. Required before the charter agreement is
        signed.
      </p>

      {passengers.length > 0 && (
        <ul className="mt-3 space-y-2">
          {passengers.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-lg bg-ink px-3 py-2 text-sm"
            >
              <span>
                {p.full_name}
                {p.date_of_birth && (
                  <span className="ml-2 text-xs text-slate-500">{p.date_of_birth}</span>
                )}
              </span>
              {editable && (
                <button
                  onClick={() => removePassenger(bookingId, p.id)}
                  className="text-slate-500 hover:text-red-400"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {editable && (
        <form action={formAction} className="mt-3 flex gap-2">
          <input
            name="full_name"
            placeholder="Full name"
            required
            className="flex-1 rounded-lg border border-slate-700 bg-ink px-3 py-2 text-sm outline-none focus:border-gold"
          />
          <input
            name="date_of_birth"
            type="date"
            className="rounded-lg border border-slate-700 bg-ink px-3 py-2 text-sm outline-none focus:border-gold"
          />
          <button
            disabled={pending}
            className="rounded-full bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700 disabled:opacity-60"
          >
            Add
          </button>
        </form>
      )}
      {state.error && <p className="mt-2 text-sm text-red-400">{state.error}</p>}
    </section>
  );
}
