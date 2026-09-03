"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const input =
  "w-full rounded-lg border border-slate-700 bg-ink-soft px-4 py-3 outline-none focus:border-gold";

const CATEGORIES = [
  { value: "hangar", label: "Hangar space" },
  { value: "detailing", label: "Aircraft detailing" },
  { value: "fbo_services", label: "FBO services" },
  { value: "maintenance", label: "Maintenance" },
  { value: "catering", label: "Catering" },
  { value: "ground_transport", label: "Ground transport" },
  { value: "other", label: "Something else" },
] as const;

export function ServiceRequestForm({
  signedIn,
  userId,
}: {
  signedIn: boolean;
  userId: string | null;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [category, setCategory] = useState("hangar");
  const [airport, setAirport] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!signedIn) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-ink-soft p-8 text-center">
        <p className="text-slate-300">Sign in to request services.</p>
        <a
          href="/login"
          className="mt-4 inline-block rounded-full bg-gold px-6 py-2.5 text-sm font-medium text-ink hover:bg-gold-light"
        >
          Sign in
        </a>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!details.trim()) return setError("Describe what you need");
    setBusy(true);
    setError(null);
    const { error } = await supabase.from("service_requests").insert({
      user_id: userId,
      category,
      airport: airport.trim().toUpperCase() || null,
      needed_from: from || null,
      needed_to: to || null,
      details: details.trim().slice(0, 4000),
    });
    setBusy(false);
    if (error) return setError(error.message);
    setDone(true);
    router.refresh();
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-800 bg-emerald-950/40 p-8 text-center">
        <p className="text-lg font-semibold text-emerald-300">Request received</p>
        <p className="mt-2 text-sm text-slate-300">
          Our operations team is on it. You will hear from us shortly with one
          final price.
        </p>
        <button
          onClick={() => {
            setDone(false);
            setDetails("");
          }}
          className="mt-4 rounded-full border border-slate-700 px-5 py-2 text-sm hover:border-gold hover:text-gold"
        >
          Request something else
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-800 bg-ink-soft/50 p-6">
      <label className="block">
        <span className="mb-1 block text-sm text-slate-300">Service</span>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={input}>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-sm text-slate-300">Airport</span>
          <input value={airport} onChange={(e) => setAirport(e.target.value)} maxLength={4} placeholder="KTEB" className={input} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-300">From</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={input} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-300">To</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={input} />
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-sm text-slate-300">What do you need?</span>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={4}
          className={input}
          placeholder="e.g. Heated hangar for a G550, two weeks in January; or full exterior and interior detail before a sale"
        />
      </label>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        disabled={busy}
        className="w-full rounded-full bg-gold py-3 font-medium text-ink hover:bg-gold-light disabled:opacity-60"
      >
        {busy ? "Sending…" : "Request service"}
      </button>
    </form>
  );
}
