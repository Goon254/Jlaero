import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { HideButton, ReportButtons } from "./ModerationButtons";

export default async function AdminListings() {
  await requireRole("admin");
  const supabase = await createClient();

  const [{ data: reports }, { data: aircraft }] = await Promise.all([
    supabase
      .from("reports")
      .select("id, target_type, target_id, reason, details, created_at")
      .eq("status", "open")
      .order("created_at"),
    supabase
      .from("aircraft")
      .select("id, name, status, profiles:owner_id(full_name, company_name)")
      .in("status", ["active", "paused"])
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  return (
    <main>
      <h1 className="text-2xl font-semibold">Listings & moderation</h1>

      <section className="mt-8">
        <h2 className="mb-3 font-semibold">
          Open reports ({reports?.length ?? 0})
        </h2>
        {!reports?.length ? (
          <p className="text-sm text-slate-500">No open reports.</p>
        ) : (
          <ul className="space-y-2">
            {reports.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-amber-800/60 bg-amber-950/20 px-4 py-3"
              >
                <div className="min-w-0 text-sm">
                  <p className="font-medium">
                    {r.target_type} reported: {r.reason}
                  </p>
                  {r.details && <p className="text-xs text-slate-400">{r.details}</p>}
                  <p className="mt-0.5 font-mono text-xs text-slate-500">
                    {r.target_id}
                  </p>
                </div>
                <ReportButtons reportId={r.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 font-semibold">Aircraft listings</h2>
        <ul className="space-y-2">
          {(aircraft ?? []).map((a) => {
            const owner = a.profiles as unknown as {
              full_name: string | null;
              company_name: string | null;
            } | null;
            return (
              <li
                key={a.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-ink-soft px-4 py-3"
              >
                <div className="text-sm">
                  <span className="font-medium">{a.name}</span>
                  <span className="ml-2 text-slate-400">
                    {owner?.company_name || owner?.full_name || ""}
                  </span>
                  <span
                    className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                      a.status === "active"
                        ? "bg-emerald-900/60 text-emerald-300"
                        : "bg-amber-900/60 text-amber-300"
                    }`}
                  >
                    {a.status}
                  </span>
                </div>
                <HideButton aircraftId={a.id} hidden={a.status !== "active"} />
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
