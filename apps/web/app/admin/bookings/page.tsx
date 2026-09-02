import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AdminBookings() {
  await requireRole("admin");
  const supabase = await createClient();

  const { data } = await supabase
    .from("bookings")
    .select(
      "id, kind, status, created_at, aircraft(name), booking_legs(position, origin, destination)"
    )
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <main>
      <h1 className="text-2xl font-semibold">All bookings</h1>
      <ul className="mt-6 space-y-2">
        {(data ?? []).map((b) => {
          const legs = [...(b.booking_legs ?? [])].sort((x, y) => x.position - y.position);
          const aircraft = b.aircraft as unknown as { name: string } | null;
          return (
            <li key={b.id}>
              <Link
                href={`/bookings/${b.id}`}
                className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-ink-soft px-4 py-3 text-sm hover:border-gold"
              >
                <span>
                  {legs[0] ? `${legs[0].origin} → ${legs[0].destination ?? ""}` : b.kind}
                  <span className="ml-2 text-slate-400">{aircraft?.name ?? ""}</span>
                  <span className="ml-2 font-mono text-xs text-slate-600">
                    {b.id.slice(0, 8)}
                  </span>
                </span>
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs capitalize text-slate-300">
                  {b.status.replace(/_/g, " ")}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-xs text-slate-500">
        Disputed bookings are refunded/overridden from the booking page or via
        Stripe; every override is audited.
      </p>
    </main>
  );
}
