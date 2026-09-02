import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AuditLog() {
  await requireRole("admin");
  const supabase = await createClient();

  const { data } = await supabase
    .from("audit_logs")
    .select("id, action, target_type, target_id, meta, created_at, profiles:actor_id(full_name)")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <main>
      <h1 className="text-2xl font-semibold">Audit log</h1>
      <ul className="mt-6 space-y-1">
        {(data ?? []).map((row) => {
          const actor = row.profiles as unknown as { full_name: string | null } | null;
          return (
            <li
              key={row.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-slate-800/60 bg-ink-soft px-4 py-2.5 text-sm"
            >
              <span>
                <span className="font-medium text-gold">{row.action}</span>
                <span className="ml-2 text-slate-400">
                  {row.target_type} <span className="font-mono text-xs">{String(row.target_id).slice(0, 8)}</span>
                </span>
                {row.meta && Object.keys(row.meta as object).length > 0 && (
                  <span className="ml-2 text-xs text-slate-500">
                    {JSON.stringify(row.meta)}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-xs text-slate-500">
                {actor?.full_name ?? "system"} ·{" "}
                {new Date(row.created_at).toLocaleString()}
              </span>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
