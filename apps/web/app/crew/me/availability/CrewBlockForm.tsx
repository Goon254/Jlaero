"use client";

import { useActionState } from "react";
import { addCrewBlock, type CrewState } from "../../actions";

const input =
  "w-full rounded-lg border border-slate-700 bg-ink-soft px-4 py-3 outline-none focus:border-gold";

export function CrewBlockForm() {
  const [state, formAction, pending] = useActionState<CrewState, FormData>(
    addCrewBlock,
    {}
  );

  return (
    <form action={formAction} className="rounded-2xl border border-slate-800 bg-ink-soft/50 p-5">
      <h2 className="mb-4 font-semibold">Block dates</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-slate-300">From</span>
          <input name="starts_at" type="date" required className={input} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-300">To</span>
          <input name="ends_at" type="date" required className={input} />
        </label>
      </div>
      {state.error && <p className="mt-3 text-sm text-red-400">{state.error}</p>}
      <button
        disabled={pending}
        className="mt-4 rounded-full bg-gold px-5 py-2 text-sm font-medium text-ink hover:bg-gold-light disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add block"}
      </button>
    </form>
  );
}
