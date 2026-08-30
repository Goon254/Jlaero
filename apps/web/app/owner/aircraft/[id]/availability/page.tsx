import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { removeBlock } from "../../actions";
import { AddBlockForm } from "./AddBlockForm";

export default async function Availability({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireRole("owner");
  const supabase = await createClient();

  const { data: aircraft } = await supabase
    .from("aircraft")
    .select("id, name")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!aircraft) notFound();

  const { data: blocks } = await supabase
    .from("aircraft_availability")
    .select("id, starts_at, ends_at, is_blocked, kind")
    .eq("aircraft_id", id)
    .order("starts_at");

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });

  return (
    <main>
      <Link href={`/owner/aircraft/${id}/edit`} className="text-sm text-slate-400 hover:text-gold">
        ← {aircraft.name}
      </Link>
      <h1 className="mt-1 text-2xl font-semibold">Availability</h1>
      <p className="mt-2 max-w-xl text-sm text-slate-400">
        Your aircraft is bookable unless a date range is blocked here or already
        covered by an accepted booking. Add blocks for owner use or maintenance.
      </p>

      <div className="mt-8 max-w-xl">
        <AddBlockForm aircraftId={id} />
      </div>

      <section className="mt-8 max-w-xl">
        <h2 className="mb-3 font-semibold">Blocked ranges</h2>
        {!blocks?.length ? (
          <p className="text-sm text-slate-500">
            No blocks. The aircraft shows as available for all dates.
          </p>
        ) : (
          <ul className="space-y-2">
            {blocks.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between rounded-xl border border-slate-800 bg-ink-soft px-4 py-3"
              >
                <span className="text-sm">
                  {fmt(b.starts_at)} → {fmt(b.ends_at)}
                  <span
                    className={`ml-3 rounded-full px-2 py-0.5 text-xs ${
                      b.kind === "maintenance"
                        ? "bg-amber-900/60 text-amber-300"
                        : "bg-slate-800 text-slate-300"
                    }`}
                  >
                    {b.kind}
                  </span>
                </span>
                <form action={removeBlock.bind(null, id, b.id)}>
                  <button className="text-sm text-slate-400 hover:text-red-400">
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
