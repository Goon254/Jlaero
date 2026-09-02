import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SuspendButton } from "./SuspendButton";

export default async function AdminUsers({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  await requireRole("admin");
  const supabase = await createClient();

  let query = supabase
    .from("profiles")
    .select("id, full_name, company_name, account_type, verification, suspended_at, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (q) query = query.or(`full_name.ilike.%${q}%,company_name.ilike.%${q}%`);
  const { data: users } = await query;

  return (
    <main>
      <h1 className="text-2xl font-semibold">Users</h1>
      <form method="GET" className="mt-4">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search name or company…"
          className="w-full max-w-sm rounded-lg border border-slate-700 bg-ink-soft px-4 py-2.5 text-sm outline-none focus:border-gold"
        />
      </form>

      <ul className="mt-6 space-y-2">
        {(users ?? []).map((u) => (
          <li
            key={u.id}
            className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-ink-soft px-4 py-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {u.company_name || u.full_name || "(no name)"}
                {u.suspended_at && (
                  <span className="ml-2 rounded-full bg-red-900/60 px-2 py-0.5 text-xs text-red-300">
                    suspended
                  </span>
                )}
                {u.verification === "verified" && (
                  <span className="ml-2 rounded-full bg-emerald-900/60 px-2 py-0.5 text-xs text-emerald-300">
                    verified
                  </span>
                )}
              </p>
              <p className="text-xs text-slate-500">
                {u.account_type} · joined {new Date(u.created_at).toLocaleDateString()} ·{" "}
                <span className="font-mono">{u.id.slice(0, 8)}</span>
              </p>
            </div>
            <SuspendButton userId={u.id} suspended={Boolean(u.suspended_at)} />
          </li>
        ))}
      </ul>
    </main>
  );
}
