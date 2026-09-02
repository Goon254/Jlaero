import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

export default async function AdminOverview() {
  await requireRole("admin");
  const supabase = await createClient();

  const [users, aircraft, bookings, pendingDocs, revenue, openReports] =
    await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase
        .from("aircraft")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
      supabase.from("bookings").select("id", { count: "exact", head: true }),
      supabase
        .from("verification_documents")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase.from("payments").select("amount, platform_fee").eq("status", "captured"),
      supabase
        .from("reports")
        .select("id", { count: "exact", head: true })
        .eq("status", "open"),
    ]);

  const gross = (revenue.data ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const fees = (revenue.data ?? []).reduce((s, p) => s + Number(p.platform_fee), 0);

  const tiles = [
    { label: "Users", value: users.count ?? 0, href: "/admin/users" },
    { label: "Active listings", value: aircraft.count ?? 0, href: "/admin/listings" },
    { label: "Bookings", value: bookings.count ?? 0, href: "/admin/bookings" },
    { label: "Pending verifications", value: pendingDocs.count ?? 0, href: "/admin/verifications", alert: (pendingDocs.count ?? 0) > 0 },
    { label: "Open reports", value: openReports.count ?? 0, href: "/admin/listings", alert: (openReports.count ?? 0) > 0 },
  ];

  return (
    <main>
      <h1 className="text-2xl font-semibold">Platform overview</h1>
      <section className="mt-8 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((t) => (
          <Link
            key={t.label}
            href={t.href}
            className={`rounded-2xl border p-5 hover:border-gold ${
              t.alert ? "border-amber-700 bg-amber-950/30" : "border-slate-800 bg-ink-soft"
            }`}
          >
            <p className="text-3xl font-semibold">{t.value}</p>
            <p className="mt-1 text-sm text-slate-400">{t.label}</p>
          </Link>
        ))}
      </section>
      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-ink-soft p-5">
          <p className="text-3xl font-semibold text-gold">${gross.toLocaleString()}</p>
          <p className="mt-1 text-sm text-slate-400">Gross payment volume (captured)</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-ink-soft p-5">
          <p className="text-3xl font-semibold text-gold">${fees.toLocaleString()}</p>
          <p className="mt-1 text-sm text-slate-400">Platform revenue (10% fees)</p>
        </div>
      </section>
    </main>
  );
}
