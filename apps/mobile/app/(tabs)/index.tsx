import { useCallback, useState } from "react";
import { ScrollView, View, useWindowDimensions } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AirportChoice } from "@/lib/airports";
import { loadEmptyLegs, type EmptyLeg } from "@/lib/search";
import { money, shortDate } from "@/lib/format";
import { categoryLabel } from "@/lib/categories";
import { openWeb } from "@/lib/web";
import { fonts, radius, space, useTheme } from "@/lib/theme";
import {
  Button,
  Card,
  DateField,
  Icon,
  IconButton,
  Pressable,
  Screen,
  SectionTitle,
  Segmented,
  Skeleton,
  Stepper,
  Text,
  toDateOnly,
  type IconName,
} from "@/components/ui";
import { AirportPicker } from "@/components/AirportPicker";

type TripType = "one_way" | "round_trip";

function RouteRow({
  label,
  value,
  placeholder,
  onPress,
  icon,
}: {
  label: string;
  value: AirportChoice | null;
  placeholder: string;
  onPress: () => void;
  icon: IconName;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      pressScale={1}
      pressOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value?.label ?? "not set"}`}
      style={{ flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: 64 }}
    >
      <Icon name={icon} size="sm" color={value ? colors.accentText : colors.textTertiary} />
      <View style={{ flex: 1 }}>
        <Text variant="label" tone="tertiary">
          {label}
        </Text>
        <Text
          numberOfLines={1}
          style={{ fontFamily: value ? fonts.sansSemiBold : fonts.sans, fontSize: 17, lineHeight: 24, color: value ? colors.text : colors.textTertiary, marginTop: 2 }}
        >
          {value?.label ?? placeholder}
        </Text>
      </View>
    </Pressable>
  );
}

function DealCard({ leg, width }: { leg: EmptyLeg; width: number }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: "/aircraft/[id]",
          params: { id: leg.aircraft.id, origin: leg.origin, destination: leg.destination, date: leg.depart_at.slice(0, 10) },
        })
      }
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel={`Empty leg ${leg.origin} to ${leg.destination}, ${shortDate(leg.depart_at)}, ${money(leg.price)}`}
      style={{ width, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.surfaceSunken, height: 200 }}
    >
      {leg.aircraft.cover && (
        <Image source={{ uri: leg.aircraft.cover }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={250} />
      )}
      <LinearGradient
        colors={["rgba(5,8,15,0.05)", "rgba(5,8,15,0.85)"]}
        style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 130 }}
      />
      <View
        style={{
          position: "absolute",
          top: space.md,
          left: space.md,
          backgroundColor: "rgba(11,18,32,0.72)",
          borderRadius: radius.full,
          paddingHorizontal: 10,
          paddingVertical: 4,
          flexDirection: "row",
          alignItems: "center",
          gap: 5,
        }}
      >
        <Icon name="flash" size={12} color="#e4c877" />
        <Text variant="label" style={{ color: "#e4c877" }}>
          Empty leg
        </Text>
      </View>
      <View style={{ position: "absolute", left: space.md, right: space.md, bottom: space.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 20, lineHeight: 26, color: "#fff" }}>{leg.origin}</Text>
          <Icon name="arrow-forward" size={16} color="#e4c877" />
          <Text style={{ fontFamily: fonts.display, fontSize: 20, lineHeight: 26, color: "#fff" }}>{leg.destination}</Text>
        </View>
        <Text variant="caption" style={{ color: "#d9dde6", marginTop: 2 }} numberOfLines={1}>
          {shortDate(leg.depart_at)}  ·  {leg.aircraft.name || categoryLabel(leg.aircraft.category)}
        </Text>
        <Text style={{ fontFamily: fonts.sansSemiBold, fontSize: 15, color: "#e4c877", marginTop: 4 }}>
          {money(leg.price)}
          <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: "#d9dde6" }}>  whole aircraft</Text>
        </Text>
      </View>
    </Pressable>
  );
}

function Step({ n, icon, title, body }: { n: number; icon: IconName; title: string; body: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: space.md, alignItems: "flex-start" }}>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: radius.full,
          backgroundColor: colors.accentSoft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name={icon} size="sm" color={colors.accentText} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">
          {n}. {title}
        </Text>
        <Text variant="caption" tone="secondary" style={{ marginTop: 2 }}>
          {body}
        </Text>
      </View>
    </View>
  );
}

export default function Book() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [tripType, setTripType] = useState<TripType>("one_way");
  const [origin, setOrigin] = useState<AirportChoice | null>(null);
  const [destination, setDestination] = useState<AirportChoice | null>(null);
  const [date, setDate] = useState<Date | null>(null);
  const [returnDate, setReturnDate] = useState<Date | null>(null);
  const [guests, setGuests] = useState(2);
  const [picker, setPicker] = useState<"origin" | "destination" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [legs, setLegs] = useState<EmptyLeg[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadEmptyLegs().then(setLegs);
    }, [])
  );

  function swap() {
    setOrigin(destination);
    setDestination(origin);
  }

  function search() {
    if (!origin || !destination) {
      setError("Choose where you are flying from and to.");
      return;
    }
    if (origin.code === destination.code) {
      setError("Departure and arrival are the same airport.");
      return;
    }
    setError(null);
    router.push({
      pathname: "/search",
      params: {
        origin: origin.code,
        originLabel: origin.label,
        destination: destination.code,
        destinationLabel: destination.label,
        date: date ? toDateOnly(date) : "",
        returnDate: tripType === "round_trip" && returnDate ? toDateOnly(returnDate) : "",
        pax: String(guests),
      },
    });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dealWidth = Math.min(300, width - space.xl * 2 - 40);

  return (
    <Screen>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: space.huge }}>
        <View
          style={{
            paddingTop: insets.top + space.md,
            paddingHorizontal: space.xl,
            paddingBottom: space.lg,
            flexDirection: "row",
            alignItems: "flex-end",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flex: 1 }}>
            <Text variant="label" tone="accent" style={{ marginBottom: space.xs }}>
              Private charter
            </Text>
            <Text variant="display" accessibilityRole="header">
              Where to?
            </Text>
          </View>
          <IconButton icon="headset-outline" onPress={() => openWeb("/contact", { auth: false })} accessibilityLabel="Talk to a flight expert" />
        </View>

        <View style={{ paddingHorizontal: space.xl, gap: space.xxl }}>
          <Card raised style={{ gap: space.md }}>
            <View style={{ flexDirection: "row", gap: space.sm, alignItems: "center" }}>
              <Segmented<TripType>
                value={tripType}
                onChange={setTripType}
                options={[
                  { value: "one_way", label: "One way" },
                  { value: "round_trip", label: "Round trip" },
                ]}
                style={{ flex: 1 }}
              />
            </View>

            <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, position: "relative" }}>
              <RouteRow label="From" icon="location-outline" value={origin} placeholder="Departure airport" onPress={() => setPicker("origin")} />
              <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 50 }} />
              <RouteRow label="To" icon="navigate-outline" value={destination} placeholder="Arrival airport" onPress={() => setPicker("destination")} />
              <IconButton
                icon="swap-vertical"
                onPress={swap}
                accessibilityLabel="Swap departure and arrival"
                size={40}
                style={{ position: "absolute", right: space.md, top: 44 }}
              />
            </View>

            <DateField label="Departure" value={date} onChange={setDate} minimumDate={today} placeholder="Choose a date" />
            {tripType === "round_trip" && (
              <DateField label="Return" value={returnDate} onChange={setReturnDate} minimumDate={date ?? today} placeholder="Choose a date" />
            )}
            <Stepper
              label="Passengers"
              icon="people-outline"
              value={guests}
              onChange={setGuests}
              min={1}
              max={19}
              unit={(n) => (n === 1 ? "1 passenger" : `${n} passengers`)}
            />
            {error && (
              <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                <Icon name="alert-circle-outline" size={16} color={colors.danger} />
                <Text variant="caption" tone="danger" style={{ flex: 1 }}>
                  {error}
                </Text>
              </View>
            )}
            <Button title="Search aircraft" icon="search" size="lg" onPress={search} />
          </Card>

          <View>
            <SectionTitle
              title="Empty legs"
              action={
                <Text variant="caption" tone="tertiary">
                  Up to 75% off
                </Text>
              }
            />
            {legs === null ? (
              <View style={{ flexDirection: "row", gap: space.md }}>
                <Skeleton width={dealWidth} height={200} round={radius.lg} />
                <Skeleton width={80} height={200} round={radius.lg} />
              </View>
            ) : legs.length === 0 ? (
              <Card style={{ flexDirection: "row", gap: space.md, alignItems: "center" }}>
                <Icon name="flash-outline" color={colors.textTertiary} />
                <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
                  No empty legs right now. Operators post one-way repositioning flights here at a deep discount.
                </Text>
              </Card>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: space.md, paddingRight: space.xl }}
                style={{ marginHorizontal: -space.xl, paddingHorizontal: space.xl }}
              >
                {legs.map((l) => (
                  <DealCard key={l.id} leg={l} width={dealWidth} />
                ))}
              </ScrollView>
            )}
          </View>

          <View>
            <SectionTitle title="How it works" />
            <Card style={{ gap: space.lg }}>
              <Step n={1} icon="search-outline" title="Tell us the trip" body="Route, date, and passengers. See estimated prices across every cabin class instantly." />
              <Step n={2} icon="pricetags-outline" title="Get one final price" body="Our team confirms availability with vetted operators and sends an itemized quote. No hidden fees." />
              <Step n={3} icon="airplane-outline" title="Sign and fly" body="Accept in the app, sign the charter agreement, and pay securely. Your crew is briefed before you arrive." />
            </Card>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.md, justifyContent: "center", paddingHorizontal: space.md }}>
            {[
              { icon: "shield-checkmark-outline" as IconName, label: "ARGUS and Wyvern vetted" },
              { icon: "time-outline" as IconName, label: "Experts available 24/7" },
              { icon: "lock-closed-outline" as IconName, label: "Payments held by Stripe" },
            ].map((t) => (
              <View key={t.label} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Icon name={t.icon} size={15} color={colors.textTertiary} />
                <Text variant="caption" tone="tertiary">
                  {t.label}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <AirportPicker
        visible={picker !== null}
        title={picker === "origin" ? "Departure" : "Arrival"}
        onClose={() => setPicker(null)}
        onSelect={(c) => (picker === "origin" ? setOrigin(c) : setDestination(c))}
      />
    </Screen>
  );
}
