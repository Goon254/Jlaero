"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

export function FavoriteReportBar({
  targetType,
  targetId,
  meId,
  initiallySaved,
}: {
  targetType: "aircraft" | "crew" | "sale";
  targetId: string;
  meId: string | null;
  initiallySaved: boolean;
}) {
  const supabase = createClient();
  const [saved, setSaved] = useState(initiallySaved);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!meId) return null;

  function toggleSave() {
    start(async () => {
      if (saved) {
        await supabase
          .from("favorites")
          .delete()
          .eq("user_id", meId)
          .eq("target_type", targetType)
          .eq("target_id", targetId);
        setSaved(false);
      } else {
        await supabase
          .from("favorites")
          .insert({ user_id: meId, target_type: targetType, target_id: targetId });
        setSaved(true);
      }
    });
  }

  function sendReport() {
    start(async () => {
      const { error } = await supabase.from("reports").insert({
        reporter_id: meId,
        target_type: targetType,
        target_id: targetId,
        reason: reason.trim() || "Inappropriate listing",
      });
      setReporting(false);
      setDone(error ? error.message : "Thanks, our team will review it.");
    });
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
      <button
        onClick={toggleSave}
        disabled={pending}
        className={`rounded-full border px-4 py-1.5 ${
          saved
            ? "border-gold text-gold"
            : "border-slate-700 text-slate-300 hover:border-gold hover:text-gold"
        }`}
      >
        {saved ? "♥ Saved" : "♡ Save"}
      </button>
      {reporting ? (
        <span className="flex items-center gap-2">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="What's wrong with this listing?"
            className="rounded-lg border border-slate-700 bg-ink px-3 py-1.5 outline-none focus:border-gold"
          />
          <button onClick={sendReport} disabled={pending} className="text-red-400">
            Send
          </button>
          <button onClick={() => setReporting(false)} className="text-slate-500">
            Cancel
          </button>
        </span>
      ) : done ? (
        <span className="text-slate-500">{done}</span>
      ) : (
        <button
          onClick={() => setReporting(true)}
          className="text-slate-500 hover:text-red-400"
        >
          Report listing
        </button>
      )}
    </div>
  );
}
