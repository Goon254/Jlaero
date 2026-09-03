import { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { supabase } from "@/lib/supabase";
import { requestCharter } from "@/lib/booking";
import { colors, publicPhotoUrl } from "@/lib/theme";
import { field, button, buttonText, card } from "@/lib/styles";

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

export default function AircraftDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [aircraft, setAircraft] = useState<Aircraft | null>(null);
  const [tripType, setTripType] = useState<"one_way" | "round_trip">("one_way");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [departDate, setDepartDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [pax, setPax] = useState("");
  const [busy, setBusy] = useState(false);

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
      Alert.alert("Missing details", "Route, departure date, and passengers are required.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(departDate)) {
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

  if (!aircraft) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.ink, justifyContent: "center" }}>
        <Text style={{ color: colors.textFaint, textAlign: "center" }}>Loading…</Text>
      </View>
    );
  }

  const photos = [...aircraft.aircraft_photos].sort((a, b) => a.position - b.position);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.ink }} contentContainerStyle={{ padding: 16, gap: 14 }}>
      {photos[0] && (
        <Image
          source={{ uri: publicPhotoUrl("aircraft-photos", photos[0].file_path) }}
          style={{ width: "100%", height: 210, borderRadius: 16 }}
          resizeMode="cover"
        />
      )}
      <View>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: "700" }}>{aircraft.name}</Text>
        <Text style={{ color: colors.textDim, marginTop: 4 }}>
          {[aircraft.year, aircraft.manufacturer, aircraft.model].filter(Boolean).join(" ")}
          {aircraft.seats ? ` · ${aircraft.seats} seats` : ""}
          {aircraft.home_base ? ` · ${aircraft.home_base}` : ""}
        </Text>
        {aircraft.hourly_rate && (
          <Text style={{ color: colors.gold, fontSize: 18, fontWeight: "700", marginTop: 6 }}>
            ${Number(aircraft.hourly_rate).toLocaleString()}/hr
          </Text>
        )}
      </View>

      {aircraft.description && (
        <Text style={{ color: colors.textDim, lineHeight: 20 }}>{aircraft.description}</Text>
      )}

      <View style={card}>
        <Text style={{ color: colors.text, fontWeight: "700", marginBottom: 10 }}>
          Request this aircraft
        </Text>
        <View style={{ flexDirection: "row", borderWidth: 1, borderColor: colors.border, borderRadius: 999, padding: 3, marginBottom: 10 }}>
          {(["one_way", "round_trip"] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => setTripType(t)}
              style={{ flex: 1, paddingVertical: 8, borderRadius: 999, backgroundColor: tripType === t ? colors.gold : "transparent" }}
            >
              <Text style={{ textAlign: "center", fontWeight: "600", color: tripType === t ? colors.ink : colors.textDim }}>
                {t === "one_way" ? "One way" : "Round trip"}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput value={origin} onChangeText={setOrigin} placeholder="From (code)" placeholderTextColor={colors.textFaint} autoCapitalize="characters" style={[field, { flex: 1 }]} />
            <TextInput value={destination} onChangeText={setDestination} placeholder="To (code)" placeholderTextColor={colors.textFaint} autoCapitalize="characters" style={[field, { flex: 1 }]} />
          </View>
          <TextInput value={departDate} onChangeText={setDepartDate} placeholder="Departure date (YYYY-MM-DD)" placeholderTextColor={colors.textFaint} style={field} />
          {tripType === "round_trip" && (
            <TextInput value={returnDate} onChangeText={setReturnDate} placeholder="Return date (YYYY-MM-DD)" placeholderTextColor={colors.textFaint} style={field} />
          )}
          <TextInput value={pax} onChangeText={setPax} placeholder="Passengers" placeholderTextColor={colors.textFaint} keyboardType="number-pad" style={field} />
        </View>
        <Pressable onPress={submit} disabled={busy} style={[button, { marginTop: 12, opacity: busy ? 0.6 : 1 }]}>
          <Text style={buttonText}>{busy ? "Sending…" : "Request quote"}</Text>
        </Pressable>
        <Text style={{ color: colors.textFaint, fontSize: 11, textAlign: "center", marginTop: 8 }}>
          The operator responds with an itemized quote. No payment yet.
        </Text>
      </View>
    </ScrollView>
  );
}
