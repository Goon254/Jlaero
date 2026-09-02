"use client";

import { useState, useTransition } from "react";
import { setCrewStatus } from "../actions";

export function CrewStatusControls({ status }: { status: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function change(next: "active" | "paused") {
    setError(null);
    start(async () => {
      const res = await setCrewStatus(next);
      if (res.error) setError(res.error);
    });
  }

  return (
    <span className="flex items-center gap-3">
      {status !== "active" ? (
        <button
          onClick={() => change("active")}
          disabled={pending}
          className="rounded-full bg-emerald-600 px-5 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
        >
          Publish
        </button>
      ) : (
        <button
          onClick={() => change("paused")}
          disabled={pending}
          className="rounded-full border border-amber-600 px-5 py-1.5 text-sm text-amber-400 hover:bg-amber-950 disabled:opacity-60"
        >
          Pause
        </button>
      )}
      {error && <span className="text-sm text-red-400">{error}</span>}
    </span>
  );
}
