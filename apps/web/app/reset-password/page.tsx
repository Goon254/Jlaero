"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ResetPassword() {
  const supabase = createClient();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setError(
        error.message.includes("session")
          ? "This reset link is invalid or expired. Request a new one."
          : error.message
      );
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <Link href="/" className="text-2xl font-semibold">
          Jl<span className="text-gold">aero</span>
        </Link>
        <h1 className="mt-8 text-xl font-semibold">Choose a new password</h1>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password (8+ characters)"
            className="w-full rounded-lg border border-slate-700 bg-ink-soft px-4 py-3 outline-none focus:border-gold"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            disabled={busy}
            className="w-full rounded-lg bg-gold py-3 font-medium text-ink hover:bg-gold-light disabled:opacity-60"
          >
            {busy ? "Saving…" : "Set new password"}
          </button>
        </form>
      </div>
    </main>
  );
}
