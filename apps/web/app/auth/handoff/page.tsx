"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/client";

// Signs the browser in with a session handed over from the mobile app.
// Tokens arrive in the URL fragment (never sent to the server); the page
// stores them as cookies, wipes the fragment, and continues to `next`.
function Handoff() {
  const router = useRouter();
  const params = useSearchParams();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const next = safeNext(params.get("next"));
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const access_token = hash.get("access_token");
    const refresh_token = hash.get("refresh_token");
    window.history.replaceState(null, "", window.location.pathname);
    if (!access_token || !refresh_token) {
      router.replace(`/login`);
      return;
    }
    createClient()
      .auth.setSession({ access_token, refresh_token })
      .then(({ error }) => {
        if (error) {
          setFailed(true);
          return;
        }
        router.replace(next);
        router.refresh();
      });
  }, [params, router]);

  return (
    <main className="flex min-h-screen items-center justify-center px-6 text-sm text-slate-400">
      {failed ? "This link has expired. Please sign in again from the app." : "Signing you in…"}
    </main>
  );
}

function safeNext(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/dashboard";
  return next;
}

export default function HandoffPage() {
  return (
    <Suspense>
      <Handoff />
    </Suspense>
  );
}
