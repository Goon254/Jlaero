import { View } from "react-native";
import { fonts, radius, useTheme } from "@/lib/theme";
import { Text } from "./Text";

export function Avatar({ label, size = 44 }: { label: string; size?: number }) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      style={{
        width: size,
        height: size,
        borderRadius: radius.full,
        backgroundColor: colors.accentSoft,
        borderWidth: 1,
        borderColor: colors.accent,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          fontFamily: fonts.display,
          fontSize: size * 0.4,
          lineHeight: size * 0.5,
          color: colors.accentText,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
