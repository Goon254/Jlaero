import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CrewProfileForm } from "./CrewProfileForm";
import { CrewStatusControls } from "./CrewStatusControls";

export default async function MyCrewProfile() {
  const user = await requireRole("crew");
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("crew_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <PageShell
      title="My crew profile"
      subtitle="What operators and travelers see when they look to hire you."
    >
      <div className="mb-6 flex flex-wrap items-center gap-4">
        {profile && (
          <>
            <span
              className={`rounded-full px-3 py-1 text-sm capitalize ${
                profile.status === "active"
                  ? "bg-emerald-900/60 text-emerald-300"
                  : "bg-slate-800 text-slate-300"
              }`}
            >
              {profile.status}
            </span>
            <CrewStatusControls status={profile.status} />
            <Link
              href="/crew/me/availability"
              className="rounded-full border border-slate-700 px-4 py-1.5 text-sm hover:border-gold hover:text-gold"
            >
              Availability
            </Link>
            {profile.status === "active" && (
              <Link
                href={`/crew/${profile.id}`}
                className="text-sm text-gold hover:underline"
              >
                View public profile →
              </Link>
            )}
          </>
        )}
      </div>

      <div className="max-w-2xl">
        <CrewProfileForm
          profile={
            profile
              ? {
                  headline: profile.headline ?? "",
                  crew_kind: profile.crew_kind,
                  total_hours: profile.total_hours,
                  day_rate: profile.day_rate,
                  home_base: profile.home_base ?? "",
                  bio: profile.bio ?? "",
                  licenses: ((profile.licenses as string[]) ?? []).join(", "),
                  type_ratings: ((profile.type_ratings as string[]) ?? []).join(", "),
                  medical_class: profile.medical_class ?? "",
                  medical_expires: profile.medical_expires ?? "",
                }
              : null
          }
        />
      </div>
    </PageShell>
  );
}
