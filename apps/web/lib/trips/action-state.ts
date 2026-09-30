// Standard result for trip-workflow server actions used with ActionForm.
export type ActionState =
  | { ok: true; message?: string; redirect?: string }
  | { ok: false; error: string };

export function failure(e: unknown): ActionState {
  const msg = e instanceof Error ? e.message : String(e);
  // Surface workflow and validation messages; hide raw database errors.
  if (/violates|syntax|relation|column|constraint|duplicate key/i.test(msg) && !/^[A-Z]/.test(msg)) {
    console.error(e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
  return { ok: false, error: msg.replace(/^.*?ERROR:\s*/, "") };
}

// FormData helpers
export const str = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === "string" && v.trim() ? v.trim() : null;
};
export const num = (f: FormData, k: string) => {
  const v = str(f, k);
  if (v == null) return null;
  const n = Number(v.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
};
export const bool = (f: FormData, k: string) => {
  const v = f.get(k);
  return v === "on" || v === "true" || v === "yes" || v === "1";
};
