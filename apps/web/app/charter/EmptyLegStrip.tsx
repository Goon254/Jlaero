"use client";

import { useState, useTransition } from "react";
import { bookEmptyLeg } from "../owner/empty-legs/actions";

export type EmptyLegCard = {
  id: string;
  origin: string;
  destination: string;
  depart_at: string;
  price: number;
  seats: number | null;
  aircraftName: string;
};

export function EmptyLegStrip({ legs }: { legs: EmptyLegCard[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!legs.length) return null;

  return (
    <section className="mt-10">
      <h2 className="mb-1 text-lg font-semibold">
        Empty legs <span className="text-gold">· up to 75% off</span>
      </h2>
      <p className="mb-4 text-sm text-slate-400">
        Repositioning flights at a fixed all-in price. Dates and times are set
        by the aircraft schedule.
      </p>
      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {legs.map((l) => (
          <li
            key={l.id}
            className="rounded-2xl border border-gold/40 bg-gold/5 p-5"
          >
            <p className="text-lg font-semibold">
              {l.origin} → {l.destination}
            </p>
            <p className="mt-1 text-sm text-slate-300">
              {new Date(l.depart_at).toLocaleString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                timeZone: "UTC",
              })}{" "}
              UTC
            </p>
            <p className="text-xs text-slate-500">
              {l.aircraftName}
              {l.seats ? ` · up to ${l.seats} seats` : ""}
            </p>
            <button
              disabled={pending}
              onClick={() => {
                setError(null);
                start(async () => {
                  const res = await bookEmptyLeg(l.id);
                  if (res?.error) setError(res.error);
                });
              }}
              className="mt-4 w-full rounded-full bg-gold py-2.5 text-sm font-medium text-ink hover:bg-gold-light disabled:opacity-60"
            >
              Book · ${Number(l.price).toLocaleString()}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
