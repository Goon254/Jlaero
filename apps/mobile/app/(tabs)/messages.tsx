import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { colors } from "@/lib/theme";
import { card } from "@/lib/styles";

type Row = {
  conversation_id: string;
  conversations: {
    id: string;
    booking_id: string | null;
    bookings: {
      status: string;
      aircraft: { name: string } | null;
      booking_legs: { position: number; origin: string; destination: string | null }[];
    } | null;
  };
};

export default function Messages() {
  const { session } = useSession();
  const [rows, setRows] = useState<(Row & { last?: string; unread: number })[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    setRefreshing(true);
    const { data } = await supabase
      .from("conversation_participants")
      .select(
        "conversation_id, conversations(id, booking_id, bookings(status, aircraft(name), booking_legs(position, origin, destination)))"
      )
      .eq("user_id", session.user.id);
    const base = (data as unknown as Row[]) ?? [];
    const ids = base.map((r) => r.conversation_id);
    const lastByConv = new Map<string, { body: string; created_at: string }>();
    const unread = new Map<string, number>();
    if (ids.length) {
      const { data: msgs } = await supabase
        .from("messages")
        .select("conversation_id, body, created_at, sender_id, read_at")
        .in("conversation_id", ids)
        .order("created_at", { ascending: false })
        .limit(300);
      for (const m of msgs ?? []) {
        if (!lastByConv.has(m.conversation_id)) lastByConv.set(m.conversation_id, m);
        if (m.sender_id !== session.user.id && !m.read_at) {
          unread.set(m.conversation_id, (unread.get(m.conversation_id) ?? 0) + 1);
        }
      }
    }
    setRows(
      base
        .filter((r) => r.conversations)
        .map((r) => ({
          ...r,
          last: lastByConv.get(r.conversation_id)?.body,
          unread: unread.get(r.conversation_id) ?? 0,
        }))
        .sort((a, b) => {
          const la = lastByConv.get(a.conversation_id)?.created_at ?? "";
          const lb = lastByConv.get(b.conversation_id)?.created_at ?? "";
          return lb.localeCompare(la);
        })
    );
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
        keyExtractor={(r) => r.conversation_id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.gold} />}
        ListEmptyComponent={
          <Text style={{ color: colors.textFaint, textAlign: "center", marginTop: 60 }}>
            Conversations start when a booking request is made.
          </Text>
        }
        renderItem={({ item }) => {
          const c = item.conversations;
          const legs = [...(c.bookings?.booking_legs ?? [])].sort((a, b) => a.position - b.position);
          const title = legs.length
            ? `${legs[0]!.origin} → ${legs[legs.length - 1]!.destination ?? legs[0]!.destination ?? ""}`
            : "Conversation";
          return (
            <Pressable
              onPress={() =>
                c.booking_id
                  ? router.push(`/booking/${c.booking_id}`)
                  : router.push(`/conversation/${c.id}`)
              }
              style={card}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={{ color: colors.text, fontWeight: "700" }} numberOfLines={1}>
                    {title}
                    {c.bookings?.aircraft?.name ? `  ·  ${c.bookings.aircraft.name}` : ""}
                  </Text>
                  <Text style={{ color: colors.textDim, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
                    {item.last ?? "No messages yet"}
                  </Text>
                </View>
                {item.unread > 0 && (
                  <View style={{ backgroundColor: colors.gold, borderRadius: 999, minWidth: 22, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Text style={{ color: colors.ink, fontWeight: "700", textAlign: "center", fontSize: 12 }}>
                      {item.unread}
                    </Text>
                  </View>
                )}
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}
