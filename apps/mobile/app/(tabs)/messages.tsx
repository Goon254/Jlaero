import { useCallback, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { initials, relativeTime } from "@/lib/format";
import { radius, space, useTheme } from "@/lib/theme";
import { Avatar, Card, EmptyState, Pressable, Screen, ScreenHeader, Skeleton, Text } from "@/components/ui";

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

type Item = Row & { last?: string; lastAt?: string; unread: number };

export default function Messages() {
  const { session } = useSession();
  const { colors } = useTheme();
  const [rows, setRows] = useState<Item[] | null>(null);
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
          lastAt: lastByConv.get(r.conversation_id)?.created_at,
          unread: unread.get(r.conversation_id) ?? 0,
        }))
        .sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""))
    );
    setRefreshing(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <Screen>
      <FlatList
        data={rows ?? []}
        keyExtractor={(r) => r.conversation_id}
        contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: space.xxxl }}
        ListHeaderComponent={<ScreenHeader eyebrow="Inbox" title="Messages" />}
        ListHeaderComponentStyle={{ marginHorizontal: -space.xl }}
        refreshControl={
          <RefreshControl refreshing={refreshing && rows !== null} onRefresh={load} tintColor={colors.accent} />
        }
        ListEmptyComponent={
          rows === null ? (
            <View style={{ gap: space.md }}>
              {[0, 1, 2].map((i) => (
                <Card key={i} style={{ flexDirection: "row", gap: space.md, alignItems: "center" }}>
                  <Skeleton width={44} height={44} round={radius.full} />
                  <View style={{ flex: 1, gap: space.sm }}>
                    <Skeleton width="60%" height={16} />
                    <Skeleton width="85%" height={13} />
                  </View>
                </Card>
              ))}
            </View>
          ) : (
            <EmptyState
              icon="chatbubble-ellipses-outline"
              title="Your inbox is quiet"
              body="Conversations open automatically when you request a quote."
            />
          )
        }
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 60 }} />}
        renderItem={({ item }) => {
          const c = item.conversations;
          const legs = [...(c.bookings?.booking_legs ?? [])].sort((a, b) => a.position - b.position);
          const route = legs.length
            ? `${legs[0]!.origin} to ${legs[legs.length - 1]!.destination ?? legs[0]!.destination ?? ""}`
            : "Conversation";
          const name = c.bookings?.aircraft?.name ?? route;
          const hasUnread = item.unread > 0;
          return (
            <Pressable
              onPress={() => (c.booking_id ? router.push(`/booking/${c.booking_id}`) : router.push(`/conversation/${c.id}`))}
              haptic="light"
              pressScale={1}
              pressOpacity={0.6}
              accessibilityRole="button"
              accessibilityLabel={`${name}, ${route}${hasUnread ? `, ${item.unread} unread` : ""}`}
              style={{ flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.lg }}
            >
              <Avatar label={initials(c.bookings?.aircraft?.name, "J")} />
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                  <Text variant={hasUnread ? "bodyStrong" : "body"} numberOfLines={1} style={{ flex: 1 }}>
                    {name}
                  </Text>
                  <Text variant="caption" tone="tertiary">
                    {relativeTime(item.lastAt)}
                  </Text>
                </View>
                <Text variant="caption" tone={hasUnread ? "primary" : "secondary"} numberOfLines={1}>
                  {c.bookings?.aircraft?.name ? `${route}  ·  ` : ""}
                  {item.last ?? "No messages yet"}
                </Text>
              </View>
              {hasUnread && (
                <View
                  style={{
                    minWidth: 22,
                    height: 22,
                    paddingHorizontal: 6,
                    borderRadius: radius.full,
                    backgroundColor: colors.accent,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text variant="captionStrong" style={{ color: colors.onAccent, fontSize: 12 }}>
                    {item.unread}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}
