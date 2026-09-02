import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";

export const metadata: Metadata = {
  title: "Help & FAQ | Jlaero",
};

const FAQ: { q: string; a: string }[] = [
  {
    q: "How does booking a charter work?",
    a: "Search by route and date, send a request to the operator, and they reply with an itemized quote. You can negotiate in chat, and quotes can be revised. When you accept, the aircraft is held for 24 hours while you sign the charter agreement and pay.",
  },
  {
    q: "When am I charged?",
    a: "After you sign the charter agreement. You can pay a 25% deposit and the balance later, or pay in full. Funds are held by the platform and released to the operator only after your flight is completed.",
  },
  {
    q: "What if I need to cancel?",
    a: "Every listing shows its cancellation policy (Flexible, Moderate, or Strict) before you pay, and refunds follow that schedule automatically. If the operator cancels, or the flight is cancelled for weather or mechanical reasons, you are refunded in full.",
  },
  {
    q: "What does the verified badge mean?",
    a: "Our team has reviewed the operator's Part 135 certificate and insurance (or a crew member's licenses). Credentials carry expiry dates; when one lapses, the listing is paused until it is renewed.",
  },
  {
    q: "What are empty legs?",
    a: "Repositioning flights that would otherwise fly empty, offered at a fixed all-in price, often at a steep discount. The date, time, and route are set by the aircraft's schedule.",
  },
  {
    q: "How do operators get paid?",
    a: "Through Stripe. Set up your payout account under Settings, then earnings from each completed trip transfer automatically, minus the 10% platform fee.",
  },
  {
    q: "Are aircraft sales handled on the platform?",
    a: "Sales listings are inquiry-only. Jlaero introduces you to the seller and hosts the conversation; the transaction itself (escrow, title, pre-buy inspection) happens off-platform with your own advisors.",
  },
  {
    q: "How do I delete my account?",
    a: "Settings, then Delete account. Your profile is anonymized and login is disabled immediately. Booking records are retained in anonymized form because your counterparty keeps their transaction history.",
  },
];

export default function Help() {
  return (
    <PageShell title="Help & FAQ">
      <div className="max-w-2xl space-y-4">
        {FAQ.map((f) => (
          <details key={f.q} className="group rounded-2xl border border-slate-800 bg-ink-soft p-5">
            <summary className="cursor-pointer font-medium marker:text-gold">
              {f.q}
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">{f.a}</p>
          </details>
        ))}
        <p className="pt-2 text-sm text-slate-400">
          Something else? <a href="mailto:support@jlaero.com" className="text-gold">support@jlaero.com</a>
        </p>
      </div>
    </PageShell>
  );
}
