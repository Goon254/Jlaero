"use client";

import { useState, useTransition } from "react";
import { setSaleStatus } from "../../actions";

type Status = "active" | "under_offer" | "sold" | "archived" | "draft";

export function SaleStatusControls({
  listingId,
  status,
}: {
  listingId: string;
  status: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function change(next: Status) {
    setError(null);
    start(async () => {
      const res = await setSaleStatus(listingId, next);
      if (res.error) setError(res.error);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status !== "active" && status !== "sold" && (
        <Btn onClick={() => change("active")} pending={pending} kind="primary">
          Publish
        </Btn>
      )}
      {status === "active" && (
        <Btn onClick={() => change("under_offer")} pending={pending}>
          Mark under offer
        </Btn>
      )}
      {(status === "active" || status === "under_offer") && (
        <Btn onClick={() => change("sold")} pending={pending}>
          Mark sold
        </Btn>
      )}
      {status !== "archived" && (
        <Btn onClick={() => change("archived")} pending={pending} kind="danger">
          Archive
        </Btn>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}

function Btn({
  onClick,
  pending,
  kind,
  children,
}: {
  onClick: () => void;
  pending: boolean;
  kind?: "primary" | "danger";
  children: React.ReactNode;
}) {
  const style =
    kind === "primary"
      ? "bg-emerald-600 text-white hover:bg-emerald-500"
      : kind === "danger"
        ? "border border-slate-700 text-slate-400 hover:border-red-700 hover:text-red-400"
        : "border border-slate-700 text-slate-300 hover:border-gold hover:text-gold";
  return (
    <button
      onClick={onClick}
      disabled={pending}
      className={`rounded-full px-4 py-1.5 text-sm disabled:opacity-50 ${style}`}
    >
      {children}
    </button>
  );
}
