import { View, type StyleProp, type ViewStyle } from "react-native";
import { radius, space, touchTarget, useTheme } from "@/lib/theme";
import { Icon, type IconName } from "./Icon";
import { Pressable } from "./Pressable";
import { Text } from "./Text";

export type SegmentOption<T extends string> = { value: T; label: string; icon?: IconName };

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      style={[
        {
          flexDirection: "row",
          backgroundColor: colors.surfaceSunken,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.full,
          padding: 3,
        },
        style,
      ]}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            haptic="selection"
            pressScale={0.97}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={o.label}
            style={{
              flex: 1,
              minHeight: touchTarget - 8,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              paddingHorizontal: space.sm,
              borderRadius: radius.full,
              backgroundColor: active ? colors.accent : "transparent",
            }}
          >
            {o.icon && <Icon name={o.icon} size="sm" color={active ? colors.onAccent : colors.textSecondary} />}
            <Text variant="captionStrong" style={{ color: active ? colors.onAccent : colors.textSecondary }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
