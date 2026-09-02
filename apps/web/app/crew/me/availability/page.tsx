import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { removeCrewBlock } from "../../actions";
import { CrewBlockForm } from "./CrewBlockForm";

export default async function CrewAvailability() {
  const user = await requireRole("crew");
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("crew_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: blocks } = profile
    ? await supabase
        .from("crew_availability")
        .select("id, starts_at, ends_at")
        .eq("crew_profile_id", profile.id)
        .order("starts_at")
    : { data: [] };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });

  return (
    <PageShell
      title="My availability"
      subtitle="You appear available unless a range is blocked here or covered by an accepted engagement."
    >
      <Link href="/crew/me" className="text-sm text-slate-400 hover:text-gold">
        ← My crew profile
      </Link>

      {!profile ? (
        <p className="mt-8 text-sm text-slate-400">
          Create your crew profile first.
        </p>
      ) : (
        <>
          <div className="mt-6 max-w-xl">
            <CrewBlockForm />
          </div>
          <section className="mt-8 max-w-xl">
            <h2 className="mb-3 font-semibold">Blocked ranges</h2>
            {!blocks?.length ? (
              <p className="text-sm text-slate-500">No blocks.</p>
            ) : (
              <ul className="space-y-2">
                {blocks.map((b) => (
                  <li
                    key={b.id}
                    className="flex items-center justify-between rounded-xl border border-slate-800 bg-ink-soft px-4 py-3 text-sm"
                  >
                    <span>
                      {fmt(b.starts_at)} → {fmt(b.ends_at)}
                    </span>
                    <form action={removeCrewBlock.bind(null, b.id)}>
                      <button className="text-slate-400 hover:text-red-400">Remove</button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </PageShell>
  );
}
