import { ActivityIndicator, View, type StyleProp, type ViewStyle } from "react-native";
import { radius, space, touchTarget, useTheme } from "@/lib/theme";
import { Icon, type IconName } from "./Icon";
import { Pressable } from "./Pressable";
import { Text } from "./Text";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";

export function Button({
  title,
  onPress,
  variant = "primary",
  icon,
  iconRight,
  loading = false,
  disabled = false,
  size = "md",
  style,
  accessibilityLabel,
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  disabled?: boolean;
  size?: "md" | "lg";
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const inactive = disabled || loading;

  const bg = {
    primary: colors.accent,
    secondary: "transparent",
    ghost: "transparent",
    danger: "transparent",
    success: colors.success,
  }[variant];
  const fg = {
    primary: colors.onAccent,
    secondary: colors.text,
    ghost: colors.textSecondary,
    danger: colors.danger,
    success: colors.onAccent,
  }[variant];
  const borderColor = {
    primary: colors.accent,
    secondary: colors.borderStrong,
    ghost: "transparent",
    danger: "transparent",
    success: colors.success,
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      haptic={variant === "primary" || variant === "success" ? "medium" : "light"}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={[
        {
          minHeight: size === "lg" ? 56 : touchTarget,
          borderRadius: radius.full,
          backgroundColor: bg,
          borderWidth: 1,
          borderColor,
          paddingHorizontal: space.xxl,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: space.sm,
          opacity: inactive ? 0.55 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Icon name={icon} size="sm" color={fg} />}
          <Text variant="bodyStrong" style={{ color: fg }}>
            {title}
          </Text>
          {iconRight && <Icon name={iconRight} size="sm" color={fg} />}
        </>
      )}
      {loading && <View accessibilityElementsHidden />}
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  variant = "surface",
  size = touchTarget,
  style,
}: {
  icon: IconName;
  onPress?: () => void;
  accessibilityLabel: string;
  variant?: "surface" | "accent" | "overlay";
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const bg = {
    surface: colors.surfaceRaised,
    accent: colors.accent,
    overlay: "rgba(11, 18, 32, 0.55)",
  }[variant];
  const fg = {
    surface: colors.text,
    accent: colors.onAccent,
    overlay: "#ffffff",
  }[variant];
  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      pressScale={0.94}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius.full,
          backgroundColor: bg,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: variant === "surface" ? 1 : 0,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      <Icon name={icon} color={fg} />
    </Pressable>
  );
}
