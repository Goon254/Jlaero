"use client";

import { useState, useTransition } from "react";
import { reviewDocument } from "../actions";

export function ReviewButtons({ docId }: { docId: string }) {
  const [pending, start] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function run(decision: "verified" | "rejected") {
    setError(null);
    start(async () => {
      const res = await reviewDocument(docId, decision, reason);
      if (res.error) setError(res.error);
      setRejecting(false);
    });
  }

  return (
    <div className="flex items-center gap-2">
      {rejecting ? (
        <>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Rejection reason"
            className="rounded-lg border border-slate-700 bg-ink px-3 py-1.5 text-sm outline-none focus:border-gold"
          />
          <button
            onClick={() => run("rejected")}
            disabled={pending || !reason.trim()}
            className="rounded-full bg-red-700 px-4 py-1.5 text-sm text-white disabled:opacity-50"
          >
            Reject
          </button>
          <button onClick={() => setRejecting(false)} className="text-sm text-slate-400">
            Back
          </button>
        </>
      ) : (
        <>
          <button
            onClick={() => run("verified")}
            disabled={pending}
            className="rounded-full bg-emerald-600 px-4 py-1.5 text-sm text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            Approve
          </button>
          <button
            onClick={() => setRejecting(true)}
            disabled={pending}
            className="rounded-full border border-slate-700 px-4 py-1.5 text-sm text-slate-300 hover:border-red-700 hover:text-red-400"
          >
            Reject…
          </button>
        </>
      )}
      {error && <span className="text-sm text-red-400">{error}</span>}
    </div>
  );
}
