import { useEffect, useMemo, useState } from "react";
import { FlatList, Modal, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AircraftCategory } from "@jlaero/shared";
import { searchCharter, type SearchResult } from "@/lib/search";
import { CATEGORIES, categoryLabel } from "@/lib/categories";
import { money, shortDate } from "@/lib/format";
import { fonts, radius, space, touchTarget, useTheme } from "@/lib/theme";
import {
  Button,
  Card,
  EmptyState,
  Icon,
  IconButton,
  Pill,
  Pressable,
  PressableCard,
  Screen,
  Skeleton,
  Text,
} from "@/components/ui";

type Params = {
  origin: string;
  originLabel?: string;
  destination: string;
  destinationLabel?: string;
  date?: string;
  returnDate?: string;
  pax?: string;
};

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace("/(tabs)");
}

function ResultCard({ item, params }: { item: SearchResult; params: Params }) {
  const { colors } = useTheme();
  const subtitle = [categoryLabel(item.category), item.seats ? `${item.seats} seats` : null].filter(Boolean).join("  ·  ");
  return (
    <PressableCard
      padded={false}
      onPress={() =>
        router.push({
          pathname: "/aircraft/[id]",
          params: {
            id: item.id,
            origin: params.origin,
            destination: params.destination,
            date: params.date ?? "",
            returnDate: params.returnDate ?? "",
            pax: params.pax ?? "",
          },
        })
      }
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${subtitle}${item.estimatedTotal ? `, estimated ${money(item.estimatedTotal, item.currency)}` : ""}`}
    >
      <View style={{ height: 200, backgroundColor: colors.surfaceSunken }}>
        {item.cover && (
          <Image source={{ uri: item.cover }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={250} />
        )}
        <LinearGradient
          colors={["rgba(5,8,15,0.35)", "rgba(5,8,15,0)"]}
          style={{ position: "absolute", left: 0, right: 0, top: 0, height: 70 }}
        />
        <View
          style={{
            position: "absolute",
            top: space.md,
            left: space.md,
            backgroundColor: item.instant_book ? colors.accent : "rgba(11,18,32,0.72)",
            borderRadius: radius.full,
            paddingHorizontal: 10,
            paddingVertical: 4,
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
          }}
        >
          <Icon name={item.instant_book ? "flash" : "chatbubble-ellipses-outline"} size={12} color={item.instant_book ? colors.onAccent : "#e4c877"} />
          <Text variant="label" style={{ color: item.instant_book ? colors.onAccent : "#e4c877" }}>
            {item.instant_book ? "Instant confirmation" : "Quote within hours"}
          </Text>
        </View>
      </View>
      <View style={{ padding: space.lg, gap: space.sm }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: space.md }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 20, lineHeight: 26, color: colors.text }} numberOfLines={1}>
              {item.name}
            </Text>
            <Text variant="caption" tone="secondary" style={{ marginTop: 2 }}>
              {subtitle}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            {item.estimatedTotal ? (
              <>
                <Text style={{ fontFamily: fonts.sansSemiBold, fontSize: 18, lineHeight: 24, color: colors.text }}>
                  {money(item.estimatedTotal, item.currency)}
                </Text>
                <Text variant="caption" tone="tertiary">
                  est. all-in
                </Text>
              </>
            ) : item.hourly_rate ? (
              <>
                <Text style={{ fontFamily: fonts.sansSemiBold, fontSize: 18, lineHeight: 24, color: colors.text }}>
                  {money(item.hourly_rate, item.currency)}
                </Text>
                <Text variant="caption" tone="tertiary">
                  per hour
                </Text>
              </>
            ) : (
              <Text variant="caption" tone="tertiary">
                Price on request
              </Text>
            )}
          </View>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm, alignItems: "center" }}>
          {item.estimatedHours ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Icon name="time-outline" size={14} color={colors.textTertiary} />
              <Text variant="caption" tone="secondary">
                ~{item.estimatedHours.toFixed(1)} hrs
              </Text>
            </View>
          ) : null}
          {item.home_base ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Icon name="location-outline" size={14} color={colors.textTertiary} />
              <Text variant="caption" tone="secondary">
                {item.home_base}
                {item.distanceFromOriginNm != null ? ` · ${item.distanceFromOriginNm} nm away` : ""}
              </Text>
            </View>
          ) : null}
          <View style={{ flex: 1 }} />
          {item.argus_rating ? <Pill label={`ARGUS ${item.argus_rating}`} tone="accent" /> : null}
          {item.wyvern_rating ? <Pill label={`Wyvern ${item.wyvern_rating}`} tone="accent" /> : null}
        </View>
      </View>
    </PressableCard>
  );
}

function SkeletonCard() {
  return (
    <Card padded={false}>
      <Skeleton height={200} round={0} />
      <View style={{ padding: space.lg, gap: space.sm }}>
        <Skeleton width="60%" height={20} />
        <Skeleton width="40%" height={13} />
      </View>
    </Card>
  );
}

export default function SearchResults() {
  const params = useLocalSearchParams<Params>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const pax = Number(params.pax ?? "1") || 1;
  const roundTrip = !!params.returnDate;
  const [selected, setSelected] = useState<AircraftCategory[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [draft, setDraft] = useState<AircraftCategory[]>([]);
  const [all, setAll] = useState<SearchResult[] | null>(null);
  const [distance, setDistance] = useState<number | null>(null);

  useEffect(() => {
    setAll(null);
    searchCharter({ origin: params.origin, destination: params.destination, pax, roundTrip }).then((r) => {
      setAll(r.results);
      setDistance(r.tripDistanceNm);
    });
  }, [params.origin, params.destination, pax, roundTrip]);

  const results = useMemo(
    () => (all ?? []).filter((r) => !selected.length || (r.category && selected.includes(r.category))),
    [all, selected]
  );
  const availableCats = useMemo(() => new Set((all ?? []).map((r) => r.category).filter(Boolean)), [all]);
  const cheapestByCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of all ?? []) {
      if (!r.category || r.estimatedTotal == null) continue;
      m.set(r.category, Math.min(m.get(r.category) ?? Infinity, r.estimatedTotal));
    }
    return m;
  }, [all]);

  const originText = params.originLabel?.split(" · ")[0] ?? params.origin;
  const destText = params.destinationLabel?.split(" · ")[0] ?? params.destination;
  const subtitle = [
    params.date ? shortDate(`${params.date}T12:00:00Z`) : "Flexible dates",
    roundTrip ? "Round trip" : "One way",
    `${pax} ${pax === 1 ? "passenger" : "passengers"}`,
    distance ? `${distance.toLocaleString()} nm` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <Screen>
      <View style={{ paddingTop: insets.top + space.sm, paddingHorizontal: space.lg, paddingBottom: space.md, gap: space.md, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.bg }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
          <IconButton icon="chevron-back" onPress={goBack} accessibilityLabel="Back" size={40} />
          <Pressable
            onPress={goBack}
            haptic="light"
            pressScale={0.99}
            accessibilityRole="button"
            accessibilityLabel={`Edit search: ${originText} to ${destText}`}
            style={{ flex: 1, backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: space.lg, paddingVertical: 8, alignItems: "center" }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text variant="subhead" numberOfLines={1} style={{ flexShrink: 1 }}>
                {originText}
              </Text>
              <Icon name={roundTrip ? "swap-horizontal" : "arrow-forward"} size={14} color={colors.accentText} />
              <Text variant="subhead" numberOfLines={1} style={{ flexShrink: 1 }}>
                {destText}
              </Text>
            </View>
            <Text variant="caption" tone="tertiary" numberOfLines={1}>
              {subtitle}
            </Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingRight: space.lg }}>
          <Pressable
            onPress={() => {
              setDraft(selected);
              setFilterOpen(true);
            }}
            haptic="light"
            accessibilityRole="button"
            accessibilityLabel="Filter by aircraft class"
            style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, height: 36, borderRadius: radius.full, borderWidth: 1, borderColor: selected.length ? colors.accent : colors.borderStrong, backgroundColor: selected.length ? colors.accentSoft : "transparent" }}
          >
            <Icon name="options-outline" size={16} color={selected.length ? colors.accentText : colors.textSecondary} />
            <Text variant="captionStrong" style={{ color: selected.length ? colors.accentText : colors.textSecondary }}>
              {selected.length ? `${selected.length} ${selected.length === 1 ? "class" : "classes"}` : "All classes"}
            </Text>
          </Pressable>
          {CATEGORIES.filter((c) => availableCats.has(c.key)).map((c) => {
            const on = selected.includes(c.key);
            return (
              <Pressable
                key={c.key}
                onPress={() => setSelected((s) => (on ? s.filter((k) => k !== c.key) : [...s, c.key]))}
                haptic="selection"
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={c.label}
                style={{ paddingHorizontal: 12, height: 36, borderRadius: radius.full, borderWidth: 1, borderColor: on ? colors.accent : colors.border, backgroundColor: on ? colors.accent : colors.surface, justifyContent: "center" }}
              >
                <Text variant="captionStrong" style={{ color: on ? colors.onAccent : colors.text }}>
                  {c.short}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={all === null ? [] : results}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: space.xl, gap: space.lg, paddingBottom: insets.bottom + 96 }}
        ListHeaderComponent={
          all === null ? null : (
            <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
              <Text variant="label" tone="tertiary" accessibilityRole="header">
                {results.length === 1 ? "1 aircraft" : `${results.length} aircraft`}
              </Text>
              <Text variant="caption" tone="tertiary">
                Estimates, lowest first
              </Text>
            </View>
          )
        }
        ListEmptyComponent={
          all === null ? (
            <View style={{ gap: space.lg }}>
              <SkeletonCard />
              <SkeletonCard />
            </View>
          ) : (
            <EmptyState
              icon="airplane-outline"
              title="Nothing available nearby yet"
              body="Our team can still source this trip from the wider operator network. Send the request and we will come back with options."
              actionLabel="Ask our team"
              onAction={() => router.push("/(tabs)/messages")}
            />
          )
        }
        renderItem={({ item }) => <ResultCard item={item} params={params} />}
      />

      {all !== null && results.length > 0 && (
        <View style={{ position: "absolute", left: space.xl, right: space.xl, bottom: insets.bottom + space.lg }}>
          <View style={{ backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.lg, padding: space.md, flexDirection: "row", alignItems: "center", gap: space.md, shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 }}>
            <Icon name="information-circle-outline" color={colors.accentText} />
            <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
              Prices are estimates from operator hourly rates. Your quote is a single all-in price.
            </Text>
          </View>
        </View>
      )}

      <Modal visible={filterOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setFilterOpen(false)}>
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: space.xl, paddingTop: space.lg, gap: space.md }}>
            <Text variant="title" style={{ flex: 1 }}>
              Aircraft class
            </Text>
            <IconButton icon="close" onPress={() => setFilterOpen(false)} accessibilityLabel="Close" size={40} />
          </View>
          <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.sm, paddingBottom: 120 }}>
            {CATEGORIES.filter((c) => c.key !== "airliner" && c.key !== "helicopter").map((c) => {
              const on = draft.includes(c.key);
              const available = availableCats.has(c.key);
              const from = cheapestByCat.get(c.key);
              return (
                <Pressable
                  key={c.key}
                  onPress={() => setDraft((d) => (on ? d.filter((k) => k !== c.key) : [...d, c.key]))}
                  disabled={!available}
                  haptic="selection"
                  pressScale={0.99}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on, disabled: !available }}
                  accessibilityLabel={`${c.label}, up to ${c.pax} passengers, range ${c.rangeNm} nautical miles${from ? `, from ${money(from)}` : ""}`}
                  style={{ flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg, minHeight: touchTarget + 16, borderRadius: radius.lg, borderWidth: 1, borderColor: on ? colors.accent : colors.border, backgroundColor: colors.surface, opacity: available ? 1 : 0.45 }}
                >
                  <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: on ? colors.accent : colors.borderStrong, backgroundColor: on ? colors.accent : "transparent", alignItems: "center", justifyContent: "center" }}>
                    {on && <Icon name="checkmark" size={16} color={colors.onAccent} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong">{c.label}</Text>
                    <Text variant="caption" tone="secondary">
                      Up to {c.pax} passengers  ·  {c.rangeNm.toLocaleString()} nm range
                    </Text>
                    <Text variant="caption" tone="tertiary" style={{ marginTop: 2 }}>
                      {c.blurb}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    {from ? (
                      <>
                        <Text variant="captionStrong" tone="accent">
                          from {money(from)}
                        </Text>
                      </>
                    ) : (
                      <Text variant="caption" tone="tertiary">
                        {available ? "Ask" : "N/A"}
                      </Text>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={{ position: "absolute", left: space.xl, right: space.xl, bottom: insets.bottom + space.lg, gap: space.sm }}>
            <Button
              title={draft.length ? `Show ${draft.length} ${draft.length === 1 ? "class" : "classes"}` : "Show all classes"}
              size="lg"
              onPress={() => {
                setSelected(draft);
                setFilterOpen(false);
              }}
            />
            {draft.length > 0 && <Button title="Clear" variant="ghost" onPress={() => setDraft([])} />}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
