import { View, type ViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { space, useTheme } from "@/lib/theme";
import { Text } from "./Text";

/** Full-bleed themed container. */
export function Screen({ style, ...rest }: ViewProps) {
  const { colors } = useTheme();
  return <View {...rest} style={[{ flex: 1, backgroundColor: colors.bg }, style]} />;
}

/** Editorial in-screen header for tab roots (replaces native tab headers). */
export function ScreenHeader({
  eyebrow,
  title,
  right,
}: {
  eyebrow?: string;
  title: string;
  right?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        paddingTop: insets.top + space.md,
        paddingHorizontal: space.xl,
        paddingBottom: space.lg,
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: space.md,
      }}
    >
      <View style={{ flex: 1 }}>
        {eyebrow && (
          <Text variant="label" tone="accent" style={{ marginBottom: space.xs }}>
            {eyebrow}
          </Text>
        )}
        <Text variant="display" accessibilityRole="header">
          {title}
        </Text>
      </View>
      {right}
    </View>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: space.md,
      }}
    >
      <Text variant="label" tone="tertiary" accessibilityRole="header">
        {title}
      </Text>
      {action}
    </View>
  );
}
