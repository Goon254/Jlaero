import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { publicPhotoUrl } from "@/lib/storage";

export default async function Favorites() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: favs } = await supabase
    .from("favorites")
    .select("target_type, target_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const aircraftIds = (favs ?? [])
    .filter((f) => f.target_type === "aircraft")
    .map((f) => f.target_id);

  const { data: aircraft } = aircraftIds.length
    ? await supabase
        .from("aircraft")
        .select("id, name, manufacturer, model, seats, hourly_rate, status, aircraft_photos(file_path, position)")
        .in("id", aircraftIds)
    : { data: [] };

  return (
    <PageShell title="Saved listings">
      {!aircraft?.length ? (
        <div className="rounded-2xl border border-dashed border-slate-700 p-12 text-center text-slate-400">
          Nothing saved yet. Tap ♡ Save on any listing.
        </div>
      ) : (
        <ul className="grid gap-6 md:grid-cols-2">
          {aircraft.map((a) => {
            const cover = [...(a.aircraft_photos ?? [])].sort(
              (x, y) => x.position - y.position
            )[0];
            return (
              <li key={a.id}>
                <Link
                  href={`/charter/${a.id}`}
                  className="block overflow-hidden rounded-2xl border border-slate-800 bg-ink-soft hover:border-gold"
                >
                  <div className="aspect-[16/9] bg-slate-900">
                    {cover && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={publicPhotoUrl("aircraft-photos", cover.file_path)}
                        alt={a.name}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="p-4">
                    <p className="font-medium">
                      {a.name}
                      {a.status !== "active" && (
                        <span className="ml-2 rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                          unavailable
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-slate-400">
                      {[a.manufacturer, a.model].filter(Boolean).join(" ")}
                      {a.seats ? ` · ${a.seats} seats` : ""}
                      {a.hourly_rate ? ` · $${Number(a.hourly_rate).toLocaleString()}/hr` : ""}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}
