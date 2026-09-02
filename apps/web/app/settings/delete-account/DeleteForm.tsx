"use client";

import { useActionState } from "react";
import { deleteAccount, type SettingsState } from "../actions";

export function DeleteForm() {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(
    deleteAccount,
    {}
  );

  return (
    <form action={formAction} className="mt-5 space-y-3">
      <input
        name="confirm"
        placeholder='Type DELETE to confirm'
        className="w-full rounded-lg border border-slate-700 bg-ink px-4 py-3 text-sm outline-none focus:border-red-600"
      />
      {state.error && <p className="text-sm text-red-400">{state.error}</p>}
      <button
        disabled={pending}
        className="w-full rounded-full bg-red-700 py-3 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-60"
      >
        {pending ? "Deleting…" : "Delete my account"}
      </button>
    </form>
  );
}
