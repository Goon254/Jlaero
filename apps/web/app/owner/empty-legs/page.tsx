import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { deactivateEmptyLeg } from "./actions";
import { EmptyLegForm } from "./EmptyLegForm";

export default async function OwnerEmptyLegs() {
  const user = await requireRole("owner");
  const supabase = await createClient();

  const [{ data: fleet }, { data: legs }] = await Promise.all([
    supabase
      .from("aircraft")
      .select("id, name")
      .eq("owner_id", user.id)
      .eq("status", "active"),
    supabase
      .from("empty_legs")
      .select("id, origin, destination, depart_at, price, seats, status, aircraft!inner(name, owner_id)")
      .eq("aircraft.owner_id", user.id)
      .order("depart_at"),
  ]);

  return (
    <main>
      <h1 className="text-2xl font-semibold">Empty legs</h1>
      <p className="mt-2 max-w-xl text-sm text-slate-400">
        Repositioning flights sold at a fixed all-in price. They appear on the
        charter page and book instantly at your price.
      </p>

      <div className="mt-6 max-w-2xl">
        <EmptyLegForm fleet={fleet ?? []} />
      </div>

      <section className="mt-8 max-w-2xl">
        <h2 className="mb-3 font-semibold">Your empty legs</h2>
        {!legs?.length ? (
          <p className="text-sm text-slate-500">None posted.</p>
        ) : (
          <ul className="space-y-2">
            {legs.map((l) => {
              const aircraft = l.aircraft as unknown as { name: string };
              return (
                <li
                  key={l.id}
                  className="flex items-center justify-between rounded-xl border border-slate-800 bg-ink-soft px-4 py-3 text-sm"
                >
                  <span>
                    <span className="font-medium">
                      {l.origin} → {l.destination}
                    </span>
                    <span className="ml-2 text-slate-400">
                      {new Date(l.depart_at).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                        timeZone: "UTC",
                      })}{" "}
                      UTC · {aircraft.name} · ${Number(l.price).toLocaleString()}
                    </span>
                    {l.status !== "active" && (
                      <span className="ml-2 rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                        {l.status}
                      </span>
                    )}
                  </span>
                  {l.status === "active" && (
                    <form action={deactivateEmptyLeg.bind(null, l.id)}>
                      <button className="text-slate-400 hover:text-red-400">Remove</button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
