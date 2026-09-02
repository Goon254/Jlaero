import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/PageShell";

export const metadata: Metadata = {
  title: "List your aircraft | Jlaero",
  description: "Put your aircraft or crew services on the Jlaero marketplace.",
};

const STEPS = [
  { n: "1", t: "Create your listing", d: "Photos, specs, pricing, and your cancellation policy. Ten minutes." },
  { n: "2", t: "Get verified", d: "Upload your Part 135 certificate and insurance. Verified fleets win the booking." },
  { n: "3", t: "Quote and fly", d: "Requests arrive in your inbox; reply with itemized quotes and negotiate in-app." },
  { n: "4", t: "Get paid automatically", d: "Funds release to your Stripe account after each completed trip, minus 10%." },
];

export default function ListWithUs() {
  return (
    <PageShell
      title="Put your fleet to work"
      subtitle="Charter demand, empty-leg sales, and aircraft sales in one channel. No subscription; 10% only when you fly."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {STEPS.map((s) => (
          <div key={s.n} className="rounded-2xl border border-slate-800 bg-ink-soft p-6">
            <p className="text-2xl font-semibold text-gold">{s.n}</p>
            <h2 className="mt-2 font-semibold">{s.t}</h2>
            <p className="mt-1 text-sm text-slate-400">{s.d}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-4">
        <Link href="/owner/aircraft" className="rounded-full bg-gold px-6 py-3 font-medium text-ink hover:bg-gold-light">
          List an aircraft
        </Link>
        <Link href="/crew/me" className="rounded-full border border-slate-700 px-6 py-3 hover:border-gold hover:text-gold">
          Create a crew profile
        </Link>
        <Link href="/owner/sales" className="rounded-full border border-slate-700 px-6 py-3 hover:border-gold hover:text-gold">
          Sell an aircraft
        </Link>
      </div>
      <p className="mt-4 text-xs text-slate-500">
        New here? Signing up takes a minute; pick &quot;List aircraft&quot; or
        &quot;Offer crew services&quot; during onboarding.
      </p>
    </PageShell>
  );
}
