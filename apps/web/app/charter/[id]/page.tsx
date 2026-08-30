import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AIRCRAFT_CATEGORY_LABELS,
  CANCELLATION_SCHEDULES,
  type AircraftCategory,
  type CancellationTier,
} from "@jlaero/shared";
import { PageShell } from "@/components/PageShell";
import { createClient } from "@/lib/supabase/server";
import { publicPhotoUrl } from "@/lib/storage";
import { getCurrentUser } from "@/lib/auth";
import { RequestForm } from "./RequestForm";

const TIER_LABELS: Record<string, string> = {
  flexible: "Flexible",
  moderate: "Moderate",
  strict: "Strict",
};

export default async function AircraftDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getCurrentUser();

  const { data: aircraft } = await supabase
    .from("aircraft")
    .select(
      "*, aircraft_photos(id, file_path, position), profiles:owner_id(id, full_name, company_name, verification)"
    )
    .eq("id", id)
    .eq("status", "active")
    .maybeSingle();
  if (!aircraft) notFound();

  const photos = [...(aircraft.aircraft_photos ?? [])].sort(
    (a, b) => a.position - b.position
  );
  const owner = aircraft.profiles as unknown as {
    id: string;
    full_name: string | null;
    company_name: string | null;
    verification: string;
  } | null;
  const tier = (aircraft.cancellation_tier ?? "moderate") as CancellationTier;
  const schedule = CANCELLATION_SCHEDULES[tier];

  return (
    <PageShell title={aircraft.name}>
      <p className="-mt-6 mb-8 text-slate-400">
        {[aircraft.manufacturer, aircraft.model].filter(Boolean).join(" ")}
        {aircraft.category
          ? ` · ${AIRCRAFT_CATEGORY_LABELS[aircraft.category as AircraftCategory] ?? ""}`
          : ""}
        {aircraft.home_base ? ` · Based ${aircraft.home_base}` : ""}
      </p>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div>
          {photos.length > 0 && (
            <div className="overflow-hidden rounded-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={publicPhotoUrl("aircraft-photos", photos[0]!.file_path)}
                alt={aircraft.name}
                className="aspect-[16/9] w-full object-cover"
              />
              {photos.length > 1 && (
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {photos.slice(1, 5).map((p) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={p.id}
                      src={publicPhotoUrl("aircraft-photos", p.file_path)}
                      alt=""
                      className="aspect-[4/3] w-full rounded-lg object-cover"
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          <section className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Spec label="Seats" value={aircraft.seats} />
            <Spec label="Year" value={aircraft.year} />
            <Spec
              label="Range"
              value={aircraft.range_nm ? `${aircraft.range_nm.toLocaleString()} nm` : null}
            />
            <Spec
              label="Hourly rate"
              value={
                aircraft.hourly_rate
                  ? `$${Number(aircraft.hourly_rate).toLocaleString()}`
                  : null
              }
            />
          </section>

          {(aircraft.argus_rating || aircraft.wyvern_rating || aircraft.is_bao_stage) && (
            <section className="mt-6 flex flex-wrap gap-2">
              {aircraft.argus_rating && <Rating>ARGUS {aircraft.argus_rating}</Rating>}
              {aircraft.wyvern_rating && <Rating>Wyvern {aircraft.wyvern_rating}</Rating>}
              {aircraft.is_bao_stage && <Rating>IS-BAO {aircraft.is_bao_stage}</Rating>}
            </section>
          )}

          {aircraft.description && (
            <section className="mt-8">
              <h2 className="mb-2 font-semibold">About this aircraft</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-300">
                {aircraft.description}
              </p>
            </section>
          )}

          <section className="mt-8 rounded-2xl border border-slate-800 p-5">
            <h2 className="font-semibold">
              Cancellation policy: {TIER_LABELS[tier]}
            </h2>
            <ul className="mt-2 space-y-1 text-sm text-slate-400">
              {schedule.map((s, i) => (
                <li key={i}>
                  {s.minHoursBefore > 0
                    ? `More than ${s.minHoursBefore / 24} days before departure: ${s.refundPct}% refund`
                    : `Inside that window: ${s.refundPct}% refund`}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-slate-500">
              Operator or weather cancellations always refund in full.
            </p>
          </section>

          {owner && (
            <section className="mt-8 flex items-center justify-between rounded-2xl border border-slate-800 p-5">
              <div>
                <p className="text-sm text-slate-400">Operated by</p>
                <p className="font-medium">
                  {owner.company_name || owner.full_name || "Operator"}
                </p>
                <p className="mt-0.5 text-xs capitalize text-slate-500">
                  {owner.verification === "verified" ? (
                    <span className="text-emerald-400">✓ Verified operator</span>
                  ) : (
                    "Verification pending"
                  )}
                </p>
              </div>
              <Link
                href={`/operators/${owner.id}`}
                className="rounded-full border border-slate-700 px-4 py-2 text-sm hover:border-gold hover:text-gold"
              >
                View profile
              </Link>
            </section>
          )}
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <RequestForm
            aircraftId={id}
            homeBase={aircraft.home_base}
            signedIn={Boolean(user)}
          />
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

function Rating({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-gold/15 px-3 py-1.5 text-sm text-gold">
      {children}
    </span>
  );
}
