"use client";

import { useActionState } from "react";
import { saveNotificationPrefs, type SettingsState } from "../actions";

const ROWS = [
  { name: "email_bookings", label: "Booking updates by email" },
  { name: "email_messages", label: "New messages by email" },
  { name: "push_bookings", label: "Booking updates by push (mobile app)" },
  { name: "push_messages", label: "New messages by push (mobile app)" },
  { name: "email_marketing", label: "News and offers (marketing)" },
] as const;

export function NotificationForm({
  defaults,
}: {
  defaults: Record<string, boolean>;
}) {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(
    saveNotificationPrefs,
    {}
  );

  return (
    <form action={formAction} className="max-w-md space-y-3 rounded-2xl border border-slate-800 bg-ink-soft/50 p-6">
      {ROWS.map((r) => (
        <label key={r.name} className="flex items-center justify-between gap-4 text-sm">
          {r.label}
          <input
            type="checkbox"
            name={r.name}
            defaultChecked={defaults[r.name]}
            className="h-4 w-4 accent-gold"
          />
        </label>
      ))}
      <p className="pt-1 text-xs text-slate-500">
        Transactional notices required to complete a booking are always sent.
      </p>
      {state.error && <p className="text-sm text-red-400">{state.error}</p>}
      {state.ok && <p className="text-sm text-emerald-400">Saved.</p>}
      <button disabled={pending} className="w-full rounded-full bg-gold py-2.5 text-sm font-medium text-ink hover:bg-gold-light disabled:opacity-60">
        {pending ? "Saving…" : "Save preferences"}
      </button>
    </form>
  );
}
