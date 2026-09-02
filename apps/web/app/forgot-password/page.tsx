"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPassword() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/callback?next=/reset-password`,
    });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <Link href="/" className="text-2xl font-semibold">
          Jl<span className="text-gold">aero</span>
        </Link>
        <h1 className="mt-8 text-xl font-semibold">Reset your password</h1>
        {sent ? (
          <p className="mt-4 text-sm text-slate-300">
            If an account exists for <span className="text-gold">{email}</span>,
            a reset link is on its way. Check your inbox.
          </p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-slate-700 bg-ink-soft px-4 py-3 outline-none focus:border-gold"
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              disabled={busy}
              className="w-full rounded-lg bg-gold py-3 font-medium text-ink hover:bg-gold-light disabled:opacity-60"
            >
              {busy ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}
        <p className="mt-6 text-sm text-slate-400">
          Remembered it?{" "}
          <Link href="/login" className="text-gold hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
