import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ServiceStatusButtons } from "./ServiceStatusButtons";

export default async function AdminServices() {
  await requireRole("admin");
  const supabase = await createClient();

  const { data } = await supabase
    .from("service_requests")
    .select(
      "id, category, airport, needed_from, needed_to, details, status, created_at, profiles:user_id(full_name, company_name, phone)"
    )
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <main>
      <h1 className="text-2xl font-semibold">Service requests</h1>
      <p className="mt-2 text-sm text-slate-400">
        FBO services, hangars, detailing. Source with local providers, respond
        with one final price, and update the status here.
      </p>

      {!data?.length ? (
        <div className="mt-10 rounded-2xl border border-dashed border-slate-700 p-12 text-center text-slate-400">
          No requests yet.
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {data.map((r) => {
            const p = r.profiles as unknown as {
              full_name: string | null;
              company_name: string | null;
              phone: string | null;
            } | null;
            return (
              <li key={r.id} className="rounded-2xl border border-slate-800 bg-ink-soft p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-medium capitalize">
                    {r.category.replace(/_/g, " ")}
                    <span className="ml-2 text-sm text-slate-400">
                      {r.airport ?? "location TBD"}
                      {r.needed_from ? ` · ${r.needed_from}` : ""}
                      {r.needed_to ? ` → ${r.needed_to}` : ""}
                    </span>
                  </p>
                  <ServiceStatusButtons requestId={r.id} status={r.status} />
                </div>
                <p className="mt-2 text-sm text-slate-300">{r.details}</p>
                <p className="mt-2 text-xs text-slate-500">
                  From {p?.company_name || p?.full_name || "unknown"}
                  {p?.phone ? ` · ${p.phone}` : ""} ·{" "}
                  {new Date(r.created_at).toLocaleString()}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
