import { useEffect, useState } from "react";
import { Alert, ScrollView, View, useWindowDimensions } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { requestCharter } from "@/lib/booking";
import { publicPhotoUrl } from "@/lib/media";
import { money } from "@/lib/format";
import { categoryLabel } from "@/lib/categories";
import { airportByCode } from "@/lib/airports";
import { estimateFlightHours, haversineNm, CRUISE_SPEEDS_KTS, type AircraftCategory } from "@jlaero/shared";
import { supabase as sb } from "@/lib/supabase";
import type { AirportChoice } from "@/lib/airports";
import { fonts, radius, space, useTheme } from "@/lib/theme";
import {
  Button,
  Card,
  DateField,
  Icon,
  IconButton,
  Pill,
  Screen,
  Segmented,
  Skeleton,
  Stepper,
  Text,
  toDateOnly,
  type IconName,
} from "@/components/ui";
import { AirportField } from "@/components/AirportPicker";

type Aircraft = {
  id: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  category: AircraftCategory | null;
  seats: number | null;
  year: number | null;
  hourly_rate: number | null;
  currency: string | null;
  instant_book: boolean;
  home_base: string | null;
  description: string | null;
  range_nm: number | null;
  argus_rating: string | null;
  wyvern_rating: string | null;
  is_bao_stage: string | null;
  cancellation_tier: string | null;
  aircraft_photos: { file_path: string; position: number }[];
};

type Prefill = { origin?: string; destination?: string; date?: string; returnDate?: string; pax?: string };

function parseDate(s?: string): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

