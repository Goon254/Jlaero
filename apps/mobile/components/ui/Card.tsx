import { View, type StyleProp, type ViewProps, type ViewStyle } from "react-native";
import { radius, space, useTheme } from "@/lib/theme";
import { Pressable, type PressableProps } from "./Pressable";

export function Card({
  style,
  padded = true,
  raised = false,
  ...rest
}: ViewProps & { padded?: boolean; raised?: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: raised ? colors.surfaceRaised : colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.lg,
          padding: padded ? space.lg : 0,
          overflow: "hidden",
        },
        style,
      ]}
    />
  );
}

export function PressableCard({
  style,
  padded = true,
  ...rest
}: PressableProps & { padded?: boolean; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <Pressable
      haptic="light"
      {...rest}
      style={[
        {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.lg,
          padding: padded ? space.lg : 0,
          overflow: "hidden",
        },
        style,
      ]}
    />
  );
}
