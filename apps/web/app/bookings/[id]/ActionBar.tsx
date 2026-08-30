"use client";

import { useState, useTransition } from "react";
import { canTransition, type BookingActor, type BookingStatus } from "@jlaero/shared";
import { cancelBooking, declineBooking } from "./actions";

export function ActionBar({
  bookingId,
  status,
  role,
}: {
  bookingId: string;
  status: BookingStatus;
  role: BookingActor;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<"cancel" | "decline" | null>(null);

  const canCancel = canTransition(status, "cancelled", role);
  const canDecline = role === "provider" && canTransition(status, "declined", role);
  if (!canCancel && !canDecline) return null;

  function run(kind: "cancel" | "decline") {
    setError(null);
    start(async () => {
      const res =
        kind === "cancel" ? await cancelBooking(bookingId) : await declineBooking(bookingId);
      if (res.error) setError(res.error);
      setConfirming(null);
    });
  }

  return (
    <div className="flex items-center gap-3">
      {confirming ? (
        <>
          <span className="text-sm text-slate-400">
            {confirming === "cancel" ? "Cancel this booking?" : "Decline this request?"}
          </span>
          <button
            onClick={() => run(confirming)}
            disabled={pending}
            className="rounded-full bg-red-700 px-4 py-1.5 text-sm text-white hover:bg-red-600 disabled:opacity-60"
          >
            Yes
          </button>
          <button
            onClick={() => setConfirming(null)}
            className="rounded-full border border-slate-700 px-4 py-1.5 text-sm"
          >
            No
          </button>
        </>
      ) : (
        <>
          {canDecline && (
            <button
              onClick={() => setConfirming("decline")}
              className="rounded-full border border-slate-700 px-4 py-1.5 text-sm text-slate-300 hover:border-red-700 hover:text-red-400"
            >
              Decline
            </button>
          )}
          {canCancel && (
            <button
              onClick={() => setConfirming("cancel")}
              className="rounded-full border border-slate-700 px-4 py-1.5 text-sm text-slate-300 hover:border-red-700 hover:text-red-400"
            >
              Cancel
            </button>
          )}
        </>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