type TripType = "one_way" | "round_trip";

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace("/(tabs)");
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function AircraftDetail() {
  const { id, ...prefill } = useLocalSearchParams<{ id: string } & Prefill>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [aircraft, setAircraft] = useState<Aircraft | null | undefined>(undefined);
  const [tripType, setTripType] = useState<TripType>(prefill.returnDate ? "round_trip" : "one_way");
  const [origin, setOrigin] = useState<AirportChoice | null>(prefill.origin ? { code: prefill.origin, label: prefill.origin } : null);
  const [destination, setDestination] = useState<AirportChoice | null>(
    prefill.destination ? { code: prefill.destination, label: prefill.destination } : null
  );
  const [departDate, setDepartDate] = useState<Date | null>(parseDate(prefill.date));
  const [returnDate, setReturnDate] = useState<Date | null>(parseDate(prefill.returnDate));
  const [guests, setGuests] = useState(Math.max(1, Number(prefill.pax) || 1));
  const [distanceNm, setDistanceNm] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase
      .from("aircraft")
      .select(
        "id, name, manufacturer, model, category, seats, year, hourly_rate, currency, instant_book, home_base, description, range_nm, argus_rating, wyvern_rating, is_bao_stage, cancellation_tier, aircraft_photos(file_path, position)"
      )
      .eq("id", id)
      .eq("status", "active")
      .maybeSingle()
      .then(({ data }) => {
        setAircraft(data as Aircraft | null);
        if (data?.home_base && !prefill.origin) setOrigin({ code: data.home_base, label: data.home_base });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Trip distance for the estimate, recomputed when the route changes.
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!origin || !destination) {
        setDistanceNm(null);
        return;
      }
      const [a, b] = await Promise.all([airportByCode(origin.code), airportByCode(destination.code)]);
      if (!a || !b) {
        if (alive) setDistanceNm(null);
        return;
      }
      const { data } = await sb.from("airports").select("icao, latitude, longitude").in("icao", [a.icao, b.icao]);
      const pa = data?.find((x) => x.icao === a.icao);
      const pb = data?.find((x) => x.icao === b.icao);
      if (alive && pa?.latitude && pa.longitude && pb?.latitude && pb.longitude) {
        setDistanceNm(Math.round(haversineNm(pa.latitude, pa.longitude, pb.latitude, pb.longitude)));
      } else if (alive) setDistanceNm(null);
    })();
    return () => {
      alive = false;
    };
  }, [origin, destination]);

  async function submit() {
    const next: Record<string, string> = {};
    if (!origin) next.origin = "Choose a departure airport.";
    if (!destination) next.destination = "Choose a destination.";
    if (!departDate) next.departDate = "Pick a departure date.";
    if (tripType === "round_trip" && !returnDate) next.returnDate = "Pick a return date.";
    if (tripType === "round_trip" && departDate && returnDate && returnDate < departDate) {
      next.returnDate = "Return must be after departure.";
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    const res = await requestCharter({
      aircraftId: id!,
      tripType,
      origin: origin!.code,
      destination: destination!.code,
      departDate: toDateOnly(departDate!),
      returnDate: tripType === "round_trip" && returnDate ? toDateOnly(returnDate) : undefined,
      passengers: guests,
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
        <IconButton
          icon="chevron-back"
          variant="overlay"
          onPress={goBack}
          accessibilityLabel="Back"
          style={{ position: "absolute", top: insets.top + space.sm, left: space.lg }}
        />
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
  const subtitle = [aircraft.manufacturer, aircraft.model].filter(Boolean).join(" ");
  const maxGuests = aircraft.seats ?? 19;
  const legs = tripType === "round_trip" ? 2 : 1;
  const estimate =
    distanceNm && aircraft.category && aircraft.hourly_rate
      ? (() => {
          const hours = estimateFlightHours(distanceNm, aircraft.category) * legs;
          return { hours, total: Math.round((hours * Number(aircraft.hourly_rate)) / 10) * 10 };
        })()
      : null;
  const specs: { icon: IconName; label: string; value: string }[] = [
    ...(aircraft.seats ? [{ icon: "people-outline" as IconName, label: "Seats", value: String(aircraft.seats) }] : []),
    ...(aircraft.range_nm ? [{ icon: "navigate-outline" as IconName, label: "Range", value: `${aircraft.range_nm.toLocaleString()} nm` }] : []),
    ...(aircraft.category ? [{ icon: "speedometer-outline" as IconName, label: "Cruise", value: `${CRUISE_SPEEDS_KTS[aircraft.category]} kts` }] : []),
    ...(aircraft.category ? [{ icon: "layers-outline" as IconName, label: "Class", value: categoryLabel(aircraft.category).replace(" Jet", "") }] : []),
    ...(aircraft.year ? [{ icon: "calendar-outline" as IconName, label: "Year", value: String(aircraft.year) }] : []),
    ...(aircraft.home_base ? [{ icon: "location-outline" as IconName, label: "Home base", value: aircraft.home_base }] : []),
  ];

  return (
    <Screen>
      <KeyboardAwareScrollView
        bottomOffset={32}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + space.xxxl }}
      >
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
              style={{ position: "absolute", bottom: space.xxl, alignSelf: "center", flexDirection: "row", gap: 6 }}
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
                  {money(aircraft.hourly_rate, aircraft.currency ?? "USD")}
                </Text>
                <Text variant="caption" tone="secondary">
                  per flight hour
                </Text>
              </View>
            ) : null}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.md }}>
              {aircraft.instant_book ? <Pill label="Instant confirmation" tone="success" /> : <Pill label="Quote within hours" tone="info" />}
              {aircraft.argus_rating ? <Pill label={`ARGUS ${aircraft.argus_rating}`} tone="accent" /> : null}
              {aircraft.wyvern_rating ? <Pill label={`Wyvern ${aircraft.wyvern_rating}`} tone="accent" /> : null}
              {aircraft.is_bao_stage ? <Pill label={`IS-BAO ${aircraft.is_bao_stage}`} tone="accent" /> : null}
            </View>
          </View>

          {estimate && (
            <Card raised style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
              <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" }}>
                <Icon name="calculator-outline" color={colors.accentText} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="label" tone="tertiary">
                  Estimated for this trip
                </Text>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
                  <Text style={{ fontFamily: fonts.display, fontSize: 24, lineHeight: 30, color: colors.text }}>
                    {money(estimate.total, aircraft.currency ?? "USD")}
                  </Text>
                  <Text variant="caption" tone="secondary">
                    ~{estimate.hours.toFixed(1)} hrs {tripType === "round_trip" ? "total" : "flight"}
                  </Text>
                </View>
                <Text variant="caption" tone="tertiary">
                  {distanceNm?.toLocaleString()} nm. Final all-in price comes in your quote.
                </Text>
              </View>
            </Card>
          )}

          <Card padded={false} style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {specs.map((sp) => (
              <View key={sp.label} style={{ width: "33.33%", alignItems: "center", gap: 4, paddingVertical: space.md, paddingHorizontal: space.sm }}>
                <Icon name={sp.icon} size="sm" color={colors.accentText} />
                <Text variant="bodyStrong" numberOfLines={1} adjustsFontSizeToFit>
                  {sp.value}
                </Text>
                <Text variant="caption" tone="tertiary">
                  {sp.label}
                </Text>
              </View>
            ))}
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
            <AirportField
              label="From"
              icon="location-outline"
              value={origin}
              onChange={(v) => {
                setOrigin(v);
                setErrors((e) => ({ ...e, origin: "" }));
              }}
              placeholder="Departure airport"
              error={errors.origin || null}
            />
            <AirportField
              label="To"
              icon="navigate-outline"
              value={destination}
              onChange={(v) => {
                setDestination(v);
                setErrors((e) => ({ ...e, destination: "" }));
              }}
              placeholder="Destination airport"
              error={errors.destination || null}
            />
            <DateField
              label="Departure"
              value={departDate}
              minimumDate={startOfToday()}
              onChange={(d) => {
                setDepartDate(d);
                setErrors((e) => ({ ...e, departDate: "" }));
              }}
              error={errors.departDate || null}
            />
            {tripType === "round_trip" && (
              <DateField
                label="Return"
                value={returnDate}
                minimumDate={departDate ?? startOfToday()}
                onChange={(d) => {
                  setReturnDate(d);
                  setErrors((e) => ({ ...e, returnDate: "" }));
                }}
                error={errors.returnDate || null}
              />
            )}
            <Stepper
              label="Guests"
              icon="people-outline"
              value={guests}
              onChange={setGuests}
              min={1}
              max={maxGuests}
              unit={(n) => (n === 1 ? "1 guest" : `${n} guests`)}
              hint={aircraft.seats ? `This aircraft seats ${aircraft.seats}.` : undefined}
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
      </KeyboardAwareScrollView>
    </Screen>
  );
}
