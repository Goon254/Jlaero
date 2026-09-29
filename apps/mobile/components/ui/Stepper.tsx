import { View, type StyleProp, type ViewStyle } from "react-native";
import { radius, space, touchTarget, useTheme } from "@/lib/theme";
import { Icon, type IconName } from "./Icon";
import { Pressable } from "./Pressable";
import { Text } from "./Text";

export function Stepper({
  label,
  icon,
  value,
  onChange,
  min = 0,
  max = 99,
  unit,
  containerStyle,
  hint,
}: {
  label?: string;
  icon?: IconName;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  unit?: (n: number) => string;
  containerStyle?: StyleProp<ViewStyle>;
  hint?: string;
}) {
  const { colors } = useTheme();
  const canDec = value > min;
  const canInc = value < max;
  const display = unit ? unit(value) : String(value);

  const Btn = ({ name, enabled, onPress, a11y }: { name: IconName; enabled: boolean; onPress: () => void; a11y: string }) => (
    <Pressable
      onPress={onPress}
      disabled={!enabled}
      haptic="selection"
      pressScale={0.92}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled: !enabled }}
      style={{
        width: 40,
        height: 40,
        borderRadius: radius.full,
        backgroundColor: enabled ? colors.accentSoft : colors.surfaceSunken,
        alignItems: "center",
        justifyContent: "center",
        opacity: enabled ? 1 : 0.5,
      }}
    >
      <Icon name={name} size="sm" color={enabled ? colors.accentText : colors.textTertiary} />
    </Pressable>
  );

  return (
    <View style={containerStyle}>
      {label && (
        <Text variant="label" tone="tertiary" style={{ marginBottom: space.sm, marginLeft: 2 }}>
          {label}
        </Text>
      )}
      <View
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ text: display }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          minHeight: touchTarget + 4,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          paddingHorizontal: space.md,
          paddingVertical: 4,
          gap: space.sm,
        }}
      >
        {icon && <Icon name={icon} size="sm" color={colors.accentText} />}
        <Text style={{ flex: 1, fontSize: 16, lineHeight: 22 }}>{display}</Text>
        <Btn name="remove" enabled={canDec} onPress={() => onChange(value - 1)} a11y="Decrease" />
        <Btn name="add" enabled={canInc} onPress={() => onChange(value + 1)} a11y="Increase" />
      </View>
      {hint ? (
        <Text variant="caption" tone="tertiary" style={{ marginTop: space.sm, marginLeft: 2 }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
