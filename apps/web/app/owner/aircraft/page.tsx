import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createDraft } from "./actions";
import { publicPhotoUrl } from "@/lib/storage";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-900/60 text-emerald-300",
  draft: "bg-slate-800 text-slate-300",
  paused: "bg-amber-900/60 text-amber-300",
  archived: "bg-slate-900 text-slate-500",
};

export default async function MyAircraft() {
  const user = await requireRole("owner");
  const supabase = await createClient();

  const { data: aircraft } = await supabase
    .from("aircraft")
    .select("id, name, manufacturer, model, status, hourly_rate, currency, home_base, aircraft_photos(file_path, position)")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <main>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My aircraft</h1>
        <form action={createDraft}>
          <button className="rounded-full bg-gold px-5 py-2 text-sm font-medium text-ink hover:bg-gold-light">
            + New listing
          </button>
        </form>
      </div>

      {!aircraft?.length ? (
        <div className="mt-10 rounded-2xl border border-dashed border-slate-700 p-12 text-center text-slate-400">
          No aircraft yet. Create your first listing to start receiving charter
          requests.
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {aircraft.map((a) => {
            const photo = [...(a.aircraft_photos ?? [])].sort(
              (x, y) => x.position - y.position
            )[0];
            return (
              <li
                key={a.id}
                className="flex items-center gap-5 rounded-2xl border border-slate-800 bg-ink-soft p-4"
              >
                <div className="h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-slate-900">
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={publicPhotoUrl("aircraft-photos", photo.file_path)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-slate-600">
                      no photo
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{a.name}</p>
                  <p className="text-sm text-slate-400">
                    {[a.manufacturer, a.model].filter(Boolean).join(" ")}
                    {a.home_base ? ` · ${a.home_base}` : ""}
                    {a.hourly_rate ? ` · ${a.currency} ${a.hourly_rate}/hr` : ""}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs capitalize ${STATUS_STYLES[a.status] ?? ""}`}
                >
                  {a.status}
                </span>
                <div className="flex gap-2 text-sm">
                  <Link
                    href={`/owner/aircraft/${a.id}/edit`}
                    className="rounded-full border border-slate-700 px-4 py-1.5 hover:border-gold hover:text-gold"
                  >
                    Edit
                  </Link>
                  <Link
                    href={`/owner/aircraft/${a.id}/availability`}
                    className="rounded-full border border-slate-700 px-4 py-1.5 hover:border-gold hover:text-gold"
                  >
                    Availability
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
