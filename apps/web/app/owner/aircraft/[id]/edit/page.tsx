import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { publicPhotoUrl } from "@/lib/storage";
import { PhotoUploader } from "@/components/PhotoUploader";
import { deletePhoto, movePhoto } from "../../actions";
import { AircraftForm } from "./AircraftForm";
import { StatusControls } from "./StatusControls";

export default async function EditAircraft({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireRole("owner");
  const supabase = await createClient();

  const { data: aircraft } = await supabase
    .from("aircraft")
    .select("*")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!aircraft) notFound();

  const { data: photos } = await supabase
    .from("aircraft_photos")
    .select("id, file_path, position")
    .eq("aircraft_id", id)
    .order("position");

  const nextPosition =
    (photos?.length ? Math.max(...photos.map((p) => p.position)) : -1) + 1;

  return (
    <main>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/owner/aircraft" className="text-sm text-slate-400 hover:text-gold">
            ← My aircraft
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">{aircraft.name}</h1>
          <p className="text-sm capitalize text-slate-400">Status: {aircraft.status}</p>
        </div>
        <StatusControls aircraftId={id} status={aircraft.status} />
      </div>

      <section className="mt-8 rounded-2xl border border-slate-800 bg-ink-soft/50 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Photos</h2>
          <PhotoUploader aircraftId={id} nextPosition={nextPosition} />
        </div>
        {!photos?.length ? (
          <p className="text-sm text-slate-500">
            No photos yet. At least one is required to publish.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {photos.map((p, i) => (
              <li key={p.id} className="group relative overflow-hidden rounded-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={publicPhotoUrl("aircraft-photos", p.file_path)}
                  alt=""
                  className="aspect-[4/3] w-full object-cover"
                />
                {i === 0 && (
                  <span className="absolute left-2 top-2 rounded bg-gold px-2 py-0.5 text-xs font-medium text-ink">
                    Cover
                  </span>
                )}
                <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/70 p-2 opacity-0 transition group-hover:opacity-100">
                  <form action={movePhoto.bind(null, id, p.id, "up")}>
                    <IconButton label="←" />
                  </form>
                  <form action={movePhoto.bind(null, id, p.id, "down")}>
                    <IconButton label="→" />
                  </form>
                  <form action={deletePhoto.bind(null, id, p.id)}>
                    <IconButton label="✕" danger />
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-8">
        <AircraftForm aircraft={aircraft} />
      </div>
    </main>
  );
}

function IconButton({ label, danger = false }: { label: string; danger?: boolean }) {
  return (
    <button
      className={`rounded px-2 py-1 text-xs ${
        danger ? "bg-red-900/80 text-red-200" : "bg-slate-800/80 text-slate-200"
      } hover:opacity-80`}
    >
      {label}
    </button>
  );
}
