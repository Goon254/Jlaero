import { useEffect, useState } from "react";
import { FlatList, View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { haversineNm } from "@jlaero/shared";
import { supabase } from "@/lib/supabase";
import { publicPhotoUrl } from "@/lib/media";
import { money } from "@/lib/format";
import { fonts, radius, space, useTheme } from "@/lib/theme";
import {
  Card,
  EmptyState,
  Icon,
  IconButton,
  Input,
  PressableCard,
  Screen,
  ScreenHeader,
  Skeleton,
  Text,
  type IconName,
} from "@/components/ui";

type Result = {
  id: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  seats: number | null;
  hourly_rate: number | null;
  home_base: string | null;
  range_nm: number | null;
  cover: string | null;
};

async function airportByCode(code: string) {
  const upper = code.trim().toUpperCase();
  if (!upper) return null;
  for (const c of [upper, upper.length === 3 ? `K${upper}` : null]) {
    if (!c) continue;
    const { data } = await supabase
      .from("airports")
      .select("icao, latitude, longitude")
      .or(`iata.eq.${c},icao.eq.${c},ident.eq.${c}`)
      .limit(1);
    if (data?.[0]) return data[0];
  }
  return null;
}

function Spec({ icon, value }: { icon: IconName; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      <Icon name={icon} size={15} color={colors.textTertiary} />
      <Text variant="caption" tone="secondary">
        {value}
      </Text>
    </View>
  );
}

function AircraftCard({ item }: { item: Result }) {
  const { colors } = useTheme();
  const subtitle = [item.manufacturer, item.model].filter(Boolean).join(" ");
  return (
    <PressableCard
      padded={false}
      onPress={() => router.push(`/aircraft/${item.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${subtitle}${item.hourly_rate ? `, ${money(item.hourly_rate)} per hour` : ""}`}
    >
      <View style={{ height: 210, backgroundColor: colors.surfaceSunken }}>
        {item.cover && (
          <Image
            source={{ uri: item.cover }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            transition={250}
            accessibilityIgnoresInvertColors
          />
        )}
        <LinearGradient
          colors={["rgba(5,8,15,0)", "rgba(5,8,15,0.15)", "rgba(5,8,15,0.82)"]}
          locations={[0.35, 0.6, 1]}
          style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 150 }}
        />
        {item.hourly_rate && (
          <View
            style={{
              position: "absolute",
              top: space.md,
              right: space.md,
              backgroundColor: "rgba(11,18,32,0.72)",
              borderRadius: radius.full,
              paddingHorizontal: 12,
              paddingVertical: 6,
              flexDirection: "row",
              alignItems: "baseline",
              gap: 3,
            }}
          >
            <Text style={{ fontFamily: fonts.sansSemiBold, fontSize: 14, color: "#e4c877" }}>
              {money(item.hourly_rate)}
            </Text>
            <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: "#d9dde6" }}>/hr</Text>
          </View>
        )}
        <View style={{ position: "absolute", left: space.lg, right: space.lg, bottom: space.lg }}>
          {subtitle ? (
            <Text variant="label" style={{ color: "#e4c877", marginBottom: 4 }}>
              {subtitle}
            </Text>
          ) : null}
          <Text
            numberOfLines={1}
            style={{ fontFamily: fonts.display, fontSize: 24, lineHeight: 30, color: "#ffffff" }}
          >
            {item.name}
          </Text>
        </View>
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: space.lg,
          paddingHorizontal: space.lg,
          paddingVertical: space.md,
        }}
      >
        {item.seats ? <Spec icon="people-outline" value={`${item.seats} seats`} /> : null}
        {item.range_nm ? <Spec icon="navigate-outline" value={`${item.range_nm.toLocaleString()} nm`} /> : null}
        {item.home_base ? <Spec icon="location-outline" value={item.home_base} /> : null}
        <View style={{ flex: 1 }} />
        <Icon name="chevron-forward" size="sm" color={colors.textTertiary} />
      </View>
    </PressableCard>
  );
}

function SkeletonCard() {
  return (
    <Card padded={false}>
      <Skeleton height={210} round={0} />
      <View style={{ flexDirection: "row", gap: space.lg, padding: space.lg }}>
        <Skeleton width={70} height={14} />
        <Skeleton width={70} height={14} />
        <Skeleton width={50} height={14} />
      </View>
    </Card>
  );
}

