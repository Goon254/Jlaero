import Link from "next/link";
import { ArrowRight, FileSignature, Plane, Search, ShieldCheck } from "lucide-react";
import { Brand } from "@/components/lux/Brand";
import { ButtonLink } from "@/components/lux/ui";

// Landing page for the brokerage: one clear path, Request a Charter.
// Marketplace, crew and sale routes still exist but are no longer promoted.
const STEPS = [
  { icon: Search, title: "Request", body: "Tell us the route, dates, passengers and any special requests. Two minutes, in the app or by email." },
  { icon: Plane, title: "Choose", body: "We search certificated operators near your route and send up to three aircraft options with clear pricing." },
  { icon: FileSignature, title: "Sign and pay", body: "Your broker verifies availability. Sign your agreement and pay securely; the trip is confirmed once payment is verified." },
  { icon: ShieldCheck, title: "Fly", body: "Branded itinerary, 72-hour countdown, trip tracking, and a broker watching every detail until you land." },
];

export default function Home() {
  return (
    <div className="lux min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-5 sm:px-6">
        <Brand />
        <nav aria-label="Main" className="ml-auto flex items-center gap-1 text-sm font-medium">
          <Link href="/trips" className="hidden rounded-lg px-3 py-2 text-fg-2 hover:bg-neutral-soft hover:text-fg sm:inline-flex">My trips</Link>
          <Link href="/login" className="rounded-lg px-3 py-2 text-fg-2 hover:bg-neutral-soft hover:text-fg">Sign in</Link>
          <Link href="/request" className="rounded-lg bg-fg px-4 py-2 text-canvas hover:opacity-90">Request a Charter</Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 md:pt-24">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-accent-text">Private jet charter</p>
          <h1 className="max-w-3xl font-display text-4xl font-semibold leading-[1.1] tracking-tight md:text-6xl">
            Your private flight, arranged with care.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-fg-2">
            Request a charter and receive up to three verified aircraft options. Technology does the searching; your broker handles every decision that matters.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <ButtonLink href="/request" className="min-h-[52px] px-7 text-base">
              Request a Charter <ArrowRight className="h-4 w-4" aria-hidden />
            </ButtonLink>
            <ButtonLink href="/trips" variant="secondary" className="min-h-[52px] px-7 text-base">View my trips</ButtonLink>
          </div>
        </section>

        <section aria-labelledby="how" className="border-t border-line bg-raised">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 id="how" className="font-display text-2xl font-semibold md:text-3xl">How it works</h2>
            <ol className="mt-8 grid gap-6 md:grid-cols-4">
              {STEPS.map((s, i) => (
                <li key={s.title} className="rounded-2xl border border-line bg-surface p-6">
                  <s.icon className="h-6 w-6 text-accent-text" aria-hidden />
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-fg-3">Step {i + 1}</p>
                  <h3 className="mt-1 font-display text-xl font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-fg-2">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-fg-3">
            <span>© {new Date().getFullYear()} Jlaero. Private jet charter.</span>
            <nav aria-label="Footer" className="flex flex-wrap gap-5">
              <Link href="/about" className="hover:text-fg">About</Link>
              <Link href="/help" className="hover:text-fg">Help</Link>
              <Link href="/contact" className="hover:text-fg">Contact</Link>
              <Link href="/terms" className="hover:text-fg">Terms</Link>
              <Link href="/privacy" className="hover:text-fg">Privacy</Link>
            </nav>
          </div>
          <p className="mt-4 text-xs text-fg-3">
            Jlaero is an air charter broker and is not a direct air carrier. All flights are operated by FAA Part 135 certificated air carriers that exercise full operational control of the flight.
          </p>
        </div>
      </footer>
    </div>
  );
}
