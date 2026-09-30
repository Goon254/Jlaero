import Link from "next/link";

export function Brand({ href = "/", suffix }: { href?: string; suffix?: string }) {
  return (
    <Link href={href} className="inline-flex items-baseline gap-2 font-display text-2xl font-semibold tracking-tight text-fg">
      Jl<span className="-ml-2 text-accent-text">aero</span>
      {suffix && <span className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-fg-3">{suffix}</span>}
    </Link>
  );
}
