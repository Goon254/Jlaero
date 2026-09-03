import { View } from "react-native";
import { radius, statusTone, toneColors, useTheme, type Tone } from "@/lib/theme";
import { humanStatus } from "@/lib/format";
import { Text } from "./Text";

export function Pill({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  const { colors } = useTheme();
  const c = toneColors(colors, tone);
  return (
    <View
      style={{
        backgroundColor: c.bg,
        borderRadius: radius.full,
        paddingHorizontal: 10,
        paddingVertical: 4,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
      }}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.fg }} />
      <Text variant="captionStrong" style={{ color: c.fg }}>
        {label}
      </Text>
    </View>
  );
}

export function StatusPill({ status }: { status: string }) {
  return <Pill label={humanStatus(status)} tone={statusTone[status] ?? "neutral"} />;
}
