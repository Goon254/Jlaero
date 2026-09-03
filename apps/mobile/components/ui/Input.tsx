import { useState } from "react";
import { TextInput, View, type TextInputProps, type StyleProp, type ViewStyle } from "react-native";
import { fonts, radius, space, touchTarget, useTheme } from "@/lib/theme";
import { Icon, type IconName } from "./Icon";
import { Pressable } from "./Pressable";
import { Text } from "./Text";

export type InputProps = Omit<TextInputProps, "style"> & {
  label?: string;
  hint?: string;
  error?: string | null;
  icon?: IconName;
  containerStyle?: StyleProp<ViewStyle>;
  /** Adds a show/hide toggle for password fields. */
  secureToggle?: boolean;
};

export function Input({
  label,
  hint,
  error,
  icon,
  containerStyle,
  secureToggle,
  secureTextEntry,
  onFocus,
  onBlur,
  ...rest
}: InputProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!secureTextEntry);

  const borderColor = error ? colors.danger : focused ? colors.accent : colors.border;

  return (
    <View style={containerStyle}>
      {label && (
        <Text variant="label" tone="tertiary" style={{ marginBottom: space.sm, marginLeft: 2 }}>
          {label}
        </Text>
      )}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          minHeight: touchTarget + 4,
          borderWidth: 1,
          borderColor,
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          paddingHorizontal: space.md,
          gap: space.sm,
        }}
      >
        {icon && <Icon name={icon} size="sm" color={focused ? colors.accentText : colors.textTertiary} />}
        <TextInput
          {...rest}
          accessibilityLabel={rest.accessibilityLabel ?? label ?? rest.placeholder}
          secureTextEntry={secureToggle ? hidden : secureTextEntry}
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.accent}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={{
            flex: 1,
            minHeight: touchTarget + 2,
            paddingVertical: space.md,
            fontFamily: fonts.sans,
            fontSize: 16,
            color: colors.text,
          }}
        />
        {secureToggle && (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={hidden ? "Show password" : "Hide password"}
            style={{ padding: space.xs }}
          >
            <Icon name={hidden ? "eye-outline" : "eye-off-outline"} size="sm" color={colors.textTertiary} />
          </Pressable>
        )}
      </View>
      {error ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: space.sm }}>
          <Icon name="alert-circle-outline" size={16} color={colors.danger} />
          <Text variant="caption" tone="danger" style={{ flex: 1 }}>
            {error}
          </Text>
        </View>
      ) : hint ? (
        <Text variant="caption" tone="tertiary" style={{ marginTop: space.sm, marginLeft: 2 }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
