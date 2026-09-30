"use client";

// A form bound to a server action with the standard ActionState shape.
// Shows pending state, the server's error or success message, and optionally
// resets or redirects. Fields are passed as children (server-rendered is fine).
import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import type { ActionState } from "@/lib/trips/action-state";
import { buttonClass, cx } from "./ui";

function Submit({ label, pendingLabel, variant, className, confirm }: { label: ReactNode; pendingLabel?: ReactNode; variant: "primary" | "secondary" | "ghost" | "danger"; className?: string; confirm?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={buttonClass(variant, className)}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending ? pendingLabel ?? "Working..." : label}
    </button>
  );
}

export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel,
  variant = "primary",
  submitClassName,
  className,
  resetOnSuccess = false,
  confirm,
  inline = false,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  children?: ReactNode;
  submitLabel: ReactNode;
  pendingLabel?: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  submitClassName?: string;
  className?: string;
  resetOnSuccess?: boolean;
  confirm?: string;
  inline?: boolean;
}) {
  const [state, formAction] = useActionState(action, { ok: true } as ActionState);
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (state.ok && state.message && resetOnSuccess) ref.current?.reset();
    if (state.ok && state.redirect) router.push(state.redirect);
  }, [state, resetOnSuccess, router]);

  return (
    <form ref={ref} action={formAction} className={cx(inline ? "flex flex-wrap items-center gap-2" : "space-y-4", className)}>
      {children}
      <div className={cx("flex flex-wrap items-center gap-3", inline && "contents")}>
        <Submit label={submitLabel} pendingLabel={pendingLabel} variant={variant} className={submitClassName} confirm={confirm} />
        <p aria-live="polite" className={cx("text-sm", state.ok ? "text-ok" : "text-bad")}>
          {state.ok ? state.message : state.error}
        </p>
      </div>
    </form>
  );
}
