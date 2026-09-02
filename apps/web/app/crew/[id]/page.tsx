import { notFound } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { FavoriteReportBar } from "@/components/FavoriteReportBar";
import { HireForm } from "./HireForm";

const KIND_LABELS: Record<string, string> = {
  captain: "Captain",
  first_officer: "First Officer",
  flight_attendant: "Flight Attendant",
  engineer: "Engineer",
  other: "Crew",
};

export default async function CrewDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getCurrentUser();

  const { data: crew } = await supabase
    .from("crew_profiles")
    .select(
      "*, profiles:user_id(id, full_name, verification, created_at)"
    )
    .eq("id", id)
    .eq("status", "active")
    .maybeSingle();
  if (!crew) notFound();

  const p = crew.profiles as unknown as {
    id: string;
    full_name: string | null;
    verification: string;
    created_at: string;
  } | null;

  const { data: reviews } = await supabase
    .from("reviews")
    .select("rating, comment, created_at")
    .eq("reviewee_id", crew.user_id)
    .order("created_at", { ascending: false })
    .limit(10);
  const avg = reviews?.length
    ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
    : null;

  let isSaved = false;
  if (user) {
    const { data: fav } = await supabase
      .from("favorites")
      .select("target_id")
      .eq("user_id", user.id)
      .eq("target_type", "crew")
      .eq("target_id", id)
      .maybeSingle();
    isSaved = Boolean(fav);
  }

  const licenses = (crew.licenses as string[]) ?? [];
  const ratings = (crew.type_ratings as string[]) ?? [];

  return (
    <PageShell title={p?.full_name ?? "Crew member"}>
      <p className="-mt-6 text-slate-400">
        {KIND_LABELS[crew.crew_kind] ?? crew.crew_kind}
        {crew.home_base ? ` · Based ${crew.home_base}` : ""}
        {p?.verification === "verified" && (
          <span className="ml-2 text-emerald-400">✓ Verified</span>
        )}
        {avg !== null && <span className="ml-2 text-gold">★ {avg} ({reviews!.length})</span>}
      </p>
      <div className="mb-8">
        <FavoriteReportBar
          targetType="crew"
          targetId={id}
          meId={user?.id ?? null}
          initiallySaved={isSaved}
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div>
          {crew.headline && <p className="text-lg">{crew.headline}</p>}

          <section className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Spec label="Total hours" value={crew.total_hours?.toLocaleString()} />
            <Spec label="Day rate" value={crew.day_rate ? `$${Number(crew.day_rate).toLocaleString()}` : null} />
            <Spec label="Medical" value={crew.medical_class} />
            <Spec label="Member since" value={p ? new Date(p.created_at).getFullYear() : null} />
          </section>

          {(licenses.length > 0 || ratings.length > 0) && (
            <section className="mt-6">
              <h2 className="mb-2 font-semibold">Licenses & type ratings</h2>
              <div className="flex flex-wrap gap-2">
                {licenses.map((l) => (
                  <span key={l} className="rounded-full bg-slate-800 px-3 py-1.5 text-sm text-slate-200">
                    {l}
                  </span>
                ))}
                {ratings.map((r) => (
                  <span key={r} className="rounded-full bg-gold/15 px-3 py-1.5 text-sm text-gold">
                    {r}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Credentials are self-declared until the verified badge appears.
              </p>
            </section>
          )}

          {crew.bio && (
            <section className="mt-6">
              <h2 className="mb-2 font-semibold">About</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-300">
                {crew.bio}
              </p>
            </section>
          )}

          {reviews && reviews.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-3 font-semibold">Reviews</h2>
              <ul className="space-y-3">
                {reviews.map((r, i) => (
                  <li key={i} className="rounded-xl border border-slate-800 bg-ink-soft p-4 text-sm">
                    <p className="text-gold">{"★".repeat(r.rating)}</p>
                    {r.comment && <p className="mt-1 text-slate-300">{r.comment}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <HireForm crewProfileId={id} signedIn={Boolean(user)} />
        </aside>
      </div>
    </PageShell>
  );
}

function Spec({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-ink-soft p-4">
      <p className="text-lg font-semibold">{value ?? "–"}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
