"use client";

import { useState, useTransition } from "react";
import { setStaffRole } from "./roleActions";

const ROLES = [
  { role: "broker", label: "Broker" },
  { role: "finance", label: "Finance" },
  { role: "admin", label: "Admin" },
] as const;

export function RoleToggles({ userId, roles, isSelf }: { userId: string; roles: string[]; isSelf: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Staff roles">
      {ROLES.map(({ role, label }) => {
        const on = roles.includes(role);
        const locked = isSelf && role === "admin" && on;
        return (
          <button
            key={role}
            type="button"
            aria-pressed={on}
            disabled={pending || locked}
            title={locked ? "You cannot remove your own admin role" : undefined}
            onClick={() =>
              start(async () => {
                setError(null);
                const res = await setStaffRole(userId, role, !on);
                if (res.error) setError(res.error);
              })
            }
            className={`min-h-[36px] rounded-full border px-3 text-xs font-medium disabled:opacity-50 ${
              on ? "border-gold bg-gold/15 text-gold-light" : "border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"
            }`}
          >
            {label}
          </button>
        );
      })}
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
