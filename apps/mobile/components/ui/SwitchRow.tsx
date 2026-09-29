import { Switch, View } from "react-native";
import { space, touchTarget, useTheme } from "@/lib/theme";
import { Text } from "./Text";

export function SwitchRow({
  label,
  detail,
  value,
  onChange,
  first = false,
  disabled = false,
}: {
  label: string;
  detail?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  first?: boolean;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        minHeight: touchTarget + 8,
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        paddingHorizontal: space.lg,
        paddingVertical: space.md,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: colors.border,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text variant="body">{label}</Text>
        {detail && (
          <Text variant="caption" tone="tertiary">
            {detail}
          </Text>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        accessibilityLabel={label}
        trackColor={{ true: colors.accent, false: colors.borderStrong }}
        thumbColor="#ffffff"
        ios_backgroundColor={colors.borderStrong}
      />
    </View>
  );
}
