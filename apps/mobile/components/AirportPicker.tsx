import { useEffect, useRef, useState } from "react";
import { FlatList, Modal, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { airportCode, airportLabel, searchAirports, type Airport, type AirportChoice } from "@/lib/airports";
import { fonts, radius, space, touchTarget, useTheme } from "@/lib/theme";
import { Icon, IconButton, PickerField, Pressable, Text } from "@/components/ui";
import type { StyleProp, ViewStyle } from "react-native";

function Row({
  code,
  title,
  subtitle,
  onPress,
  manual = false,
}: {
  code: string;
  title: string;
  subtitle?: string;
  onPress: () => void;
  manual?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      haptic="selection"
      pressScale={1}
      pressOpacity={0.6}
      accessibilityRole="button"
      accessibilityLabel={`${code}, ${title}`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        paddingVertical: space.md,
        minHeight: touchTarget + 8,
      }}
    >
      <View
        style={{
          width: 56,
          height: 40,
          borderRadius: radius.sm,
          backgroundColor: manual ? colors.surfaceSunken : colors.accentSoft,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: manual ? 1 : 0,
          borderColor: colors.border,
        }}
      >
        <Text style={{ fontFamily: fonts.sansSemiBold, fontSize: 14, color: manual ? colors.textSecondary : colors.accentText }}>
          {code}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Icon name="chevron-forward" size="sm" color={colors.textTertiary} />
    </Pressable>
  );
}

export function AirportPicker({
  visible,
  title,
  onClose,
  onSelect,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  onSelect: (choice: AirportChoice) => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Airport[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (!visible) {
      setQuery("");
      setResults([]);
      return;
    }
    const t = setTimeout(() => inputRef.current?.focus(), 250);
    return () => clearTimeout(t);
  }, [visible]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const id = ++seq.current;
    const t = setTimeout(async () => {
      const rows = await searchAirports(q);
      if (id !== seq.current) return;
      setResults(rows);
      setSearching(false);
    }, 220);
    return () => clearTimeout(t);
  }, [query]);

  const upper = query.trim().toUpperCase();
  const looksLikeCode = /^[A-Z0-9]{3,4}$/.test(upper);
  const exact = results.some((a) => a.iata === upper || a.icao === upper || a.ident === upper);
  const offerManual = looksLikeCode && !exact && !searching;

  function pick(a: Airport) {
    onSelect({ code: a.icao, label: `${airportCode(a)} · ${a.municipality ?? a.name}` });
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: space.lg }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.xl }}>
          <Text variant="title" style={{ flex: 1 }} accessibilityRole="header">
            {title}
          </Text>
          <IconButton icon="close" onPress={onClose} accessibilityLabel="Close" size={40} />
        </View>
        <View
          style={{
            marginHorizontal: space.xl,
            marginTop: space.lg,
            flexDirection: "row",
            alignItems: "center",
            gap: space.sm,
            minHeight: touchTarget + 4,
            borderWidth: 1,
            borderColor: colors.accent,
            backgroundColor: colors.surface,
            borderRadius: radius.md,
            paddingHorizontal: space.md,
          }}
        >
          <Icon name="search" size="sm" color={colors.accentText} />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder="Airport, city, or code"
            placeholderTextColor={colors.textTertiary}
            selectionColor={colors.accent}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search airports"
            style={{ flex: 1, minHeight: touchTarget + 2, fontFamily: fonts.sans, fontSize: 16, color: colors.text }}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery("")} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear search">
              <Icon name="close-circle" size="sm" color={colors.textTertiary} />
            </Pressable>
          )}
        </View>

        <FlatList
          data={results}
          keyExtractor={(a) => a.icao}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: insets.bottom + space.xxl, paddingTop: space.sm }}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 68 }} />}
          ListHeaderComponent={
            offerManual ? (
              <>
                <Row
                  code={upper}
                  title={`Use "${upper}" as entered`}
                  subtitle="Not in our airport list yet"
                  manual
                  onPress={() => {
                    onSelect({ code: upper, label: upper, manual: true });
                    onClose();
                  }}
                />
                {results.length > 0 && <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 68 }} />}
              </>
            ) : null
          }
          ListEmptyComponent={
            <View style={{ paddingVertical: space.xxxl, alignItems: "center", gap: space.sm }}>
              <Icon name="airplane-outline" size="lg" color={colors.textTertiary} />
              <Text variant="body" tone="secondary" align="center">
                {query.trim().length < 2
                  ? "Type a city, airport name, or code like TEB or LAX."
                  : searching
                    ? "Searching"
                    : offerManual
                      ? ""
                      : "No matches. Try a code or a nearby city."}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Row code={airportCode(item)} title={item.name} subtitle={airportLabel(item).split(" · ")[1] ?? item.icao} onPress={() => pick(item)} />
          )}
        />
      </View>
    </Modal>
  );
}

export function AirportField({
  label,
  value,
  onChange,
  placeholder = "Search airports",
  icon = "location-outline",
  containerStyle,
  error,
  clearable = true,
}: {
  label: string;
  value: AirportChoice | null;
  onChange: (v: AirportChoice | null) => void;
  placeholder?: string;
  icon?: "location-outline" | "navigate-outline";
  containerStyle?: StyleProp<ViewStyle>;
  error?: string | null;
  clearable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <PickerField
        label={label}
        icon={icon}
        value={value?.label ?? null}
        placeholder={placeholder}
        onPress={() => setOpen(true)}
        onClear={clearable ? () => onChange(null) : undefined}
        containerStyle={containerStyle}
        error={error}
        trailingIcon="search"
      />
      <AirportPicker visible={open} title={label} onClose={() => setOpen(false)} onSelect={onChange} />
    </>
  );
}
