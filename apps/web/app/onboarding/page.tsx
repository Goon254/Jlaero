"use client";

import { useActionState, useState } from "react";
import { completeOnboarding, type OnboardingState } from "./actions";

const initial: OnboardingState = {};

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-ink-soft px-4 py-3 outline-none focus:border-gold";

export default function OnboardingPage() {
  const [state, formAction, pending] = useActionState(completeOnboarding, initial);
  const [accountKind, setAccountKind] = useState<"traveler" | "operator">("traveler");

  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <h1 className="text-3xl font-semibold">Welcome to Jlaero</h1>
      <p className="mt-2 text-slate-400">Tell us a bit about you to finish setup.</p>

      <form action={formAction} className="mt-8 space-y-5">
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <label
            className={`cursor-pointer rounded-2xl border p-4 ${
              accountKind === "traveler"
                ? "border-gold bg-gold/10"
                : "border-slate-800 bg-ink-soft"
            }`}
          >
            <input
              type="radio"
              name="account_kind"
              value="traveler"
              checked={accountKind === "traveler"}
              onChange={() => setAccountKind("traveler")}
              className="hidden"
            />
            <p className="font-semibold">Traveler</p>
            <p className="mt-1 text-sm text-slate-400">
              Book charters and request services.
            </p>
          </label>
          <label
            className={`cursor-pointer rounded-2xl border p-4 ${
              accountKind === "operator"
                ? "border-gold bg-gold/10"
                : "border-slate-800 bg-ink-soft"
            }`}
          >
            <input
              type="radio"
              name="account_kind"
              value="operator"
              checked={accountKind === "operator"}
              onChange={() => setAccountKind("operator")}
              className="hidden"
            />
            <p className="font-semibold">Owner / Operator</p>
            <p className="mt-1 text-sm text-slate-400">
              Operate aircraft, fulfil charters, sell aircraft.
            </p>
          </label>
        </fieldset>

        <Field label="Full name">
          <input name="full_name" required className={inputClass} placeholder="Jane Aviator" />
        </Field>

        {accountKind === "operator" && (
          <>
            <Field label="Company name">
              <input name="company_name" className={inputClass} placeholder="Acme Air LLC" />
            </Field>
            <input type="hidden" name="account_type" value="business" />
          </>
        )}
        {accountKind === "traveler" && (
          <input type="hidden" name="account_type" value="individual" />
        )}

        <Field label="Home airport (optional)">
          <input name="home_base" className={inputClass} placeholder="KJFK" maxLength={4} />
        </Field>

        {state.error && <p className="text-sm text-red-400">{state.error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-gold py-3 font-medium text-ink hover:bg-gold-light disabled:opacity-60"
        >
          {pending ? "Saving…" : "Finish setup"}
        </button>
      </form>
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
