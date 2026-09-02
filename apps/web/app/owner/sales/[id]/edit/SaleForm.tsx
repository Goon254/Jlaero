"use client";

import { useActionState } from "react";
import { saveSaleListing, type SaleState } from "../../actions";

const input =
  "w-full rounded-lg border border-slate-700 bg-ink-soft px-4 py-3 outline-none focus:border-gold";

type Listing = {
  id: string;
  title: string;
  manufacturer: string | null;
  model: string | null;
  year: number | null;
  price: number | null;
  location: string | null;
  description: string | null;
};

export function SaleForm({ listing }: { listing: Listing }) {
  const [state, formAction, pending] = useActionState<SaleState, FormData>(
    saveSaleListing.bind(null, listing.id),
    {}
  );

  return (
    <form action={formAction} className="space-y-4 rounded-2xl border border-slate-800 bg-ink-soft/50 p-6">
      <Field label="Listing title *">
        <input name="title" required defaultValue={listing.title} className={input} placeholder="2016 Gulfstream G550, fresh 96-month inspection" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Manufacturer">
          <input name="manufacturer" defaultValue={listing.manufacturer ?? ""} className={input} />
        </Field>
        <Field label="Model">
          <input name="model" defaultValue={listing.model ?? ""} className={input} />
        </Field>
        <Field label="Year">
          <input name="year" type="number" defaultValue={listing.year ?? ""} className={input} />
        </Field>
        <Field label="Asking price (USD) *">
          <input name="price" type="number" defaultValue={listing.price ?? ""} className={input} />
        </Field>
      </div>
      <Field label="Location">
        <input name="location" defaultValue={listing.location ?? ""} className={input} placeholder="Teterboro, NJ" />
      </Field>
      <Field label="Description">
        <textarea
          name="description"
          rows={6}
          defaultValue={listing.description ?? ""}
          className={input}
          placeholder="Airframe and engine times, maintenance programs, avionics, interior configuration, damage history…"
        />
      </Field>

      {state.error && <p className="text-sm text-red-400">{state.error}</p>}
      {state.ok && <p className="text-sm text-emerald-400">Saved.</p>}
      <button
        disabled={pending}
        className="rounded-full bg-gold px-6 py-3 font-medium text-ink hover:bg-gold-light disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
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