export default function Explore() {
  const { colors } = useTheme();
  const [origin, setOrigin] = useState("");
  const [pax, setPax] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [busy, setBusy] = useState(true);
  const [note, setNote] = useState<string | null>(null);

  async function search() {
    setBusy(true);
    setNote(null);
    let query = supabase
      .from("aircraft")
      .select(
        "id, name, manufacturer, model, seats, hourly_rate, home_base, range_nm, aircraft_photos(file_path, position)"
      )
      .eq("status", "active");
    if (pax) query = query.gte("seats", Number(pax));
    const { data } = await query.limit(60);
    let rows = data ?? [];

    const originAirport = origin ? await airportByCode(origin) : null;
    if (origin && !originAirport) setNote(`We couldn't find "${origin.toUpperCase()}". Showing all aircraft.`);
    if (originAirport) {
      const codes = [...new Set(rows.map((r) => r.home_base).filter(Boolean))] as string[];
      const { data: airports } = await supabase
        .from("airports")
        .select("icao, latitude, longitude")
        .in("icao", codes);
      const byIcao = new Map((airports ?? []).map((a) => [a.icao, a]));
      rows = rows.filter((r) => {
        const base = r.home_base ? byIcao.get(r.home_base) : null;
        if (!base) return false;
        return (
          haversineNm(originAirport.latitude, originAirport.longitude, base.latitude, base.longitude) <= 250
        );
      });
    }

    setResults(
      rows.map((r) => {
        const cover = [...(r.aircraft_photos ?? [])].sort((x, y) => x.position - y.position)[0];
        return {
          id: r.id,
          name: r.name,
          manufacturer: r.manufacturer,
          model: r.model,
          seats: r.seats,
          hourly_rate: r.hourly_rate,
          home_base: r.home_base,
          range_nm: r.range_nm,
          cover: cover ? publicPhotoUrl("aircraft-photos", cover.file_path) : null,
        };
      })
    );
    setBusy(false);
  }

  useEffect(() => {
    search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const header = (
    <View style={{ marginBottom: space.lg }}>
      <Card raised style={{ padding: space.md }}>
        <View style={{ flexDirection: "row", gap: space.sm, alignItems: "flex-end" }}>
          <Input
            label="Departing from"
            icon="location-outline"
            value={origin}
            onChangeText={setOrigin}
            placeholder="TEB, LAX, KVNY"
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={search}
            containerStyle={{ flex: 1 }}
          />
          <Input
            label="Guests"
            icon="people-outline"
            value={pax}
            onChangeText={setPax}
            placeholder="Any"
            keyboardType="number-pad"
            returnKeyType="search"
            onSubmitEditing={search}
            containerStyle={{ width: 118 }}
          />
          <IconButton icon="search" variant="accent" onPress={search} accessibilityLabel="Search aircraft" size={52} />
        </View>
      </Card>
      {note && (
        <View style={{ flexDirection: "row", gap: 6, alignItems: "center", marginTop: space.md, paddingHorizontal: 2 }}>
          <Icon name="information-circle-outline" size={16} color={colors.textTertiary} />
          <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
            {note}
          </Text>
        </View>
      )}
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: space.xl }}>
        <Text variant="label" tone="tertiary" accessibilityRole="header">
          {busy ? "Searching" : results.length === 1 ? "1 aircraft" : `${results.length} aircraft`}
        </Text>
        {!busy && results.length > 0 && (
          <Text variant="caption" tone="tertiary">
            Within 250 nm
          </Text>
        )}
      </View>
    </View>
  );

  return (
    <Screen>
      <FlatList
        data={busy ? [] : results}
        keyExtractor={(r) => r.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: space.xxxl, gap: space.lg }}
        ListHeaderComponent={
          <>
            <ScreenHeader eyebrow="Charter" title="Find your jet" />
            {header}
          </>
        }
        ListHeaderComponentStyle={{ marginHorizontal: -space.xl, paddingHorizontal: space.xl }}
        ListEmptyComponent={
          busy ? (
            <View style={{ gap: space.lg }}>
              <SkeletonCard />
              <SkeletonCard />
            </View>
          ) : (
            <EmptyState
              icon="airplane-outline"
              title="No aircraft nearby"
              body="Try a different departure airport or fewer guests."
              actionLabel="Clear filters"
              onAction={() => {
                setOrigin("");
                setPax("");
                setTimeout(search, 0);
              }}
            />
          )
        }
        renderItem={({ item }) => <AircraftCard item={item} />}
      />
    </Screen>
  );
}
