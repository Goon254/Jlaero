"use client";

import { useState, useTransition } from "react";
import { setStatus } from "../../actions";

export function StatusControls({
  aircraftId,
  status,
}: {
  aircraftId: string;
  status: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function change(next: "active" | "paused" | "archived" | "draft") {
    setError(null);
    start(async () => {
      const res = await setStatus(aircraftId, next);
      if (res.error) setError(res.error);
    });
  }

  return (
    <div className="flex items-center gap-3">
      {status !== "active" ? (
        <button
          onClick={() => change("active")}
          disabled={pending}
          className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
        >
          Publish
        </button>
      ) : (
        <button
          onClick={() => change("paused")}
          disabled={pending}
          className="rounded-full border border-amber-600 px-5 py-2 text-sm text-amber-400 hover:bg-amber-950 disabled:opacity-60"
        >
          Pause listing
        </button>
      )}
      {status !== "archived" && (
        <button
          onClick={() => change("archived")}
          disabled={pending}
          className="rounded-full border border-slate-700 px-5 py-2 text-sm text-slate-400 hover:border-red-700 hover:text-red-400 disabled:opacity-60"
        >
          Archive
        </button>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
