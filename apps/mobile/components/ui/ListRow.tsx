import { View } from "react-native";
import { radius, space, touchTarget, useTheme } from "@/lib/theme";
import { Icon, type IconName } from "./Icon";
import { Pressable } from "./Pressable";
import { Text } from "./Text";

export function ListRow({
  icon,
  label,
  detail,
  onPress,
  danger = false,
  external = false,
  first = false,
}: {
  icon: IconName;
  label: string;
  detail?: string;
  onPress: () => void;
  danger?: boolean;
  external?: boolean;
  first?: boolean;
}) {
  const { colors } = useTheme();
  const fg = danger ? colors.danger : colors.text;
  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      pressScale={1}
      pressOpacity={0.6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        minHeight: touchTarget + 8,
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        paddingHorizontal: space.lg,
        paddingVertical: space.md,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: colors.border,
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: radius.sm,
          backgroundColor: danger ? colors.dangerSoft : colors.surfaceSunken,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name={icon} size="sm" color={danger ? colors.danger : colors.textSecondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="body" style={{ color: fg }}>
          {label}
        </Text>
        {detail && (
          <Text variant="caption" tone="tertiary">
            {detail}
          </Text>
        )}
      </View>
      <Icon name={external ? "open-outline" : "chevron-forward"} size="sm" color={colors.textTertiary} />
    </Pressable>
  );
}
