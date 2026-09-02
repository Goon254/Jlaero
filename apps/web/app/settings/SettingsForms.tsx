"use client";

import { useActionState } from "react";
import { changePassword, updateProfile, type SettingsState } from "./actions";

const input =
  "w-full rounded-lg border border-slate-700 bg-ink-soft px-4 py-3 outline-none focus:border-gold";

export function SettingsForms({
  profile,
}: {
  profile: { full_name: string; company_name: string; home_base: string };
}) {
  const [pState, pAction, pPending] = useActionState<SettingsState, FormData>(
    updateProfile,
    {}
  );
  const [wState, wAction, wPending] = useActionState<SettingsState, FormData>(
    changePassword,
    {}
  );

  return (
    <div className="space-y-6">
      <form action={pAction} className="rounded-2xl border border-slate-800 bg-ink-soft/50 p-6">
        <h2 className="mb-4 font-semibold">Profile</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm text-slate-300">Full name</span>
            <input name="full_name" required defaultValue={profile.full_name} className={input} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-slate-300">Company</span>
            <input name="company_name" defaultValue={profile.company_name} className={input} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-slate-300">Phone</span>
            <input name="phone" className={input} placeholder="+1 555 000 0000" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-slate-300">Home airport</span>
            <input name="home_base" defaultValue={profile.home_base} maxLength={4} className={input} placeholder="KJFK" />
          </label>
        </div>
        {pState.error && <p className="mt-3 text-sm text-red-400">{pState.error}</p>}
        {pState.ok && <p className="mt-3 text-sm text-emerald-400">Saved.</p>}
        <button disabled={pPending} className="mt-4 rounded-full bg-gold px-6 py-2.5 text-sm font-medium text-ink hover:bg-gold-light disabled:opacity-60">
          {pPending ? "Saving…" : "Save profile"}
        </button>
      </form>

      <form action={wAction} className="rounded-2xl border border-slate-800 bg-ink-soft/50 p-6">
        <h2 className="mb-4 font-semibold">Change password</h2>
        <input
          name="new_password"
          type="password"
          minLength={8}
          required
          placeholder="New password (8+ characters)"
          className={input}
        />
        {wState.error && <p className="mt-3 text-sm text-red-400">{wState.error}</p>}
        {wState.ok && <p className="mt-3 text-sm text-emerald-400">Password updated.</p>}
        <button disabled={wPending} className="mt-4 rounded-full border border-slate-700 px-6 py-2.5 text-sm hover:border-gold hover:text-gold disabled:opacity-60">
          {wPending ? "Updating…" : "Update password"}
        </button>
      </form>
    </div>
  );
}
