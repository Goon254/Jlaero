import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/PageShell";

export const metadata: Metadata = {
  title: "About | Jlaero",
  description: "Jlaero is the marketplace for private aviation: charter, crew, and aircraft sales.",
};

export default function About() {
  return (
    <PageShell title="About Jlaero" subtitle="Private aviation, without the phone tag.">
      <div className="max-w-2xl space-y-5 text-sm leading-relaxed text-slate-300">
        <p>
          Chartering a jet still runs on phone calls, PDFs, and wire transfers.
          Jlaero replaces that with one marketplace: search real aircraft,
          get itemized quotes, negotiate in-app, sign the charter agreement,
          and pay securely, all in one place.
        </p>
        <p>
          Operators list their fleet and empty legs, respond to requests with
          line-item quotes, and get paid automatically after each completed
          trip. Pilots and cabin crew market their credentials and get hired
          for engagements. Buyers and sellers of aircraft find each other
          directly.
        </p>
        <p>
          Trust is the product: operators are verified against their Part 135
          certificates and insurance, credentials expire and re-verify
          automatically, and both sides review each other after every trip.
        </p>
        <p className="text-slate-400">
          Jlaero is a technology marketplace, not an air carrier. Every flight
          is operated by the certificated operator on the booking.
        </p>
        <div className="flex gap-4 pt-2">
          <Link href="/charter" className="rounded-full bg-gold px-6 py-2.5 font-medium text-ink hover:bg-gold-light">
            Find a jet
          </Link>
          <Link href="/list" className="rounded-full border border-slate-700 px-6 py-2.5 hover:border-gold hover:text-gold">
            List with us
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
