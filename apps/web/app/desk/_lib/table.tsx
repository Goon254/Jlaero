// Shared table and filter bits for the desk list pages.
import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "@/components/lux/ui";

export function Table({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-line bg-raised text-xs uppercase tracking-wider text-fg-3">
          <tr>{head.map((h, i) => <th key={i} scope="col" className="px-4 py-3 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
      {empty}
    </div>
  );
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cx("px-4 py-3 align-top", className)}>{children}</td>;
}

export function Tabs({ items, active }: { items: { key: string; label: string; href: string; count?: number }[]; active: string }) {
  return (
    <nav aria-label="Filter" className="mb-4 flex flex-wrap gap-1">
      {items.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === active ? "page" : undefined}
          className={cx(
            "inline-flex min-h-[40px] items-center gap-2 rounded-lg px-3 text-sm font-medium",
            t.key === active ? "bg-accent-soft text-accent-text" : "text-fg-2 hover:bg-neutral-soft hover:text-fg"
          )}
        >
          {t.label}
          {t.count != null && <span className="rounded-full bg-neutral-soft px-2 text-xs text-fg-2">{t.count}</span>}
        </Link>
      ))}
    </nav>
  );
}

// Build a query string from the current params plus overrides.
export function qs(base: Record<string, string | undefined>, over: Record<string, string | undefined>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...base, ...over })) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function shortDate(d: Date | string | null | undefined) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function shortDateTime(d: Date | string | null | undefined) {
  if (!d) return "";
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
