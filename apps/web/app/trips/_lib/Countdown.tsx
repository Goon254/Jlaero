"use client";

// Trip countdown (spec s14): ticks every minute, milestones 72h, 48h, 24h,
// departure.
import { useEffect, useState } from "react";
import { countdown } from "@jlaero/shared";
import { cx } from "@/components/lux/ui";

const MILESTONES = [72, 48, 24, 0];

export function Countdown({ departAt }: { departAt: string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const c = countdown(departAt, now);
  return (
    <div>
      <p className="font-display text-4xl font-semibold tabular-nums sm:text-5xl" aria-live="polite">
        {c.past ? "Departure time" : (
          <>
            {c.days > 0 && <>{c.days}<span className="mx-1 text-lg text-fg-3">d</span></>}
            {c.hours}<span className="mx-1 text-lg text-fg-3">h</span>
            {c.minutes}<span className="ml-1 text-lg text-fg-3">m</span>
          </>
        )}
      </p>
      <ol className="mt-5 grid grid-cols-4 gap-2" aria-label="Countdown milestones">
        {MILESTONES.map((h) => {
          const reached = c.past || c.hoursTotal < h || (h === 0 && c.past);
          const label = h === 0 ? "Departure" : `${h} hours`;
          return (
            <li key={h} className="text-center">
              <div className={cx("h-1.5 rounded-full", reached ? "bg-accent" : "bg-line")} />
              <p className={cx("mt-2 text-xs", reached ? "font-semibold text-fg" : "text-fg-3")}>{label}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
