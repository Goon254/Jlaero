"use client";

import { useState, useTransition } from "react";
import { setUserSuspended } from "../actions";

export function SuspendButton({
  userId,
  suspended,
}: {
  userId: string;
  suspended: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-red-400">{error}</span>}
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await setUserSuspended(userId, !suspended);
            if (res.error) setError(res.error);
          })
        }
        className={`rounded-full px-4 py-1.5 text-sm disabled:opacity-50 ${
          suspended
            ? "border border-slate-700 text-slate-300 hover:border-emerald-700 hover:text-emerald-400"
            : "border border-slate-700 text-slate-300 hover:border-red-700 hover:text-red-400"
        }`}
      >
        {suspended ? "Unsuspend" : "Suspend"}
      </button>
    </div>
  );
}
