import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";

export const metadata: Metadata = {
  title: "Terms of Service | Jlaero",
};

export default function Terms() {
  return (
    <PageShell title="Terms of Service" subtitle="Last updated September 2026">
      <div className="prose-invert max-w-3xl space-y-6 text-sm leading-relaxed text-slate-300">
        <p className="rounded-xl border border-amber-800 bg-amber-950/30 p-4 text-amber-300">
          DRAFT: this template must be reviewed by aviation counsel before
          public launch, including the broker-of-record determination under
          14 CFR Part 295 (see ROADMAP 3c).
        </p>

        <Section title="1. What Jlaero is">
          Jlaero is a technology marketplace that connects travelers with
          independent aircraft operators, pilots, and crew, and connects
          aircraft buyers with sellers. Jlaero is NOT an air carrier, does not
          operate aircraft, and does not exercise operational control over any
          flight. Every charter flight arranged through Jlaero is operated by
          the operator identified on the booking, who is the carrier of record
          and holds all required certificates, including FAA Part 135
          authority where applicable.
        </Section>

        <Section title="2. Accounts">
          You must be at least 18 years old and provide accurate information.
          You are responsible for your credentials. We may suspend accounts
          that violate these terms, applicable law, or the trust of the
          marketplace.
        </Section>

        <Section title="3. Bookings, quotes, and contracts">
          Operators respond to charter requests with itemized quotes. A booking
          becomes binding when the traveler accepts a quote and signs the
          charter agreement. The charter agreement is between the traveler and
          the operator; Jlaero facilitates its execution and payment.
        </Section>

        <Section title="4. Payments and fees">
          Payments are processed by Stripe. Funds are held by the platform and
          released to the provider after flight completion. Jlaero charges the
          provider a platform fee on completed bookings. US Federal Excise Tax
          and segment fees are itemized on domestic charter quotes.
        </Section>

        <Section title="5. Cancellations and refunds">
          Each listing carries a cancellation policy tier (Flexible, Moderate,
          or Strict) shown before payment. Traveler cancellations are refunded
          according to that tier. Operator-initiated cancellations, and
          cancellations for weather or mechanical reasons, are refunded in
          full.
        </Section>

        <Section title="6. Aircraft sales">
          Sale listings are inquiry-only introductions. Jlaero is not a party
          to, and provides no escrow, title, inspection, or brokerage services
          for, any aircraft purchase.
        </Section>

        <Section title="7. Verification">
          Jlaero reviews operator certificates, insurance, and crew
          credentials submitted for verification badges. Verification is a
          document review, not a guarantee of safety or performance. Travelers
          remain responsible for their own diligence.
        </Section>

        <Section title="8. Prohibited conduct">
          No unlawful use, no misrepresentation of credentials or aircraft, no
          circumvention of platform fees for transactions originated on the
          platform, no harassment, and no listing of aircraft you are not
          authorized to offer.
        </Section>

        <Section title="9. Liability">
          To the maximum extent permitted by law, Jlaero is not liable for the
          acts or omissions of operators, crew, buyers, or sellers, nor for
          the operation of any flight. Our aggregate liability is limited to
          the platform fees you paid in the twelve months preceding the claim.
        </Section>

        <Section title="10. Disputes and governing law">
          [Placeholder: governing law, venue, and arbitration clause to be
          completed with counsel.]
        </Section>

        <Section title="11. Changes">
          We may update these terms; material changes are notified by email.
          Continued use after the effective date constitutes acceptance.
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
