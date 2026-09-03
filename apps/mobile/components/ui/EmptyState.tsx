import { View } from "react-native";
import { radius, space, useTheme } from "@/lib/theme";
import { Button } from "./Button";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";

export function EmptyState({
  icon,
  title,
  body,
  actionLabel,
  onAction,
}: {
  icon: IconName;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: "center", paddingVertical: space.huge, paddingHorizontal: space.xxl }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: radius.full,
          backgroundColor: colors.accentSoft,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: space.lg,
        }}
      >
        <Icon name={icon} size="lg" color={colors.accentText} />
      </View>
      <Text variant="title" align="center">
        {title}
      </Text>
      {body && (
        <Text variant="body" tone="secondary" align="center" style={{ marginTop: space.sm, maxWidth: 300 }}>
          {body}
        </Text>
      )}
      {actionLabel && onAction && (
        <Button title={actionLabel} onPress={onAction} variant="secondary" style={{ marginTop: space.xl }} />
      )}
    </View>
  );
}
