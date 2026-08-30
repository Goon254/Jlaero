"use client";

import { AIRCRAFT_CATEGORIES, AIRCRAFT_CATEGORY_LABELS } from "@jlaero/shared";
import { AirportInput } from "@/components/AirportInput";

const input =
  "w-full rounded-lg border border-slate-700 bg-ink-soft px-4 py-3 outline-none focus:border-gold";

export function SearchForm({
  defaults,
}: {
  defaults: Record<string, string | undefined>;
}) {
  return (
    <form
      method="GET"
      className="rounded-2xl border border-slate-800 bg-ink-soft/50 p-5"
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-sm text-slate-300">From</span>
          <AirportInput name="origin" defaultValue={defaults.origin} placeholder="Origin airport" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-300">To</span>
          <AirportInput name="destination" defaultValue={defaults.destination} placeholder="Destination airport" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-300">Departure</span>
          <input name="date" type="date" defaultValue={defaults.date} className={input} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-300">Passengers</span>
          <input name="pax" type="number" min={1} defaultValue={defaults.pax} className={input} placeholder="4" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-300">Category</span>
          <select name="category" defaultValue={defaults.category ?? ""} className={input}>
            <option value="">Any</option>
            {AIRCRAFT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {AIRCRAFT_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-300">Max hourly rate (USD)</span>
          <input name="max_hourly" type="number" defaultValue={defaults.max_hourly} className={input} placeholder="Any" />
        </label>
        <div className="flex items-end lg:col-span-2">
          <button className="w-full rounded-lg bg-gold py-3 font-medium text-ink hover:bg-gold-light">
            Search aircraft
          </button>
        </div>
      </div>
    </form>
  );
}
