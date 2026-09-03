import type { TextStyle, ViewStyle } from "react-native";
import { colors } from "./theme";

export const field: TextStyle = {
  borderWidth: 1,
  borderColor: colors.border,
  backgroundColor: colors.inkSoft,
  borderRadius: 10,
  paddingHorizontal: 14,
  paddingVertical: 12,
  color: colors.text,
  fontSize: 15,
};

export const button: ViewStyle = {
  backgroundColor: colors.gold,
  borderRadius: 999,
  paddingVertical: 14,
  alignItems: "center",
};

export const buttonText: TextStyle = {
  color: colors.ink,
  fontWeight: "700",
  fontSize: 15,
};

export const card: ViewStyle = {
  backgroundColor: colors.inkSoft,
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: 16,
  padding: 14,
};
