"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/lux/ui";

export function DeskNav({ links }: { links: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Desk" className="-mx-2 flex min-w-0 flex-1 gap-1 overflow-x-auto">
      {links.map((l) => {
        const active = l.href === "/desk" ? path === "/desk" : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition",
              active ? "bg-accent-soft text-accent-text" : "text-fg-2 hover:bg-neutral-soft hover:text-fg"
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
