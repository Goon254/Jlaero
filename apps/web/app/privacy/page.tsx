import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";

export const metadata: Metadata = {
  title: "Privacy Policy | Jlaero",
};

export default function Privacy() {
  return (
    <PageShell title="Privacy Policy" subtitle="Last updated September 2026">
      <div className="max-w-3xl space-y-6 text-sm leading-relaxed text-slate-300">
        <p className="rounded-xl border border-amber-800 bg-amber-950/30 p-4 text-amber-300">
          DRAFT: review with counsel before launch. This page is also the
          privacy policy URL required by the App Store and Google Play.
        </p>

        <Section title="What we collect">
          Account details (name, email, phone, company), listings and booking
          information you create (itineraries, passenger manifests, messages,
          reviews), verification documents you upload (identity, certificates,
          insurance, licenses), payment metadata (we never see full card
          numbers), and basic usage analytics.
        </Section>

        <Section title="How we use it">
          To run the marketplace: matching, bookings, contracts, payments,
          verification, safety, support, and legally required records. We send
          transactional email about your bookings; marketing email only with
          your consent, with unsubscribe in every message.
        </Section>

        <Section title="Who we share it with">
          Your booking counterparty sees what they need to fulfil the booking
          (name, itinerary, manifest). Service providers process data on our
          behalf: Supabase (database and authentication), Stripe (payments and
          payout identity checks), and Vercel (hosting). Verification
          documents are visible only to you and our review team. We do not
          sell personal data.
        </Section>

        <Section title="Retention and deletion">
          You can delete your account in Settings. We anonymize your profile
          and disable login immediately; booking, payment, and review records
          are retained in anonymized form because the other party keeps their
          transaction history and law requires financial records. Verification
          documents are deleted on account deletion.
        </Section>

        <Section title="Your rights">
          You may access, correct, export, or delete your personal data.
          Email support@jlaero.com and we will respond within 30 days. EU/UK
          and California residents have the additional rights provided by GDPR
          and CCPA respectively.
        </Section>

        <Section title="Cookies">
          We use strictly necessary cookies for sign-in sessions and, with
          consent where required, analytics cookies to understand product
          usage.
        </Section>

        <Section title="Security">
          Data is encrypted in transit and at rest. Access is role-restricted
          and admin actions are audit-logged. No system is perfectly secure;
          report concerns to support@jlaero.com.
        </Section>

        <p>Contact: support@jlaero.com</p>
      </div>
    </PageShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-1 font-semibold text-slate-100">{title}</h2>
      <p>{children}</p>
    </section>
  );
}
