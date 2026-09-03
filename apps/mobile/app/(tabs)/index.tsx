import { useEffect, useState } from "react";
import {
  FlatList,
  Image,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { haversineNm } from "@jlaero/shared";
import { supabase } from "@/lib/supabase";
import { colors, publicPhotoUrl } from "@/lib/theme";
import { field, button, buttonText, card } from "@/lib/styles";

type Result = {
  id: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  seats: number | null;
  hourly_rate: number | null;
  home_base: string | null;
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

export default function Explore() {
  const [origin, setOrigin] = useState("");
  const [pax, setPax] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [busy, setBusy] = useState(false);
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
    if (origin && !originAirport) setNote(`Airport "${origin}" not found; showing all.`);
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
          haversineNm(
            originAirport.latitude,
            originAirport.longitude,
            base.latitude,
            base.longitude
          ) <= 250
        );
      });
    }

    setResults(
      rows.map((r) => {
        const cover = [...(r.aircraft_photos ?? [])].sort(
          (x, y) => x.position - y.position
        )[0];
        return {
          id: r.id,
          name: r.name,
          manufacturer: r.manufacturer,
          model: r.model,
          seats: r.seats,
          hourly_rate: r.hourly_rate,
          home_base: r.home_base,
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.ink, padding: 16 }}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TextInput
          value={origin}
          onChangeText={setOrigin}
          placeholder="From (TEB, LAX…)"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="characters"
          style={[field, { flex: 1 }]}
        />
        <TextInput
          value={pax}
          onChangeText={setPax}
          placeholder="Pax"
          placeholderTextColor={colors.textFaint}
          keyboardType="number-pad"
          style={[field, { width: 70 }]}
        />
        <Pressable onPress={search} disabled={busy} style={[button, { paddingHorizontal: 18, justifyContent: "center" }]}>
          <Text style={buttonText}>{busy ? "…" : "Go"}</Text>
        </Pressable>
      </View>
      {note && <Text style={{ color: colors.textDim, marginTop: 8 }}>{note}</Text>}

      <FlatList
        data={results}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ paddingVertical: 16, gap: 12 }}
        ListEmptyComponent={
          <Text style={{ color: colors.textFaint, textAlign: "center", marginTop: 40 }}>
            {busy ? "Searching…" : "No aircraft match yet."}
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/aircraft/${item.id}`)} style={[card, { padding: 0, overflow: "hidden" }]}>
            {item.cover && (
              <Image source={{ uri: item.cover }} style={{ width: "100%", height: 170 }} resizeMode="cover" />
            )}
            <View style={{ padding: 14 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: colors.text, fontWeight: "700", flex: 1 }} numberOfLines={1}>
                  {item.name}
                </Text>
                {item.hourly_rate && (
                  <Text style={{ color: colors.gold, fontWeight: "700" }}>
                    ${Number(item.hourly_rate).toLocaleString()}/hr
                  </Text>
                )}
              </View>
              <Text style={{ color: colors.textDim, marginTop: 3, fontSize: 13 }}>
                {[item.manufacturer, item.model].filter(Boolean).join(" ")}
                {item.seats ? ` · ${item.seats} seats` : ""}
                {item.home_base ? ` · ${item.home_base}` : ""}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}
