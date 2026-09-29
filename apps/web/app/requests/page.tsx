import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const LABEL: Record<string, string> = {
  open: "Received", sourcing: "Sourcing aircraft", offers_ready: "Options ready", accepted: "Accepted", booked: "Booked", closed: "Closed", expired: "Expired",
};

export default async function MyRequests() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("trip_requests")
    .select("id, origin_icao, destination_icao, depart_at, passengers, status, booking_id")
    .eq("traveler_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <PageShell title="My trip requests" subtitle="Every request and the options we found for it.">
      <div className="mb-6"><Link href="/request" className="rounded-full bg-gold px-5 py-2 text-sm font-medium text-ink hover:bg-gold-light">Request a new trip</Link></div>
      {!data?.length ? (
        <div className="rounded-2xl border border-dashed border-slate-700 p-10 text-center text-slate-400">No requests yet.</div>
      ) : (
        <ul className="divide-y divide-slate-800 rounded-2xl border border-slate-800 bg-ink-soft">
          {data.map((r) => (
            <li key={r.id}>
              <Link href={r.booking_id ? `/bookings/${r.booking_id}` : `/requests/${r.id}`} className="flex flex-wrap items-center gap-4 px-5 py-4 hover:bg-slate-800/40">
                <span className="font-medium">{r.origin_icao} → {r.destination_icao}</span>
                <span className="text-sm text-slate-400">{new Date(r.depart_at).toLocaleString()} · {r.passengers} pax</span>
                <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs ${r.status === "offers_ready" ? "bg-emerald-900/50 text-emerald-200" : "bg-slate-800 text-slate-300"}`}>{LABEL[r.status] ?? r.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
