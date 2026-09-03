import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { colors, statusColors } from "@/lib/theme";
import { card } from "@/lib/styles";

type Row = {
  id: string;
  kind: string;
  status: string;
  buyer_id: string;
  created_at: string;
  aircraft: { name: string } | null;
  booking_legs: { position: number; origin: string; destination: string | null; depart_at: string | null }[];
};

export default function Bookings() {
  const { session } = useSession();
  const [rows, setRows] = useState<Row[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    setRefreshing(true);
    const { data } = await supabase
      .from("bookings")
      .select(
        "id, kind, status, buyer_id, created_at, aircraft(name), booking_legs(position, origin, destination, depart_at)"
      )
      .or(`buyer_id.eq.${session.user.id},provider_id.eq.${session.user.id}`)
      .order("created_at", { ascending: false });
    setRows((data as unknown as Row[]) ?? []);
    setRefreshing(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.ink }}>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.gold} />}
        ListEmptyComponent={
          <Text style={{ color: colors.textFaint, textAlign: "center", marginTop: 60 }}>
            No bookings yet. Find a jet in Explore.
          </Text>
        }
        renderItem={({ item }) => {
          const legs = [...item.booking_legs].sort((a, b) => a.position - b.position);
          const first = legs[0];
          const route =
            item.kind === "crew"
              ? `Crew · ${first?.origin ?? ""}`
              : legs.length > 1
                ? `${first?.origin} ⇄ ${first?.destination}`
                : `${first?.origin ?? ""} → ${first?.destination ?? ""}`;
          return (
            <Pressable onPress={() => router.push(`/booking/${item.id}`)} style={card}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={{ color: colors.text, fontWeight: "700" }} numberOfLines={1}>
                    {route}
                  </Text>
                  <Text style={{ color: colors.textDim, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
                    {item.aircraft?.name ?? ""}
                    {first?.depart_at
                      ? ` · ${new Date(first.depart_at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`
                      : ""}
                  </Text>
                </View>
                <Text
                  style={{
                    color: statusColors[item.status] ?? colors.textDim,
                    fontSize: 12,
                    fontWeight: "600",
                    textTransform: "capitalize",
                  }}
                >
                  {item.status.replace(/_/g, " ")}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}
