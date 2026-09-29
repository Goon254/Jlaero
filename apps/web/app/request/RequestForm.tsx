"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AIRCRAFT_CATEGORIES, AIRCRAFT_CATEGORY_LABELS } from "@jlaero/shared";
import { AirportInput } from "@/components/AirportInput";
import { createClient } from "@/lib/supabase/client";

const input = "w-full rounded-lg border border-slate-700 bg-ink-soft px-4 py-3 outline-none focus:border-gold";
const CATEGORIES = AIRCRAFT_CATEGORIES.filter((c) => !["airliner", "helicopter"].includes(c));

export function RequestForm({ signedIn, userId }: { signedIn: boolean; userId: string | null }) {
  const supabase = createClient();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!signedIn) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-ink-soft p-8 text-center">
        <p className="text-slate-300">Sign in to request a trip. It takes a minute and keeps your quotes in one place.</p>
        <a href="/login?next=/request" className="mt-4 inline-block rounded-full bg-gold px-6 py-2.5 text-sm font-medium text-ink hover:bg-gold-light">Sign in</a>
      </div>
    );
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const origin = String(f.get("origin") ?? "").trim().toUpperCase();
    const destination = String(f.get("destination") ?? "").trim().toUpperCase();
    const depart = String(f.get("depart") ?? "");
    const ret = String(f.get("return") ?? "");
    const pax = Number(f.get("pax"));
    if (!origin || !destination) return setError("Pick both airports from the list");
    if (origin === destination) return setError("Origin and destination are the same");
    if (!depart) return setError("Choose a departure date and time");
    if (ret && new Date(ret) <= new Date(depart)) return setError("Return must be after departure");
    if (!pax || pax < 1) return setError("How many passengers?");
    setBusy(true); setError(null);
    const { data, error } = await supabase
      .from("trip_requests")
      .insert({
        traveler_id: userId, origin_icao: origin, destination_icao: destination,
        depart_at: new Date(depart).toISOString(), return_at: ret ? new Date(ret).toISOString() : null,
        passengers: pax, category_pref: String(f.get("category") ?? "") || null, notes: String(f.get("notes") ?? "").trim() || null,
      })
      .select("id")
      .single();
    setBusy(false);
    if (error) return setError(error.message.includes("airports") ? "Pick both airports from the list" : error.message);
    router.push(`/requests/${data.id}`);
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-slate-800 bg-ink-soft/50 p-5">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block"><span className="mb-1 block text-sm text-slate-300">From</span><AirportInput name="origin" placeholder="Departure airport or city" required /></label>
        <label className="block"><span className="mb-1 block text-sm text-slate-300">To</span><AirportInput name="destination" placeholder="Arrival airport or city" required /></label>
        <label className="block"><span className="mb-1 block text-sm text-slate-300">Departure</span><input name="depart" type="datetime-local" className={input} required /></label>
        <label className="block"><span className="mb-1 block text-sm text-slate-300">Return (optional)</span><input name="return" type="datetime-local" className={input} /></label>
        <label className="block"><span className="mb-1 block text-sm text-slate-300">Passengers</span><input name="pax" type="number" min={1} max={19} defaultValue={4} className={input} required /></label>
        <label className="block"><span className="mb-1 block text-sm text-slate-300">Cabin</span>
          <select name="category" className={input} defaultValue="">
            <option value="">Let Jlaero recommend</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{AIRCRAFT_CATEGORY_LABELS[c]}</option>)}
          </select>
        </label>
        <label className="block md:col-span-2"><span className="mb-1 block text-sm text-slate-300">Anything else</span>
          <textarea name="notes" className={`${input} min-h-[90px]`} placeholder="Pets, luggage, catering, a preferred FBO, flexible dates…" />
        </label>
      </div>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      <button disabled={busy} className="mt-5 w-full rounded-lg bg-gold py-3 font-medium text-ink hover:bg-gold-light disabled:opacity-60 md:w-auto md:px-8">
        {busy ? "Sending…" : "Get my options"}
      </button>
    </form>
  );
}
