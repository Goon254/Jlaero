import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { RoleToggles } from "./RoleToggles";
import { SuspendButton } from "./SuspendButton";

export default async function AdminUsers({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const me = await requireRole("admin");
  const supabase = await createClient();

  let query = supabase
    .from("profiles")
    .select("id, full_name, company_name, account_type, verification, suspended_at, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (q) query = query.or(`full_name.ilike.%${q}%,company_name.ilike.%${q}%`);
  const { data: users } = await query;
  const ids = (users ?? []).map((u) => u.id);
  const roleRows = ids.length ? await db()`select user_id, role::text as role from user_roles where user_id = any(${ids})` : [];
  const rolesFor = (id: string) => roleRows.filter((r) => r.user_id === id).map((r) => r.role as string);

  return (
    <main>
      <h1 className="text-2xl font-semibold">Users</h1>
      <p className="mt-1 text-sm text-slate-400">
        Staff roles: Broker runs trips, quotes and operators. Finance verifies payments and records operator payments. Admin does both plus settings and users.
      </p>
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
            className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-ink-soft px-4 py-3"
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
            <div className="flex flex-wrap items-center justify-end gap-3">
              <RoleToggles userId={u.id} roles={rolesFor(u.id)} isSelf={u.id === me.id} />
              <SuspendButton userId={u.id} suspended={Boolean(u.suspended_at)} />
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
