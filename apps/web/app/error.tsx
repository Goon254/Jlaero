"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="text-sm uppercase tracking-[0.2em] text-gold">Error</p>
      <h1 className="mt-3 text-3xl font-semibold">Something went wrong</h1>
      <p className="mt-3 max-w-sm text-slate-400">
        A temporary problem on our side. Your data is safe.
      </p>
      <div className="mt-8 flex gap-4">
        <button
          onClick={reset}
          className="rounded-full bg-gold px-6 py-2.5 text-sm font-medium text-ink hover:bg-gold-light"
        >
          Try again
        </button>
        {/* Full reload on purpose: the error boundary may have broken client state */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className="rounded-full border border-slate-700 px-6 py-2.5 text-sm hover:border-gold hover:text-gold">
          Home
        </a>
      </div>
    </main>
  );
}
