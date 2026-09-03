import Link from "next/link";

const MARKETS = [
  {
    title: "Charter a jet",
    body: "Tell us the trip; get service tiers with one final price. Our team sources the right aircraft from a global operator network.",
    href: "/charter",
  },
  {
    title: "Aviation services",
    body: "Hangars, FBO services, aircraft detailing, catering, ground transport. One request, one final price.",
    href: "/services",
  },
  {
    title: "Buy & sell aircraft",
    body: "Browse jets for sale or sell your own. Reach qualified buyers and operators worldwide.",
    href: "/marketplace",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen">
      <header className="flex items-center justify-between px-6 py-5 md:px-12">
        <span className="text-xl font-semibold tracking-tight">
          Jl<span className="text-gold">aero</span>
        </span>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/charter" className="hover:text-gold">Charter</Link>
          <Link href="/services" className="hover:text-gold">Services</Link>
          <Link href="/marketplace" className="hover:text-gold">Marketplace</Link>
          <Link
            href="/login"
            className="rounded-full bg-gold px-4 py-2 font-medium text-ink hover:bg-gold-light"
          >
            Sign in
          </Link>
        </nav>
      </header>

      <section className="px-6 pb-16 pt-16 md:px-12 md:pt-28">
        <p className="mb-4 text-sm uppercase tracking-[0.2em] text-gold">
          Private aviation, on demand
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold leading-tight md:text-6xl">
          The marketplace for private jets, crew, and aircraft.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-slate-300">
          Book a charter in minutes, hire vetted crew, or list your aircraft for
          charter or sale. One platform for everyone in private aviation.
        </p>
        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href="/charter"
            className="rounded-full bg-gold px-6 py-3 font-medium text-ink hover:bg-gold-light"
          >
            Find a flight
          </Link>
          <Link
            href="/list"
            className="rounded-full border border-slate-600 px-6 py-3 font-medium hover:border-gold hover:text-gold"
          >
            List your aircraft
          </Link>
        </div>
      </section>

      <section className="grid gap-6 px-6 pb-24 md:grid-cols-3 md:px-12">
        {MARKETS.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="rounded-2xl border border-slate-800 bg-ink-soft p-6 transition hover:border-gold"
          >
            <h2 className="text-xl font-semibold">{m.title}</h2>
            <p className="mt-3 text-sm text-slate-400">{m.body}</p>
            <span className="mt-4 inline-block text-sm text-gold">Explore →</span>
          </Link>
        ))}
      </section>

      <footer className="border-t border-slate-800 px-6 py-8 md:px-12">
        <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-slate-500">
          <span>© {new Date().getFullYear()} Jlaero. Private aviation marketplace.</span>
          <nav className="flex flex-wrap gap-5">
            <Link href="/about" className="hover:text-gold">About</Link>
            <Link href="/help" className="hover:text-gold">Help</Link>
            <Link href="/contact" className="hover:text-gold">Contact</Link>
            <Link href="/terms" className="hover:text-gold">Terms</Link>
            <Link href="/privacy" className="hover:text-gold">Privacy</Link>
          </nav>
        </div>
        <p className="mt-4 text-xs text-slate-600">
          Jlaero is a technology marketplace, not an air carrier or direct air
          carrier. All flights are operated by FAA-certificated air carriers
          who exercise full operational control.
        </p>
      </footer>
    </main>
  );
}
