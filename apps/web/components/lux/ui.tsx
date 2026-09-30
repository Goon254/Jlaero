// Quiet-luxury web kit for the brokerage screens (client trips + broker
// desk). Mirrors apps/mobile/components/ui. Semantic tokens only; never hex.
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { formatMoney } from "@jlaero/shared";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger";
const buttonBase =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-[background,transform,opacity] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";
const buttonVariants: Record<Variant, string> = {
  primary: "bg-fg text-canvas hover:opacity-90",
  secondary: "border border-line-strong bg-surface text-fg hover:bg-raised",
  ghost: "text-fg-2 hover:bg-neutral-soft hover:text-fg",
  danger: "border border-bad/40 bg-bad-soft text-bad hover:bg-bad-soft/80",
};
export const accentButton = "bg-accent text-accent-on hover:brightness-105";

export function buttonClass(variant: Variant = "primary", extra?: string) {
  return cx(buttonBase, buttonVariants[variant], extra);
}

export function Button({ variant = "primary", className, ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

export function ButtonLink({ variant = "primary", className, ...props }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}

export function Card({ className, padded = true, ...props }: ComponentProps<"div"> & { padded?: boolean }) {
  return <div className={cx("rounded-2xl border border-line bg-surface", padded && "p-5 sm:p-6", className)} {...props} />;
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx("text-xs font-semibold uppercase tracking-[0.14em] text-fg-3", className)}>{children}</p>;
}

export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow?: ReactNode; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <Eyebrow className="mb-2">{eyebrow}</Eyebrow>}
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-fg-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="font-display text-xl font-semibold">{children}</h2>
      {action}
    </div>
  );
}

export type Tone = "neutral" | "accent" | "ok" | "bad" | "info" | "warn";
const toneClass: Record<Tone, string> = {
  neutral: "bg-neutral-soft text-fg-2",
  accent: "bg-accent-soft text-accent-text",
  ok: "bg-ok-soft text-ok",
  bad: "bg-bad-soft text-bad",
  info: "bg-info-soft text-info",
  warn: "bg-warn-soft text-warn",
};
export function Pill({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", toneClass[tone], className)}>{children}</span>;
}

export function Money({ value, currency = "USD", className }: { value: number | string | null | undefined; currency?: string; className?: string }) {
  return <span className={cx("tabular-nums", className)}>{formatMoney(value, currency)}</span>;
}

export function EmptyState({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong px-6 py-12 text-center">
      <p className="font-display text-lg font-semibold">{title}</p>
      {body && <p className="mx-auto mt-2 max-w-md text-sm text-fg-2">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-fg-3">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-fg-3">{hint}</p>}
    </div>
  );
}

export function DefinitionList({ items, className }: { items: [ReactNode, ReactNode][]; className?: string }) {
  return (
    <dl className={cx("divide-y divide-line text-sm", className)}>
      {items.map(([k, v], i) => (
        <div key={i} className="flex justify-between gap-4 py-2.5">
          <dt className="text-fg-2">{k}</dt>
          <dd className="text-right font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

// Form controls
export const inputClass =
  "w-full min-h-[44px] rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-sm text-fg placeholder:text-fg-3 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30";

// The label wraps its control, so every input is programmatically labelled
// without ids. Pass htmlFor only when the control lives elsewhere.
export function Field({ label, hint, children, className, htmlFor }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string; htmlFor?: string }) {
  if (htmlFor) {
    return (
      <div className={cx("block", className)}>
        <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-fg">{label}</label>
        {children}
        {hint && <p className="mt-1 text-xs text-fg-3">{hint}</p>}
      </div>
    );
  }
  return (
    <label className={cx("block", className)}>
      <span className="mb-1.5 block text-sm font-medium text-fg">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-fg-3">{hint}</span>}
    </label>
  );
}

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={cx(inputClass, props.className)} />;
}
export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea rows={3} {...props} className={cx(inputClass, "min-h-[88px]", props.className)} />;
}
export function Select(props: ComponentProps<"select">) {
  return <select {...props} className={cx(inputClass, "pr-8", props.className)} />;
}

export function Notice({ tone = "info", title, children }: { tone?: Tone; title?: ReactNode; children?: ReactNode }) {
  const border: Record<Tone, string> = {
    neutral: "border-line", accent: "border-accent/40", ok: "border-ok/40", bad: "border-bad/40", info: "border-info/40", warn: "border-warn/40",
  };
  return (
    <div className={cx("rounded-xl border px-4 py-3 text-sm", border[tone], toneClass[tone])}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={cx(title ? "mt-1" : null, "text-fg-2")}>{children}</div>}
    </div>
  );
}
