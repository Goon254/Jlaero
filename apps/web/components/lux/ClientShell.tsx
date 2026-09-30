import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "./Brand";

// Client-facing shell for the brokerage flow: simple and calm (spec s31).
export function ClientShell({ children, signedIn = true }: { children: ReactNode; signedIn?: boolean }) {
  return (
    <div className="lux min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-4 sm:px-6">
          <Brand />
          <nav aria-label="Main" className="ml-auto flex items-center gap-1 text-sm font-medium">
            {signedIn ? (
              <>
                <Link href="/trips" className="rounded-lg px-3 py-2 text-fg-2 hover:bg-neutral-soft hover:text-fg">My trips</Link>
                <Link href="/request" className="rounded-lg bg-fg px-4 py-2 text-canvas hover:opacity-90">Request a charter</Link>
              </>
            ) : (
              <Link href="/login" className="rounded-lg px-3 py-2 text-fg-2 hover:bg-neutral-soft hover:text-fg">Sign in</Link>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">{children}</main>
      <footer className="border-t border-line">
        <p className="mx-auto max-w-5xl px-4 py-6 text-xs text-fg-3 sm:px-6">
          Jlaero is an air charter broker and is not a direct air carrier. All flights are operated by FAA Part 135 certificated air carriers that hold operational control of the flight.
        </p>
      </footer>
    </div>
  );
}
