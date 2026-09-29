import { View, type StyleProp, type ViewStyle } from "react-native";
import { radius, space, touchTarget, useTheme } from "@/lib/theme";
import { Icon, type IconName } from "./Icon";
import { Pressable } from "./Pressable";
import { Text } from "./Text";

// Input-shaped tappable row used by pickers (date, airport). Matches Input's
// geometry so mixed forms line up.
export function PickerField({
  label,
  icon,
  value,
  placeholder,
  onPress,
  onClear,
  hint,
  error,
  containerStyle,
  trailingIcon = "chevron-down",
}: {
  label?: string;
  icon?: IconName;
  value?: string | null;
  placeholder: string;
  onPress: () => void;
  onClear?: () => void;
  hint?: string;
  error?: string | null;
  containerStyle?: StyleProp<ViewStyle>;
  trailingIcon?: IconName;
}) {
  const { colors } = useTheme();
  const has = !!value;
  return (
    <View style={containerStyle}>
      {label && (
        <Text variant="label" tone="tertiary" style={{ marginBottom: space.sm, marginLeft: 2 }}>
          {label}
        </Text>
      )}
      <Pressable
        onPress={onPress}
        haptic="light"
        pressScale={0.99}
        accessibilityRole="button"
        accessibilityLabel={`${label ?? placeholder}: ${value ?? "not set"}`}
        style={{
          flexDirection: "row",
          alignItems: "center",
          minHeight: touchTarget + 4,
          borderWidth: 1,
          borderColor: error ? colors.danger : colors.border,
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          paddingHorizontal: space.md,
          gap: space.sm,
        }}
      >
        {icon && <Icon name={icon} size="sm" color={has ? colors.accentText : colors.textTertiary} />}
        <Text
          numberOfLines={1}
          style={{ flex: 1, fontSize: 16, lineHeight: 22, color: has ? colors.text : colors.textTertiary }}
        >
          {value || placeholder}
        </Text>
        {has && onClear ? (
          <Pressable
            onPress={onClear}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`Clear ${label ?? placeholder}`}
            style={{ padding: 2 }}
          >
            <Icon name="close-circle" size="sm" color={colors.textTertiary} />
          </Pressable>
        ) : (
          <Icon name={trailingIcon} size="sm" color={colors.textTertiary} />
        )}
      </Pressable>
      {error ? (
        <Text variant="caption" tone="danger" style={{ marginTop: space.sm, marginLeft: 2 }}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="tertiary" style={{ marginTop: space.sm, marginLeft: 2 }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
