import { PageShell } from "@/components/PageShell";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ServiceRequestForm } from "./ServiceRequestForm";

export default async function Services() {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { data: mine } = user
    ? await supabase
        .from("service_requests")
        .select("id, category, airport, status, details, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10)
    : { data: null };

  return (
    <PageShell
      title="Aviation services"
      subtitle="Hangars, FBO services, aircraft detailing, catering, ground transport. Tell us what you need; our operations team sources it."
    >
      <div className="grid max-w-4xl gap-8 lg:grid-cols-[1fr_320px]">
        <ServiceRequestForm signedIn={Boolean(user)} userId={user?.id ?? null} />

        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-ink-soft p-5 text-sm text-slate-300">
            <p className="font-semibold text-slate-100">How it works</p>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-slate-400">
              <li>Describe the service and where you need it.</li>
              <li>Our team confirms availability with local providers.</li>
              <li>You get one final price. Approve and it is arranged.</li>
            </ol>
          </div>
          {(mine?.length ?? 0) > 0 && (
            <div className="rounded-2xl border border-slate-800 bg-ink-soft p-5">
              <p className="mb-2 text-sm font-semibold">Your requests</p>
              <ul className="space-y-2 text-sm">
                {mine!.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2">
                    <span className="capitalize text-slate-300">
                      {r.category.replace(/_/g, " ")}
                      {r.airport ? ` · ${r.airport}` : ""}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs capitalize ${
                        r.status === "open"
                          ? "bg-sky-900/60 text-sky-300"
                          : r.status === "fulfilled"
                            ? "bg-emerald-900/60 text-emerald-300"
                            : "bg-slate-800 text-slate-300"
                      }`}
                    >
                      {r.status.replace(/_/g, " ")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </PageShell>
  );
}
