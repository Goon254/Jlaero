import { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View, useWindowDimensions } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { requestCharter } from "@/lib/booking";
import { publicPhotoUrl } from "@/lib/media";
import { money } from "@/lib/format";
import { fonts, radius, space, useTheme } from "@/lib/theme";
import {
  Button,
  Card,
  Icon,
  IconButton,
  Input,
  Screen,
  Segmented,
  Skeleton,
  Text,
  type IconName,
} from "@/components/ui";

type Aircraft = {
  id: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  seats: number | null;
  year: number | null;
  hourly_rate: number | null;
  home_base: string | null;
  description: string | null;
  range_nm: number | null;
  aircraft_photos: { file_path: string; position: number }[];
};

type TripType = "one_way" | "round_trip";

function Stat({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 4, paddingVertical: space.md }}>
      <Icon name={icon} size="sm" color={colors.accentText} />
      <Text variant="bodyStrong">{value}</Text>
      <Text variant="caption" tone="tertiary">
        {label}
      </Text>
    </View>
  );
}

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace("/(tabs)");
}

export default function AircraftDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [aircraft, setAircraft] = useState<Aircraft | null | undefined>(undefined);
  const [tripType, setTripType] = useState<TripType>("one_way");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [departDate, setDepartDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [pax, setPax] = useState("");
  const [busy, setBusy] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);

  useEffect(() => {
    supabase
      .from("aircraft")
      .select(
        "id, name, manufacturer, model, seats, year, hourly_rate, home_base, description, range_nm, aircraft_photos(file_path, position)"
      )
      .eq("id", id)
      .eq("status", "active")
      .maybeSingle()
      .then(({ data }) => {
        setAircraft(data as Aircraft | null);
        if (data?.home_base) setOrigin(data.home_base);
      });
  }, [id]);

  async function submit() {
    if (!origin || !destination || !departDate || !pax) {
      Alert.alert("Missing details", "Route, departure date, and guests are required.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(departDate) || (returnDate && !/^\d{4}-\d{2}-\d{2}$/.test(returnDate))) {
      Alert.alert("Date format", "Use YYYY-MM-DD for dates.");
      return;
    }
    setBusy(true);
    const res = await requestCharter({
      aircraftId: id!,
      tripType,
      origin,
      destination,
      departDate,
      returnDate: returnDate || undefined,
      passengers: Number(pax),
    });
    setBusy(false);
    if (res.error) Alert.alert("Request failed", res.error);
    else router.replace(`/booking/${res.bookingId}`);
  }

  const heroHeight = Math.round(width * 0.82);

  if (aircraft === undefined) {
    return (
      <Screen>
        <Skeleton height={heroHeight} round={0} />
        <View style={{ padding: space.xl, gap: space.md }}>
          <Skeleton width="70%" height={28} />
          <Skeleton width="45%" height={16} />
        </View>
        <IconButton icon="chevron-back" variant="overlay" onPress={goBack} accessibilityLabel="Back" style={{ position: "absolute", top: insets.top + space.sm, left: space.lg }} />
      </Screen>
    );
  }

  if (aircraft === null) {
    return (
      <Screen style={{ justifyContent: "center", padding: space.xxl, gap: space.lg }}>
        <Text variant="title" align="center">
          This listing is no longer available
        </Text>
        <Button title="Back to Explore" variant="secondary" onPress={goBack} />
      </Screen>
    );
  }

  const photos = [...aircraft.aircraft_photos].sort((a, b) => a.position - b.position);
  const subtitle = [aircraft.year, aircraft.manufacturer, aircraft.model].filter(Boolean).join(" ");

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + space.xxxl }}>
          <View style={{ height: heroHeight, backgroundColor: colors.surfaceSunken }}>
            {photos.length > 0 && (
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) => setPhotoIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
              >
                {photos.map((p) => (
                  <Image
                    key={p.file_path}
                    source={{ uri: publicPhotoUrl("aircraft-photos", p.file_path) }}
                    style={{ width, height: heroHeight }}
                    contentFit="cover"
                    transition={250}
                    accessibilityLabel={`${aircraft.name} photo`}
                  />
                ))}
              </ScrollView>
            )}
            <LinearGradient
              colors={["rgba(5,8,15,0.55)", "rgba(5,8,15,0)"]}
              style={{ position: "absolute", left: 0, right: 0, top: 0, height: insets.top + 80 }}
              pointerEvents="none"
            />
            <LinearGradient
              colors={["rgba(5,8,15,0)", colors.bg]}
              style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 120 }}
              pointerEvents="none"
            />
            <IconButton
              icon="chevron-back"
              variant="overlay"
              onPress={goBack}
              accessibilityLabel="Back"
              style={{ position: "absolute", top: insets.top + space.sm, left: space.lg }}
            />
            {photos.length > 1 && (
              <View
                accessibilityLabel={`Photo ${photoIndex + 1} of ${photos.length}`}
                style={{
                  position: "absolute",
                  bottom: space.xxl,
                  alignSelf: "center",
                  flexDirection: "row",
                  gap: 6,
                }}
              >
                {photos.map((p, i) => (
                  <View
                    key={p.file_path}
                    style={{
                      width: i === photoIndex ? 18 : 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: i === photoIndex ? colors.accent : "rgba(255,255,255,0.55)",
                    }}
                  />
                ))}
              </View>
            )}
          </View>

          <View style={{ paddingHorizontal: space.xl, gap: space.xl, marginTop: -space.sm }}>
            <View>
              {subtitle ? (
                <Text variant="label" tone="accent" style={{ marginBottom: space.xs }}>
                  {subtitle}
                </Text>
              ) : null}
              <Text variant="display" accessibilityRole="header">
                {aircraft.name}
              </Text>
              {aircraft.hourly_rate ? (
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4, marginTop: space.sm }}>
                  <Text style={{ fontFamily: fonts.display, fontSize: 22, lineHeight: 28, color: colors.text }}>
                    {money(aircraft.hourly_rate)}
                  </Text>
                  <Text variant="caption" tone="secondary">
                    per flight hour
                  </Text>
                </View>
              ) : null}
            </View>

            <Card padded={false} style={{ flexDirection: "row" }}>
              {aircraft.seats ? <Stat icon="people-outline" label="Seats" value={String(aircraft.seats)} /> : null}
              {aircraft.range_nm ? (
                <Stat icon="navigate-outline" label="Range" value={`${aircraft.range_nm.toLocaleString()} nm`} />
              ) : null}
              {aircraft.home_base ? <Stat icon="location-outline" label="Home base" value={aircraft.home_base} /> : null}
            </Card>

            {aircraft.description ? (
              <Text variant="body" tone="secondary">
                {aircraft.description}
              </Text>
            ) : null}

            <Card raised style={{ gap: space.lg }}>
              <View>
                <Text variant="label" tone="accent" style={{ marginBottom: space.xs }}>
                  Request a quote
                </Text>
                <Text variant="title">Plan your trip</Text>
              </View>
              <Segmented<TripType>
                value={tripType}
                onChange={setTripType}
                options={[
                  { value: "one_way", label: "One way", icon: "arrow-forward" },
                  { value: "round_trip", label: "Round trip", icon: "swap-horizontal" },
                ]}
              />
              <View style={{ flexDirection: "row", gap: space.sm }}>
                <Input
                  label="From"
                  icon="location-outline"
                  value={origin}
                  onChangeText={setOrigin}
                  placeholder="TEB"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  containerStyle={{ flex: 1 }}
                />
                <Input
                  label="To"
                  icon="navigate-outline"
                  value={destination}
                  onChangeText={setDestination}
                  placeholder="LAX"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  containerStyle={{ flex: 1 }}
                />
              </View>
              <Input
                label="Departure"
                icon="calendar-outline"
                value={departDate}
                onChangeText={setDepartDate}
                placeholder="YYYY-MM-DD"
                keyboardType="numbers-and-punctuation"
              />
              {tripType === "round_trip" && (
                <Input
                  label="Return"
                  icon="calendar-outline"
                  value={returnDate}
                  onChangeText={setReturnDate}
                  placeholder="YYYY-MM-DD"
                  keyboardType="numbers-and-punctuation"
                />
              )}
              <Input
                label="Guests"
                icon="people-outline"
                value={pax}
                onChangeText={setPax}
                placeholder={aircraft.seats ? `Up to ${aircraft.seats}` : "Number of guests"}
                keyboardType="number-pad"
              />
              <Button title="Request quote" onPress={submit} loading={busy} size="lg" iconRight="arrow-forward" />
              <View style={{ flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center" }}>
                <Icon name="shield-checkmark-outline" size={15} color={colors.textTertiary} />
                <Text variant="caption" tone="tertiary">
                  The operator replies with an itemized quote. No payment yet.
                </Text>
              </View>
            </Card>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <View style={{ height: 0, borderRadius: radius.sm }} />
    </Screen>
  );
}
