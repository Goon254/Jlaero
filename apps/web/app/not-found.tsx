import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="text-sm uppercase tracking-[0.2em] text-gold">404</p>
      <h1 className="mt-3 text-3xl font-semibold">Off the flight plan</h1>
      <p className="mt-3 max-w-sm text-slate-400">
        This page does not exist or is no longer available.
      </p>
      <div className="mt-8 flex gap-4">
        <Link href="/" className="rounded-full bg-gold px-6 py-2.5 text-sm font-medium text-ink hover:bg-gold-light">
          Home
        </Link>
        <Link href="/charter" className="rounded-full border border-slate-700 px-6 py-2.5 text-sm hover:border-gold hover:text-gold">
          Find a jet
        </Link>
      </div>
    </main>
  );
}
