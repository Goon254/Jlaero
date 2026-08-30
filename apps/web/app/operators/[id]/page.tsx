import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { createClient } from "@/lib/supabase/server";
import { publicPhotoUrl } from "@/lib/storage";

export default async function OperatorProfile({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, company_name, bio, home_base, verification, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!profile) notFound();

  const { data: fleet } = await supabase
    .from("aircraft")
    .select("id, name, manufacturer, model, seats, hourly_rate, home_base, aircraft_photos(file_path, position)")
    .eq("owner_id", id)
    .eq("status", "active");

  const name = profile.company_name || profile.full_name || "Operator";

  return (
    <PageShell
      title={name}
      subtitle={`Member since ${new Date(profile.created_at).getFullYear()}${
        profile.home_base ? ` · Based ${profile.home_base}` : ""
      }`}
    >
      <p className="mb-8 text-sm">
        {profile.verification === "verified" ? (
          <span className="rounded-full bg-emerald-900/60 px-3 py-1.5 text-emerald-300">
            ✓ Verified operator
          </span>
        ) : (
          <span className="rounded-full bg-slate-800 px-3 py-1.5 text-slate-400">
            Verification pending
          </span>
        )}
      </p>

      {profile.bio && (
        <p className="mb-10 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-slate-300">
          {profile.bio}
        </p>
      )}

      <h2 className="mb-4 font-semibold">Fleet ({fleet?.length ?? 0})</h2>
      {!fleet?.length ? (
        <p className="text-sm text-slate-500">No active listings right now.</p>
      ) : (
        <ul className="grid gap-6 md:grid-cols-2">
          {fleet.map((a) => {
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
                    <p className="font-medium">{a.name}</p>
                    <p className="text-sm text-slate-400">
                      {[a.manufacturer, a.model].filter(Boolean).join(" ")}
                      {a.seats ? ` · ${a.seats} seats` : ""}
                      {a.hourly_rate
                        ? ` · $${Number(a.hourly_rate).toLocaleString()}/hr`
                        : ""}
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
