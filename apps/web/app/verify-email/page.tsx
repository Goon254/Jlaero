"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function VerifyEmail() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function resend(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    setBusy(false);
    setSent(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <Link href="/" className="text-2xl font-semibold">
          Jl<span className="text-gold">aero</span>
        </Link>
        <h1 className="mt-8 text-xl font-semibold">Confirm your email</h1>
        <p className="mt-3 text-sm text-slate-300">
          We sent a confirmation link to your inbox. Click it to activate your
          account, then sign in.
        </p>
        {sent ? (
          <p className="mt-6 text-sm text-emerald-400">Sent. Check your inbox.</p>
        ) : (
          <form onSubmit={resend} className="mt-6 space-y-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-slate-700 bg-ink-soft px-4 py-3 outline-none focus:border-gold"
            />
            <button
              disabled={busy}
              className="w-full rounded-lg border border-slate-700 py-3 text-sm hover:border-gold hover:text-gold disabled:opacity-60"
            >
              {busy ? "Sending…" : "Resend confirmation email"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
