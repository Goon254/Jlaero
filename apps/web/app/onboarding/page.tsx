"use client";

import { useActionState } from "react";
import { useState } from "react";
import { completeOnboarding, type OnboardingState } from "./actions";

const initial: OnboardingState = {};

export default function OnboardingPage() {
  const [state, formAction, pending] = useActionState(completeOnboarding, initial);
  const [accountType, setAccountType] = useState<"individual" | "business">("individual");

  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <h1 className="text-3xl font-semibold">Welcome to Jlaero</h1>
      <p className="mt-2 text-slate-400">Tell us a bit about you to finish setup.</p>

      <form action={formAction} className="mt-8 space-y-5">
        <Field label="Full name">
          <input
            name="full_name"
            required
            className="input"
            placeholder="Jane Aviator"
          />
        </Field>

        <Field label="Account type">
          <select
            name="account_type"
            value={accountType}
            onChange={(e) => setAccountType(e.target.value as "individual" | "business")}
            className="input"
          >
            <option value="individual">Individual</option>
            <option value="business">Business</option>
          </select>
        </Field>

        {accountType === "business" && (
          <Field label="Company name">
            <input name="company_name" className="input" placeholder="Acme Air LLC" />
          </Field>
        )}

        <Field label="Home base airport (optional)">
          <input name="home_base" className="input" placeholder="KJFK" maxLength={4} />
        </Field>

        <fieldset className="space-y-3 rounded-lg border border-slate-800 p-4">
          <legend className="px-1 text-sm text-slate-400">
            What do you want to do? (You can always change this later)
          </legend>
          <p className="text-sm text-slate-500">
            Everyone can book charters and crew. Enable more if you want to:
          </p>
          <label className="flex items-center gap-3">
            <input type="checkbox" name="wants_owner" className="h-4 w-4 accent-gold" />
            <span>List aircraft for charter or sale (owner/operator)</span>
          </label>
          <label className="flex items-center gap-3">
            <input type="checkbox" name="wants_crew" className="h-4 w-4 accent-gold" />
            <span>Offer my services as pilot or crew</span>
          </label>
        </fieldset>

        {state.error && <p className="text-sm text-red-400">{state.error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-gold py-3 font-medium text-ink hover:bg-gold-light disabled:opacity-60"
        >
          {pending ? "Saving…" : "Finish setup"}
        </button>
      </form>

      <style>{`
        .input {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid rgb(51 65 85);
          background: #1a2436;
          padding: 0.75rem 1rem;
          outline: none;
        }
        .input:focus { border-color: #c9a24b; }
      `}</style>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-slate-300">{label}</span>
      {children}
    </label>
  );
}
