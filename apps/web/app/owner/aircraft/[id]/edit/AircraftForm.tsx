"use client";

import { useActionState } from "react";
import {
  AIRCRAFT_CATEGORIES,
  AIRCRAFT_CATEGORY_LABELS,
  ARGUS_RATINGS,
  WYVERN_RATINGS,
  IS_BAO_STAGES,
} from "@jlaero/shared";
import { AirportInput } from "@/components/AirportInput";
import { saveAircraft, type ActionState } from "../../actions";

const input =
  "w-full rounded-lg border border-slate-700 bg-ink-soft px-4 py-3 outline-none focus:border-gold";

type Aircraft = {
  id: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  year: number | null;
  category: string | null;
  seats: number | null;
  tail_number: string | null;
  home_base: string | null;
  description: string | null;
  hourly_rate: number | null;
  currency: string;
  instant_book: boolean;
  daily_minimum_hours: number | null;
  overnight_crew_fee: number | null;
  positioning_included: boolean;
  range_nm: number | null;
  min_runway_ft: number | null;
  argus_rating: string | null;
  wyvern_rating: string | null;
  is_bao_stage: string | null;
  cancellation_tier: string;
};

export function AircraftForm({ aircraft }: { aircraft: Aircraft }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    saveAircraft.bind(null, aircraft.id),
    {}
  );

  return (
    <form action={formAction} className="space-y-8">
      <Section title="Aircraft">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Listing name *">
            <input name="name" required defaultValue={aircraft.name} className={input} />
          </Field>
          <Field label="Tail number">
            <input name="tail_number" defaultValue={aircraft.tail_number ?? ""} className={input} placeholder="N123JL" />
          </Field>
          <Field label="Manufacturer">
            <input name="manufacturer" defaultValue={aircraft.manufacturer ?? ""} className={input} placeholder="Gulfstream" />
          </Field>
          <Field label="Model">
            <input name="model" defaultValue={aircraft.model ?? ""} className={input} placeholder="G550" />
          </Field>
          <Field label="Year">
            <input name="year" type="number" defaultValue={aircraft.year ?? ""} className={input} />
          </Field>
          <Field label="Category">
            <select name="category" defaultValue={aircraft.category ?? ""} className={input}>
              <option value="">Select…</option>
              {AIRCRAFT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {AIRCRAFT_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Seats">
            <input name="seats" type="number" defaultValue={aircraft.seats ?? ""} className={input} />
          </Field>
          <Field label="Home base">
            <AirportInput name="home_base" defaultValue={aircraft.home_base} />
          </Field>
        </div>
        <Field label="Description">
          <textarea
            name="description"
            rows={4}
            defaultValue={aircraft.description ?? ""}
            className={input}
            placeholder="Cabin layout, amenities, wifi, typical missions…"
          />
        </Field>
      </Section>

      <Section title="Performance (powers search feasibility)">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Range (nautical miles)">
            <input name="range_nm" type="number" defaultValue={aircraft.range_nm ?? ""} className={input} />
          </Field>
          <Field label="Minimum runway (ft)">
            <input name="min_runway_ft" type="number" defaultValue={aircraft.min_runway_ft ?? ""} className={input} />
          </Field>
        </div>
      </Section>

      <Section title="Pricing">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Hourly rate (USD)">
            <input name="hourly_rate" type="number" step="0.01" defaultValue={aircraft.hourly_rate ?? ""} className={input} />
          </Field>
          <Field label="Daily minimum (hours)">
            <input name="daily_minimum_hours" type="number" step="0.5" defaultValue={aircraft.daily_minimum_hours ?? ""} className={input} />
          </Field>
          <Field label="Overnight crew fee (USD)">
            <input name="overnight_crew_fee" type="number" step="0.01" defaultValue={aircraft.overnight_crew_fee ?? ""} className={input} />
          </Field>
          <Field label="Cancellation policy">
            <select name="cancellation_tier" defaultValue={aircraft.cancellation_tier} className={input}>
              <option value="flexible">Flexible</option>
              <option value="moderate">Moderate</option>
              <option value="strict">Strict</option>
            </select>
          </Field>
        </div>
        <div className="flex flex-wrap gap-6 pt-2">
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              name="positioning_included"
              defaultChecked={aircraft.positioning_included}
              className="h-4 w-4 accent-gold"
            />
            Positioning included in hourly rate
          </label>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              name="instant_book"
              defaultChecked={aircraft.instant_book}
              className="h-4 w-4 accent-gold"
            />
            Allow instant book (computed pricing, launches later)
          </label>
        </div>
      </Section>

      <Section title="Safety ratings (verified during operator review)">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="ARGUS">
            <select name="argus_rating" defaultValue={aircraft.argus_rating ?? ""} className={input}>
              <option value="">None</option>
              {ARGUS_RATINGS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </Field>
          <Field label="Wyvern">
            <select name="wyvern_rating" defaultValue={aircraft.wyvern_rating ?? ""} className={input}>
              <option value="">None</option>
              {WYVERN_RATINGS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </Field>
          <Field label="IS-BAO">
            <select name="is_bao_stage" defaultValue={aircraft.is_bao_stage ?? ""} className={input}>
              <option value="">None</option>
              {IS_BAO_STAGES.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </Field>
        </div>
      </Section>

      {state.error && <p className="text-sm text-red-400">{state.error}</p>}
      {state.ok && <p className="text-sm text-emerald-400">Saved.</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-gold px-6 py-3 font-medium text-ink hover:bg-gold-light disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-ink-soft/50 p-6">
      <h2 className="mb-4 font-semibold">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
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
