import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-900/60 text-amber-300",
  in_transit: "bg-sky-900/60 text-sky-300",
  paid: "bg-emerald-900/60 text-emerald-300",
  failed: "bg-red-900/60 text-red-300",
};

export default async function Earnings() {
  const user = await requireRole("owner");
  const supabase = await createClient();

  const [{ data: payouts }, { data: account }] = await Promise.all([
    supabase
      .from("payouts")
      .select("id, amount, currency, status, created_at, booking_id")
      .eq("provider_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("stripe_accounts")
      .select("payouts_enabled")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const total = (payouts ?? [])
    .filter((p) => p.status !== "failed")
    .reduce((s, p) => s + Number(p.amount), 0);

  return (
    <main>
      <h1 className="text-2xl font-semibold">Earnings</h1>

      {!account?.payouts_enabled && (
        <p className="mt-4 rounded-xl border border-amber-800 bg-amber-950/40 px-4 py-3 text-sm text-amber-300">
          Payouts are not active yet.{" "}
          <Link href="/settings/payments" className="underline">
            Set up your payout account
          </Link>{" "}
          to receive transfers.
        </p>
      )}

      <div className="mt-6 rounded-2xl border border-slate-800 bg-ink-soft p-6">
        <p className="text-3xl font-semibold text-gold">
          ${total.toLocaleString()}
        </p>
        <p className="mt-1 text-sm text-slate-400">
          Lifetime earnings (after the 10% platform fee)
        </p>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 font-semibold">Payouts</h2>
        {!payouts?.length ? (
          <p className="text-sm text-slate-500">
            No payouts yet. They appear here after completed trips.
          </p>
        ) : (
          <ul className="space-y-2">
            {payouts.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-xl border border-slate-800 bg-ink-soft px-4 py-3 text-sm"
              >
                <span>
                  ${Number(p.amount).toLocaleString()} {p.currency}
                  <Link
                    href={`/bookings/${p.booking_id}`}
                    className="ml-3 text-xs text-gold hover:underline"
                  >
                    view booking
                  </Link>
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs capitalize ${STATUS_STYLES[p.status] ?? ""}`}
                >
                  {p.status.replace(/_/g, " ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
