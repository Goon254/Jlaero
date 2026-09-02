import Link from "next/link";
import { CREW_KINDS } from "@jlaero/shared";
import { PageShell } from "@/components/PageShell";
import { createClient } from "@/lib/supabase/server";

const KIND_LABELS: Record<string, string> = {
  captain: "Captain",
  first_officer: "First Officer",
  flight_attendant: "Flight Attendant",
  engineer: "Engineer",
  other: "Crew",
};

export default async function CrewBrowse({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; base?: string; max_rate?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("crew_profiles")
    .select(
      "id, headline, crew_kind, total_hours, day_rate, home_base, licenses, type_ratings, profiles:user_id(full_name, verification)"
    )
    .eq("status", "active");
  if (params.kind) query = query.eq("crew_kind", params.kind);
  if (params.base) query = query.eq("home_base", params.base.toUpperCase());
  if (params.max_rate) query = query.lte("day_rate", Number(params.max_rate));

  const { data: crew } = await query.limit(100);

  return (
    <PageShell
      title="Hire pilots & crew"
      subtitle="Certified captains, first officers, and cabin crew for your operation."
    >
      <form method="GET" className="mb-8 flex flex-wrap gap-3">
        <select
          name="kind"
          defaultValue={params.kind ?? ""}
          className="rounded-lg border border-slate-700 bg-ink-soft px-4 py-2.5 text-sm outline-none focus:border-gold"
        >
          <option value="">Any role</option>
          {CREW_KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABELS[k]}
            </option>
          ))}
        </select>
        <input
          name="base"
          defaultValue={params.base ?? ""}
          placeholder="Home base (e.g. KTEB)"
          maxLength={4}
          className="w-40 rounded-lg border border-slate-700 bg-ink-soft px-4 py-2.5 text-sm outline-none focus:border-gold"
        />
        <input
          name="max_rate"
          type="number"
          defaultValue={params.max_rate ?? ""}
          placeholder="Max day rate"
          className="w-36 rounded-lg border border-slate-700 bg-ink-soft px-4 py-2.5 text-sm outline-none focus:border-gold"
        />
        <button className="rounded-lg bg-gold px-6 py-2.5 text-sm font-medium text-ink hover:bg-gold-light">
          Filter
        </button>
      </form>

      {!crew?.length ? (
        <div className="rounded-2xl border border-dashed border-slate-700 p-12 text-center text-slate-400">
          No crew match yet. Are you a pilot or cabin crew?{" "}
          <Link href="/crew/me" className="text-gold hover:underline">
            Create your profile →
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {crew.map((c) => {
            const p = c.profiles as unknown as {
              full_name: string | null;
              verification: string;
            } | null;
            return (
              <li key={c.id}>
                <Link
                  href={`/crew/${c.id}`}
                  className="block rounded-2xl border border-slate-800 bg-ink-soft p-5 hover:border-gold"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        {p?.full_name ?? "Crew member"}
                        {p?.verification === "verified" && (
                          <span className="ml-2 text-sm text-emerald-400">✓</span>
                        )}
                      </p>
                      <p className="text-sm text-gold">
                        {KIND_LABELS[c.crew_kind] ?? c.crew_kind}
                      </p>
                    </div>
                    {c.day_rate && (
                      <p className="shrink-0 text-right">
                        <span className="font-semibold">
                          ${Number(c.day_rate).toLocaleString()}
                        </span>
                        <span className="text-xs text-slate-500">/day</span>
                      </p>
                    )}
                  </div>
                  {c.headline && (
                    <p className="mt-2 text-sm text-slate-300">{c.headline}</p>
                  )}
                  <p className="mt-2 text-xs text-slate-500">
                    {c.total_hours ? `${c.total_hours.toLocaleString()} hrs` : ""}
                    {c.home_base ? ` · ${c.home_base}` : ""}
                    {Array.isArray(c.type_ratings) && c.type_ratings.length
                      ? ` · ${(c.type_ratings as string[]).slice(0, 3).join(", ")}`
                      : ""}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}
