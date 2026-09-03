export const colors = {
  ink: "#0b1220",
  inkSoft: "#1a2436",
  border: "#2b3752",
  gold: "#c9a24b",
  goldLight: "#e4c877",
  text: "#f1f5f9",
  textDim: "#94a3b8",
  textFaint: "#64748b",
  green: "#34d399",
  red: "#f87171",
  sky: "#7dd3fc",
};

export const statusColors: Record<string, string> = {
  requested: colors.sky,
  quoted: "#c4b5fd",
  negotiating: "#c4b5fd",
  accepted: colors.green,
  contract_signed: colors.green,
  deposit_paid: colors.green,
  paid_in_full: colors.green,
  in_progress: colors.gold,
  completed: colors.textDim,
  cancelled: colors.red,
  declined: colors.red,
  expired: colors.textFaint,
  refunded: colors.textDim,
  disputed: colors.red,
};

export function publicPhotoUrl(bucket: string, path: string): string {
  return `https://ncxieabeqtwkomvzykul.supabase.co/storage/v1/object/public/${bucket}/${path}`;
}
