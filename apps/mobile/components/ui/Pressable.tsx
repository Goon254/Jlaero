import { useRef } from "react";
import {
  Animated,
  Pressable as RNPressable,
  type PressableProps as RNPressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/lib/theme";

export type PressableProps = Omit<RNPressableProps, "style"> & {
  style?: StyleProp<ViewStyle>;
  /** Scale applied while pressed. Set to 1 to disable. */
  pressScale?: number;
  /** Opacity applied while pressed. */
  pressOpacity?: number;
  haptic?: boolean | "light" | "medium" | "selection";
};

// Pressable with a subtle scale + opacity press state (no layout shift),
// optional haptic feedback, and reduced-motion awareness.
export function Pressable({
  style,
  pressScale = 0.98,
  pressOpacity = 0.9,
  haptic = false,
  onPressIn,
  onPressOut,
  onPress,
  children,
  ...rest
}: PressableProps) {
  const { reduceMotion } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const animate = (to: number) => {
    if (reduceMotion) {
      opacity.setValue(to === 1 ? 1 : pressOpacity);
      return;
    }
    Animated.parallel([
      Animated.timing(scale, { toValue: to === 1 ? 1 : pressScale, duration: 120, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: to === 1 ? 1 : pressOpacity, duration: 120, useNativeDriver: true }),
    ]).start();
  };

  return (
    <RNPressable
      {...rest}
      onPressIn={(e) => {
        animate(0);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        animate(1);
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptic) {
          const kind = haptic === true ? "light" : haptic;
          if (kind === "selection") Haptics.selectionAsync().catch(() => {});
          else
            Haptics.impactAsync(
              kind === "medium" ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light
            ).catch(() => {});
        }
        onPress?.(e);
      }}
    >
      <Animated.View style={[style, { transform: [{ scale }], opacity }]}>
        {children as React.ReactNode}
      </Animated.View>
    </RNPressable>
  );
}
