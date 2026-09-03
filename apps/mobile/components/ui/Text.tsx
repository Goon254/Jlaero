import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from "react-native";
import { fonts, useTheme } from "@/lib/theme";

export type TextVariant =
  | "display"
  | "title"
  | "headline"
  | "subhead"
  | "body"
  | "bodyStrong"
  | "caption"
  | "captionStrong"
  | "label";

export type TextTone = "primary" | "secondary" | "tertiary" | "accent" | "danger" | "success" | "inverse";

const variants: Record<TextVariant, TextStyle> = {
  display: { fontFamily: fonts.display, fontSize: 34, lineHeight: 40, letterSpacing: -0.4 },
  title: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, letterSpacing: -0.2 },
  headline: { fontFamily: fonts.sansSemiBold, fontSize: 18, lineHeight: 24 },
  subhead: { fontFamily: fonts.sansSemiBold, fontSize: 15, lineHeight: 20 },
  body: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.sansSemiBold, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 18 },
  captionStrong: { fontFamily: fonts.sansMedium, fontSize: 13, lineHeight: 18 },
  label: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
};

// Display text is capped so system font scaling cannot blow up hero layouts;
// everything else scales freely for Dynamic Type.
const maxScale: Partial<Record<TextVariant, number>> = { display: 1.3, title: 1.4 };

export type TextProps = RNTextProps & {
  variant?: TextVariant;
  tone?: TextTone;
  align?: TextStyle["textAlign"];
};

export function Text({ variant = "body", tone = "primary", align, style, ...rest }: TextProps) {
  const { colors } = useTheme();
  const color = {
    primary: colors.text,
    secondary: colors.textSecondary,
    tertiary: colors.textTertiary,
    accent: colors.accentText,
    danger: colors.danger,
    success: colors.success,
    inverse: colors.textInverse,
  }[tone];
  return (
    <RNText
      maxFontSizeMultiplier={maxScale[variant] ?? 2}
      {...rest}
      style={[variants[variant], { color, textAlign: align }, style]}
    />
  );
}
