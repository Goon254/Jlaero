"use client";

import { useActionState } from "react";
import { CREW_KINDS } from "@jlaero/shared";
import { AirportInput } from "@/components/AirportInput";
import { saveCrewProfile, type CrewState } from "../actions";

const input =
  "w-full rounded-lg border border-slate-700 bg-ink-soft px-4 py-3 outline-none focus:border-gold";

const KIND_LABELS: Record<string, string> = {
  captain: "Captain",
  first_officer: "First Officer",
  flight_attendant: "Flight Attendant",
  engineer: "Engineer",
  other: "Other",
};

type ProfileValues = {
  headline: string;
  crew_kind: string;
  total_hours: number | null;
  day_rate: number | null;
  home_base: string;
  bio: string;
  licenses: string;
  type_ratings: string;
  medical_class: string;
  medical_expires: string;
};

export function CrewProfileForm({ profile }: { profile: ProfileValues | null }) {
  const [state, formAction, pending] = useActionState<CrewState, FormData>(
    saveCrewProfile,
    {}
  );

  return (
    <form action={formAction} className="space-y-5 rounded-2xl border border-slate-800 bg-ink-soft/50 p-6">
      <Field label="Headline *">
        <input
          name="headline"
          required
          defaultValue={profile?.headline}
          className={input}
          placeholder="ATP captain, 6,000 hrs, G550/GLEX typed, worldwide"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Role">
          <select name="crew_kind" defaultValue={profile?.crew_kind ?? "captain"} className={input}>
            {CREW_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Home base *">
          <AirportInput name="home_base" defaultValue={profile?.home_base} />
        </Field>
        <Field label="Total flight hours">
          <input name="total_hours" type="number" defaultValue={profile?.total_hours ?? ""} className={input} />
        </Field>
        <Field label="Day rate (USD) *">
          <input name="day_rate" type="number" step="50" defaultValue={profile?.day_rate ?? ""} className={input} />
        </Field>
        <Field label="Licenses (comma separated)">
          <input name="licenses" defaultValue={profile?.licenses} className={input} placeholder="ATP, FCC RRP" />
        </Field>
        <Field label="Type ratings (comma separated)">
          <input name="type_ratings" defaultValue={profile?.type_ratings} className={input} placeholder="G550, GLEX, CL30" />
        </Field>
        <Field label="Medical class">
          <select name="medical_class" defaultValue={profile?.medical_class ?? ""} className={input}>
            <option value="">Not stated</option>
            <option>First Class</option>
            <option>Second Class</option>
            <option>EASA Class 1</option>
          </select>
        </Field>
        <Field label="Medical expires">
          <input name="medical_expires" type="date" defaultValue={profile?.medical_expires ?? ""} className={input} />
        </Field>
      </div>
      <Field label="About you">
        <textarea
          name="bio"
          rows={4}
          defaultValue={profile?.bio}
          className={input}
          placeholder="Experience, aircraft flown, international experience, availability patterns…"
        />
      </Field>

      {state.error && <p className="text-sm text-red-400">{state.error}</p>}
      {state.ok && <p className="text-sm text-emerald-400">Saved.</p>}
      <button
        disabled={pending}
        className="rounded-full bg-gold px-6 py-3 font-medium text-ink hover:bg-gold-light disabled:opacity-60"
      >
        {pending ? "Saving…" : profile ? "Save changes" : "Create profile"}
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
