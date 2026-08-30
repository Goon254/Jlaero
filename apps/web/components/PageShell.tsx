import Link from "next/link";

export function PageShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <nav className="mb-10 flex items-center justify-between text-sm">
        <Link href="/" className="text-lg font-semibold">
          Jl<span className="text-gold">aero</span>
        </Link>
        <div className="flex gap-5">
          <Link href="/charter" className="hover:text-gold">Charter</Link>
          <Link href="/crew" className="hover:text-gold">Crew</Link>
          <Link href="/marketplace" className="hover:text-gold">Marketplace</Link>
          <Link href="/dashboard" className="hover:text-gold">Dashboard</Link>
        </div>
      </nav>
      <h1 className="text-3xl font-semibold">{title}</h1>
      {subtitle && <p className="mt-2 text-slate-400">{subtitle}</p>}
      <div className="mt-8">{children}</div>
    </main>
  );
}

export function ComingSoon({ what }: { what: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-700 p-10 text-center text-slate-400">
      {what} is coming next. The database and accounts are live. Listings and
      booking flow are being built.
    </div>
  );
}
