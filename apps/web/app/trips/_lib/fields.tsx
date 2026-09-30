// Small form pieces shared by the client trip pages.
import type { ReactNode } from "react";

// Accessible yes/no radio pair styled as segmented buttons.
export function YesNo({ name, legend, hint, defaultValue }: { name: string; legend: ReactNode; hint?: ReactNode; defaultValue?: "yes" | "no" }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-fg">{legend}</legend>
      <div className="inline-flex rounded-xl border border-line-strong bg-surface p-1">
        {(["yes", "no"] as const).map((v) => (
          <label key={v} className="relative">
            <input type="radio" name={name} value={v} defaultChecked={defaultValue === v} className="peer sr-only" />
            <span className="flex min-h-[40px] min-w-[72px] cursor-pointer items-center justify-center rounded-lg px-4 text-sm font-medium text-fg-2 transition peer-checked:bg-fg peer-checked:text-canvas peer-focus-visible:ring-2 peer-focus-visible:ring-accent">
              {v === "yes" ? "Yes" : "No"}
            </span>
          </label>
        ))}
      </div>
      {hint && <p className="mt-1 text-xs text-fg-3">{hint}</p>}
    </fieldset>
  );
}

// 1-5 star rating as a radio group (keyboard and screen-reader friendly).
export function StarRating({ name, legend, required = false, size = "lg" }: { name: string; legend: ReactNode; required?: boolean; size?: "lg" | "sm" }) {
  const box = size === "lg" ? "h-11 w-11 text-2xl" : "h-9 w-9 text-lg";
  return (
    <fieldset>
      <legend className={size === "lg" ? "mb-2 text-sm font-medium text-fg" : "mb-1 text-sm text-fg-2"}>{legend}</legend>
      <div className="flex flex-row-reverse justify-end gap-1">
        {[5, 4, 3, 2, 1].map((n) => (
          <label key={n} className="relative [label:has(input:checked)~&>span]:text-accent">
            <input type="radio" name={name} value={n} required={required && n === 1} className="peer sr-only" aria-label={`${n} star${n === 1 ? "" : "s"}`} />
            <span aria-hidden className={`flex ${box} cursor-pointer items-center justify-center rounded-lg text-line-strong transition peer-checked:text-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent hover:text-accent`}>
              <svg viewBox="0 0 24 24" className="h-[60%] w-[60%]" fill="currentColor"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.5L12 17.3l-5.9 3.2 1.3-6.5L2.5 9.4l6.6-.8z" /></svg>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
