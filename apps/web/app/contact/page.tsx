import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";

export const metadata: Metadata = {
  title: "Contact | Jlaero",
};

export default function Contact() {
  return (
    <PageShell title="Contact" subtitle="We answer fast.">
      <div className="max-w-lg space-y-4">
        <a
          href="mailto:support@jlaero.com"
          className="block rounded-2xl border border-slate-800 bg-ink-soft p-6 hover:border-gold"
        >
          <p className="font-semibold">Support</p>
          <p className="mt-1 text-sm text-slate-400">
            Bookings, payments, verification, account help
          </p>
          <p className="mt-2 text-gold">support@jlaero.com</p>
        </a>
        <div className="rounded-2xl border border-slate-800 bg-ink-soft p-6">
          <p className="font-semibold">Operators & partnerships</p>
          <p className="mt-1 text-sm text-slate-400">
            Fleet onboarding, empty-leg feeds, broker partnerships
          </p>
          <p className="mt-2 text-gold">support@jlaero.com</p>
        </div>
        <p className="text-xs text-slate-500">
          For an active booking, the fastest channel is the message thread on
          the booking itself; it reaches your counterparty directly.
        </p>
      </div>
    </PageShell>
  );
}
