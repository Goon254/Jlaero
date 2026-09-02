"use client";

import { useTransition } from "react";
import { resolveReport, setListingHidden } from "../actions";

export function HideButton({
  aircraftId,
  hidden,
}: {
  aircraftId: string;
  hidden: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => start(async () => void (await setListingHidden(aircraftId, !hidden)))}
      className="rounded-full border border-slate-700 px-4 py-1.5 text-sm text-slate-300 hover:border-gold hover:text-gold disabled:opacity-50"
    >
      {hidden ? "Restore" : "Hide"}
    </button>
  );
}

export function ReportButtons({ reportId }: { reportId: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex shrink-0 gap-2">
      <button
        disabled={pending}
        onClick={() => start(async () => void (await resolveReport(reportId, "actioned")))}
        className="rounded-full bg-slate-800 px-4 py-1.5 text-sm hover:bg-slate-700 disabled:opacity-50"
      >
        Actioned
      </button>
      <button
        disabled={pending}
        onClick={() => start(async () => void (await resolveReport(reportId, "dismissed")))}
        className="rounded-full border border-slate-700 px-4 py-1.5 text-sm text-slate-400 disabled:opacity-50"
      >
        Dismiss
      </button>
    </div>
  );
}
