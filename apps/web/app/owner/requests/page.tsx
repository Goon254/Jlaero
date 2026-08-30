import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type RequestRow = {
  id: string;
  status: string;
  created_at: string;
  pets: boolean;
  special_requests: string | null;
  aircraft: { name: string } | null;
  profiles: { full_name: string | null } | null;
  booking_legs: {
    position: number;
    origin: string;
    destination: string | null;
    depart_at: string | null;
    passengers: number | null;
  }[];
};

export default async function OwnerRequests() {
  const user = await requireRole("owner");
  const supabase = await createClient();

  const { data } = await supabase
    .from("bookings")
    .select(
      "id, status, created_at, pets, special_requests, aircraft(name), profiles:buyer_id(full_name), booking_legs(position, origin, destination, depart_at, passengers)"
    )
    .eq("provider_id", user.id)
    .in("status", ["requested", "quoted", "negotiating"])
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as unknown as RequestRow[];

  return (
    <main>
      <h1 className="text-2xl font-semibold">Booking requests</h1>
      <p className="mt-2 text-sm text-slate-400">
        Incoming charter requests for your aircraft. Quoting and messaging
        arrive in the next build phase; for now you can see everything a buyer
        sends.
      </p>

      {!rows.length ? (
        <div className="mt-10 rounded-2xl border border-dashed border-slate-700 p-12 text-center text-slate-400">
          No open requests right now.
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {rows.map((b) => {
            const legs = [...b.booking_legs].sort((x, y) => x.position - y.position);
            return (
              <li key={b.id}>
                <a
                  href={`/bookings/${b.id}`}
                  className="block rounded-2xl border border-slate-800 bg-ink-soft p-5 hover:border-gold"
                >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">
                    {b.profiles?.full_name ?? "A traveler"}
                    <span className="ml-2 text-sm text-slate-400">
                      requests {b.aircraft?.name ?? "your aircraft"}
                    </span>
                  </p>
                  <span className="rounded-full bg-sky-900/60 px-3 py-1 text-xs capitalize text-sky-300">
                    {b.status}
                  </span>
                </div>
                <ul className="mt-3 space-y-1 text-sm text-slate-300">
                  {legs.map((l) => (
                    <li key={l.position}>
                      {l.origin} → {l.destination}
                      {l.depart_at
                        ? ` on ${new Date(l.depart_at).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                            timeZone: "UTC",
                          })} UTC`
                        : ""}
                      {l.passengers ? ` · ${l.passengers} pax` : ""}
                    </li>
                  ))}
                </ul>
                {(b.pets || b.special_requests) && (
                  <p className="mt-2 text-xs text-slate-500">
                    {b.pets ? "Traveling with pets. " : ""}
                    {b.special_requests ?? ""}
                  </p>
                )}
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
