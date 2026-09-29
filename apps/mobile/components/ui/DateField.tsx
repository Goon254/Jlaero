import { useState } from "react";
import { Modal, Platform, View, type StyleProp, type ViewStyle } from "react-native";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, space, useTheme } from "@/lib/theme";
import { Button } from "./Button";
import { PickerField } from "./PickerField";
import { Pressable } from "./Pressable";
import { Text } from "./Text";

export function toDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function pretty(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

export function DateField({
  label,
  value,
  onChange,
  minimumDate,
  placeholder = "Select a date",
  containerStyle,
  error,
}: {
  label: string;
  value: Date | null;
  onChange: (d: Date | null) => void;
  minimumDate?: Date;
  placeholder?: string;
  containerStyle?: StyleProp<ViewStyle>;
  error?: string | null;
}) {
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(value ?? minimumDate ?? new Date());

  function openPicker() {
    const start = value ?? minimumDate ?? new Date();
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: start,
        mode: "date",
        minimumDate,
        onChange: (event, date) => {
          if (event.type === "set" && date) onChange(date);
        },
      });
      return;
    }
    setDraft(start);
    setOpen(true);
  }

  return (
    <>
      <PickerField
        label={label}
        icon="calendar-outline"
        value={value ? pretty(value) : null}
        placeholder={placeholder}
        onPress={openPicker}
        onClear={() => onChange(null)}
        containerStyle={containerStyle}
        error={error}
      />
      {Platform.OS === "ios" && (
        <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
          <Pressable
            onPress={() => setOpen(false)}
            pressScale={1}
            pressOpacity={1}
            accessibilityLabel="Dismiss"
            style={{ flex: 1, backgroundColor: colors.scrim }}
          />
          <View
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              paddingHorizontal: space.xl,
              paddingTop: space.lg,
              paddingBottom: insets.bottom + space.lg,
              gap: space.md,
            }}
          >
            <View style={{ alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong }} />
            <Text variant="headline">{label}</Text>
            <DateTimePicker
              value={draft}
              mode="date"
              display="inline"
              minimumDate={minimumDate}
              themeVariant={scheme}
              accentColor={colors.accent}
              onChange={(_, d) => d && setDraft(d)}
            />
            <Button
              title={`Use ${pretty(draft)}`}
              onPress={() => {
                onChange(draft);
                setOpen(false);
              }}
            />
          </View>
        </Modal>
      )}
    </>
  );
}
