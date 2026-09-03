import { useEffect, useRef } from "react";
import { Animated, type StyleProp, type ViewStyle } from "react-native";
import { radius, useTheme } from "@/lib/theme";

export function Skeleton({
  width = "100%",
  height = 16,
  round = radius.sm,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  round?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, reduceMotion } = useTheme();
  const pulse = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.6, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, borderRadius: round, backgroundColor: colors.skeleton, opacity: pulse }, style]}
    />
  );
}
