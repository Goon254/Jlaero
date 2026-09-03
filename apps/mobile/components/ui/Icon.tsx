import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import { iconSize, useTheme } from "@/lib/theme";

export type IconName = ComponentProps<typeof Ionicons>["name"];

export function Icon({
  name,
  size = "md",
  color,
  style,
}: {
  name: IconName;
  size?: keyof typeof iconSize | number;
  color?: string;
  style?: ComponentProps<typeof Ionicons>["style"];
}) {
  const { colors } = useTheme();
  return (
    <Ionicons
      name={name}
      size={typeof size === "number" ? size : iconSize[size]}
      color={color ?? colors.textSecondary}
      style={style}
    />
  );
}
