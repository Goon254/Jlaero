// Design tokens: semantic color palettes for light and dark, typography,
// spacing and radius scales. Screens consume these through useTheme() and
// never hardcode hex values.

export type Scheme = "light" | "dark";

export type Palette = {
  // Surfaces
  bg: string;
  surface: string;
  surfaceRaised: string;
  surfaceSunken: string;
  border: string;
  borderStrong: string;
  // Text
  text: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;
  // Brand accent (gold)
  accent: string;
  accentText: string;
  accentSoft: string;
  onAccent: string;
  // Semantic
  success: string;
  successSoft: string;
  danger: string;
  dangerSoft: string;
  info: string;
  infoSoft: string;
  warning: string;
  warningSoft: string;
  neutral: string;
  neutralSoft: string;
  // Misc
  scrim: string;
  skeleton: string;
  tabBar: string;
};

export const palettes: Record<Scheme, Palette> = {
  dark: {
    bg: "#0b1220",
    surface: "#121a2b",
    surfaceRaised: "#1a2436",
    surfaceSunken: "#080d18",
    border: "#212c42",
    borderStrong: "#34405a",

    text: "#f4f6fa",
    textSecondary: "#aab4c7",
    textTertiary: "#7a869c",
    textInverse: "#0b1220",

    accent: "#c9a24b",
    accentText: "#e4c877",
    accentSoft: "rgba(201, 162, 75, 0.14)",
    onAccent: "#0b1220",

    success: "#4ade80",
    successSoft: "rgba(74, 222, 128, 0.14)",
    danger: "#f87171",
    dangerSoft: "rgba(248, 113, 113, 0.14)",
    info: "#7dd3fc",
    infoSoft: "rgba(125, 211, 252, 0.14)",
    warning: "#fbbf24",
    warningSoft: "rgba(251, 191, 36, 0.14)",
    neutral: "#aab4c7",
    neutralSoft: "rgba(170, 180, 199, 0.12)",

    scrim: "rgba(5, 8, 15, 0.6)",
    skeleton: "#1f2940",
    tabBar: "#0e1626",
  },
  light: {
    bg: "#f6f4ee",
    surface: "#ffffff",
    surfaceRaised: "#fbfaf6",
    surfaceSunken: "#efece4",
    border: "#e6e1d6",
    borderStrong: "#cfc8b8",

    text: "#0b1220",
    textSecondary: "#4b5568",
    textTertiary: "#5f6b80",
    textInverse: "#f4f6fa",

    accent: "#c9a24b",
    accentText: "#84651c",
    accentSoft: "rgba(201, 162, 75, 0.16)",
    onAccent: "#0b1220",

    success: "#15803d",
    successSoft: "rgba(21, 128, 61, 0.12)",
    danger: "#b91c1c",
    dangerSoft: "rgba(185, 28, 28, 0.10)",
    info: "#0369a1",
    infoSoft: "rgba(3, 105, 161, 0.10)",
    warning: "#b45309",
    warningSoft: "rgba(180, 83, 9, 0.12)",
    neutral: "#4b5568",
    neutralSoft: "rgba(75, 85, 104, 0.10)",

    scrim: "rgba(11, 18, 32, 0.5)",
    skeleton: "#e9e5db",
    tabBar: "#fbfaf6",
  },
};

export const fonts = {
  display: "PlayfairDisplay_600SemiBold",
  displayRegular: "PlayfairDisplay_400Regular",
  displayItalic: "PlayfairDisplay_400Regular_Italic",
  sans: "Inter_400Regular",
  sansMedium: "Inter_500Medium",
  sansSemiBold: "Inter_600SemiBold",
  sansBold: "Inter_700Bold",
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  full: 999,
} as const;

export const iconSize = {
  sm: 18,
  md: 22,
  lg: 28,
} as const;

// Minimum touch target (iOS 44pt, Android 48dp).
export const touchTarget = 48;

export type Tone = "accent" | "success" | "danger" | "info" | "warning" | "neutral";

export const statusTone: Record<string, Tone> = {
  requested: "info",
  quoted: "accent",
  negotiating: "accent",
  accepted: "success",
  contract_signed: "success",
  deposit_paid: "success",
  paid_in_full: "success",
  in_progress: "accent",
  completed: "neutral",
  cancelled: "danger",
  declined: "danger",
  expired: "neutral",
  refunded: "neutral",
  disputed: "danger",
};

export function toneColors(p: Palette, tone: Tone): { fg: string; bg: string } {
  switch (tone) {
    case "accent":
      return { fg: p.accentText, bg: p.accentSoft };
    case "success":
      return { fg: p.success, bg: p.successSoft };
    case "danger":
      return { fg: p.danger, bg: p.dangerSoft };
    case "info":
      return { fg: p.info, bg: p.infoSoft };
    case "warning":
      return { fg: p.warning, bg: p.warningSoft };
    default:
      return { fg: p.neutral, bg: p.neutralSoft };
  }
}
