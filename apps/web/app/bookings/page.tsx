import { PageShell } from "@/components/PageShell";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const STATUS_STYLES: Record<string, string> = {
  requested: "bg-sky-900/60 text-sky-300",
  quoted: "bg-violet-900/60 text-violet-300",
  negotiating: "bg-violet-900/60 text-violet-300",
  accepted: "bg-emerald-900/60 text-emerald-300",
  contract_signed: "bg-emerald-900/60 text-emerald-300",
  deposit_paid: "bg-emerald-900/60 text-emerald-300",
  paid_in_full: "bg-emerald-900/60 text-emerald-300",
  in_progress: "bg-gold/20 text-gold",
  completed: "bg-slate-800 text-slate-300",
  cancelled: "bg-red-900/50 text-red-300",
  declined: "bg-red-900/50 text-red-300",
  expired: "bg-slate-900 text-slate-500",
};

type BookingRow = {
  id: string;
  kind: string;
  status: string;
  buyer_id: string;
  provider_id: string;
  created_at: string;
  aircraft: { name: string } | null;
  booking_legs: {
    position: number;
    origin: string;
    destination: string | null;
    depart_at: string | null;
    passengers: number | null;
  }[];
};

export default async function Bookings({
  searchParams,
}: {
  searchParams: Promise<{ requested?: string }>;
}) {
  const { requested } = await searchParams;
  const user = await requireUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from("bookings")
    .select(
      "id, kind, status, buyer_id, provider_id, created_at, aircraft(name), booking_legs(position, origin, destination, depart_at, passengers)"
    )
    .or(`buyer_id.eq.${user.id},provider_id.eq.${user.id}`)
    .order("created_at", { ascending: false });

  const bookings = (data ?? []) as unknown as BookingRow[];
  const asBuyer = bookings.filter((b) => b.buyer_id === user.id);
  const asProvider = bookings.filter(
    (b) => b.provider_id === user.id && b.buyer_id !== user.id
  );

  return (
    <PageShell title="My bookings" subtitle="Charter requests and trips.">
      {requested && (
        <p className="mb-6 rounded-xl border border-emerald-800 bg-emerald-950/50 px-4 py-3 text-sm text-emerald-300">
          Request sent. The operator will respond with a quote; you will see it
          here.
        </p>
      )}

      <BookingList title="As traveler" rows={asBuyer} empty="No requests yet. Find a jet on the charter page." />
      {asProvider.length > 0 && (
        <BookingList title="As provider" rows={asProvider} empty="" />
      )}
    </PageShell>
  );
}

function BookingList({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: BookingRow[];
  empty: string;
}) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {!rows.length ? (
        <p className="text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((b) => {
            const legs = [...b.booking_legs].sort((x, y) => x.position - y.position);
            const first = legs[0];
            const route = legs.length
              ? legs.length > 1
                ? `${first?.origin} ⇄ ${first?.destination}`
                : `${first?.origin} → ${first?.destination}`
              : "";
            return (
              <li key={b.id}>
                <a
                  href={`/bookings/${b.id}`}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-ink-soft px-5 py-4 hover:border-gold"
                >
                <div className="min-w-0">
                  <p className="font-medium">
                    {route}
                    <span className="ml-2 text-sm text-slate-400">
                      {b.aircraft?.name ?? ""}
                    </span>
                  </p>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {first?.depart_at
                      ? new Date(first.depart_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          timeZone: "UTC",
                        })
                      : ""}
                    {first?.passengers ? ` · ${first.passengers} pax` : ""}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs capitalize ${
                    STATUS_STYLES[b.status] ?? "bg-slate-800 text-slate-300"
                  }`}
                >
                  {b.status.replace(/_/g, " ")}
                </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
