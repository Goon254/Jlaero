import { useCallback, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { shortDate } from "@/lib/format";
import { radius, space, useTheme } from "@/lib/theme";
import {
  Card,
  EmptyState,
  Icon,
  PressableCard,
  Screen,
  ScreenHeader,
  Skeleton,
  StatusPill,
  Text,
} from "@/components/ui";

type Row = {
  id: string;
  kind: string;
  status: string;
  buyer_id: string;
  created_at: string;
  aircraft: { name: string } | null;
  booking_legs: { position: number; origin: string; destination: string | null; depart_at: string | null }[];
};

function Route({ legs, kind }: { legs: Row["booking_legs"]; kind: string }) {
  const { colors } = useTheme();
  const first = legs[0];
  if (kind === "crew") {
    return (
      <Text variant="headline" numberOfLines={1}>
        Crew engagement at {first?.origin ?? ""}
      </Text>
    );
  }
  const roundTrip = legs.length > 1;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
      <Text variant="headline">{first?.origin ?? ""}</Text>
      <Icon name={roundTrip ? "swap-horizontal" : "arrow-forward"} size="sm" color={colors.accentText} />
      <Text variant="headline" numberOfLines={1} style={{ flexShrink: 1 }}>
        {first?.destination ?? ""}
      </Text>
    </View>
  );
}

export default function Bookings() {
  const { session } = useSession();
  const { colors } = useTheme();
  const [rows, setRows] = useState<Row[] | null>(null);
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
    <Screen>
      <FlatList
        data={rows ?? []}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: space.xxxl, gap: space.md }}
        ListHeaderComponent={<ScreenHeader eyebrow="Your itinerary" title="Trips" />}
        ListHeaderComponentStyle={{ marginHorizontal: -space.xl }}
        refreshControl={
          <RefreshControl refreshing={refreshing && rows !== null} onRefresh={load} tintColor={colors.accent} />
        }
        ListEmptyComponent={
          rows === null ? (
            <View style={{ gap: space.md }}>
              {[0, 1, 2].map((i) => (
                <Card key={i}>
                  <Skeleton width="55%" height={18} />
                  <Skeleton width="40%" height={13} style={{ marginTop: space.sm }} />
                </Card>
              ))}
            </View>
          ) : (
            <EmptyState
              icon="airplane-outline"
              title="No trips yet"
              body="Request a quote on any aircraft and it will appear here."
              actionLabel="Explore aircraft"
              onAction={() => router.push("/(tabs)")}
            />
          )
        }
        renderItem={({ item }) => {
          const legs = [...item.booking_legs].sort((a, b) => a.position - b.position);
          const first = legs[0];
          const isBuyer = item.buyer_id === session?.user.id;
          return (
            <PressableCard
              onPress={() => router.push(`/booking/${item.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`${item.aircraft?.name ?? "Booking"}, ${item.status.replace(/_/g, " ")}`}
            >
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space.md }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: radius.md,
                    backgroundColor: colors.accentSoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name={item.kind === "crew" ? "people-outline" : "airplane-outline"} color={colors.accentText} />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Route legs={legs} kind={item.kind} />
                  <Text variant="caption" tone="secondary" numberOfLines={1}>
                    {[item.aircraft?.name, shortDate(first?.depart_at), isBuyer ? null : "You are the operator"]
                      .filter(Boolean)
                      .join("  ·  ")}
                  </Text>
                </View>
              </View>
              <View
                style={{
                  marginTop: space.md,
                  paddingTop: space.md,
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <StatusPill status={item.status} />
                <Icon name="chevron-forward" size="sm" color={colors.textTertiary} />
              </View>
            </PressableCard>
          );
        }}
      />
    </Screen>
  );
}
