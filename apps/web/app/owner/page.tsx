import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function OwnerOverview() {
  const user = await requireRole("owner");
  const supabase = await createClient();

  const { data: aircraft } = await supabase
    .from("aircraft")
    .select("id, status")
    .eq("owner_id", user.id);

  const counts = { active: 0, draft: 0, paused: 0, archived: 0 };
  for (const a of aircraft ?? []) {
    counts[a.status as keyof typeof counts] =
      (counts[a.status as keyof typeof counts] ?? 0) + 1;
  }

  return (
    <main>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Owner overview</h1>
        <Link
          href="/owner/aircraft/new"
          className="rounded-full bg-gold px-5 py-2 text-sm font-medium text-ink hover:bg-gold-light"
        >
          + List an aircraft
        </Link>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-4">
        <Stat label="Active listings" value={counts.active} />
        <Stat label="Drafts" value={counts.draft} />
        <Stat label="Paused" value={counts.paused} />
        <Stat label="Booking requests" value={0} hint="Phase 3" />
      </section>

      <section className="mt-10 grid gap-4 sm:grid-cols-2">
        <Link
          href="/owner/aircraft"
          className="rounded-2xl border border-slate-800 bg-ink-soft p-6 hover:border-gold"
        >
          <h2 className="font-semibold">Manage aircraft</h2>
          <p className="mt-1 text-sm text-slate-400">
            Listings, photos, pricing, and availability.
          </p>
        </Link>
        <Link
          href="/owner/documents"
          className="rounded-2xl border border-slate-800 bg-ink-soft p-6 hover:border-gold"
        >
          <h2 className="font-semibold">Verification documents</h2>
          <p className="mt-1 text-sm text-slate-400">
            Operator certificate, insurance, registration. Required to go live
            at launch.
          </p>
        </Link>
      </section>
    </main>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-ink-soft p-5">
      <p className="text-3xl font-semibold">{value}</p>
      <p className="mt-1 text-sm text-slate-400">
        {label}
        {hint && <span className="ml-1 text-slate-600">({hint})</span>}
      </p>
    </div>
  );
}
