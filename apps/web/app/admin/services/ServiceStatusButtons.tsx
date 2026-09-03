"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const NEXT: Record<string, { to: string; label: string }[]> = {
  open: [
    { to: "in_progress", label: "Start sourcing" },
    { to: "closed", label: "Close" },
  ],
  in_progress: [
    { to: "fulfilled", label: "Mark fulfilled" },
    { to: "closed", label: "Close" },
  ],
  fulfilled: [],
  closed: [{ to: "open", label: "Reopen" }],
};

export function ServiceStatusButtons({
  requestId,
  status,
}: {
  requestId: string;
  status: string;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <span className="rounded-full bg-slate-800 px-3 py-1 text-xs capitalize text-slate-300">
        {status.replace(/_/g, " ")}
      </span>
      {(NEXT[status] ?? []).map((n) => (
        <button
          key={n.to}
          disabled={pending}
          onClick={() =>
            start(async () => {
              await supabase
                .from("service_requests")
                .update({ status: n.to })
                .eq("id", requestId);
              router.refresh();
            })
          }
          className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:border-gold hover:text-gold disabled:opacity-50"
        >
          {n.label}
        </button>
      ))}
    </div>
  );
}
