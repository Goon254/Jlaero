import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function CrewRequests() {
  const user = await requireRole("crew");
  const supabase = await createClient();

  const { data } = await supabase
    .from("bookings")
    .select(
      "id, status, created_at, special_requests, profiles:buyer_id(full_name, company_name), booking_legs(position, origin, depart_at)"
    )
    .eq("provider_id", user.id)
    .eq("kind", "crew")
    .in("status", ["requested", "quoted", "negotiating"])
    .order("created_at", { ascending: false });

  return (
    <PageShell
      title="Hire requests"
      subtitle="Open requests to hire you. Quote and negotiate from the booking page."
    >
      {!data?.length ? (
        <div className="rounded-2xl border border-dashed border-slate-700 p-12 text-center text-slate-400">
          No open requests right now.
        </div>
      ) : (
        <ul className="space-y-4">
          {data.map((b) => {
            const legs = [...(b.booking_legs ?? [])].sort((x, y) => x.position - y.position);
            const buyer = b.profiles as unknown as {
              full_name: string | null;
              company_name: string | null;
            } | null;
            const from = legs[0]?.depart_at;
            const to = legs[legs.length - 1]?.depart_at;
            const fmt = (iso?: string | null) =>
              iso
                ? new Date(iso).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    timeZone: "UTC",
                  })
                : "";
            return (
              <li key={b.id}>
                <Link
                  href={`/bookings/${b.id}`}
                  className="block rounded-2xl border border-slate-800 bg-ink-soft p-5 hover:border-gold"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">
                      {buyer?.company_name || buyer?.full_name || "Someone"} wants to
                      hire you
                      <span className="ml-2 text-sm text-slate-400">
                        at {legs[0]?.origin ?? "?"} · {fmt(from)} → {fmt(to)}
                      </span>
                    </p>
                    <span className="rounded-full bg-sky-900/60 px-3 py-1 text-xs capitalize text-sky-300">
                      {b.status}
                    </span>
                  </div>
                  {b.special_requests && (
                    <p className="mt-2 text-sm text-slate-400">{b.special_requests}</p>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}
