import { useCallback, useState } from "react";
import { Alert, Linking, ScrollView, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { acceptQuote, cancelBooking } from "@/lib/booking";
import { WEB_BASE_URL } from "@/lib/config";
import { dateTime, money } from "@/lib/format";
import { fonts, radius, space, useTheme } from "@/lib/theme";
import { Avatar, Button, Card, Icon, Pill, PressableCard, Screen, SectionTitle, Skeleton, StatusPill, Text } from "@/components/ui";
import { initials, relativeTime } from "@/lib/format";

type Booking = {
  id: string;
  kind: string;
  status: string;
  buyer_id: string;
  provider_id: string;
  currency: string | null;
  aircraft: { name: string } | null;
  booking_legs: {
    id: string;
    position: number;
    origin: string;
    destination: string | null;
    depart_at: string | null;
    passengers: number | null;
  }[];
};

type Quote = {
  id: string;
  version: number;
  status: string;
  total: number;
  expires_at: string | null;
  notes: string | null;
  quote_line_items: { kind: string; description: string | null; amount: number; position: number }[];
};

function Leg({
  origin,
  destination,
  when,
  pax,
  last,
  crew,
  index,
}: {
  origin: string;
  destination: string | null;
  when: string | null;
  pax: number | null;
  last: boolean;
  crew: boolean;
  index: number;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: space.md }}>
      <View style={{ alignItems: "center", width: 16 }}>
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: colors.accent,
            marginTop: 6,
          }}
        />
        {!last && <View style={{ flex: 1, width: 1, backgroundColor: colors.borderStrong, marginVertical: 4 }} />}
      </View>
      <View style={{ flex: 1, paddingBottom: last ? 0 : space.lg }}>
        {crew ? (
          <Text variant="bodyStrong">
            {index === 0 ? "Starts" : "Ends"} at {origin}
          </Text>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            <Text variant="bodyStrong">{origin}</Text>
            <Icon name="arrow-forward" size={14} color={colors.accentText} />
            <Text variant="bodyStrong">{destination ?? ""}</Text>
          </View>
        )}
        <Text variant="caption" tone="secondary" style={{ marginTop: 2 }}>
          {[when ? `${dateTime(when)} UTC` : null, pax ? `${pax} guests` : null].filter(Boolean).join("  ·  ")}
        </Text>
      </View>
    </View>
  );
}

export default function BookingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState<{ body: string; created_at: string; mine: boolean } | null>(null);
  const [unread, setUnread] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [{ data: b }, { data: q }, { data: c }] = await Promise.all([
      supabase
        .from("bookings")
        .select(
          "id, kind, status, buyer_id, provider_id, currency, aircraft(name), booking_legs(id, position, origin, destination, depart_at, passengers)"
        )
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("quotes")
        .select("id, version, status, total, expires_at, notes, quote_line_items(kind, description, amount, position)")
        .eq("booking_id", id)
        .order("version", { ascending: false })
        .limit(1),
      supabase.from("conversations").select("id").eq("booking_id", id).maybeSingle(),
    ]);
    setBooking(b as unknown as Booking | null);
    setQuote((q?.[0] as Quote | undefined) ?? null);
    setConversationId(c?.id ?? null);
    if (c?.id) {
      const { data: msgs } = await supabase
        .from("messages")
        .select("body, created_at, sender_id, read_at")
        .eq("conversation_id", c.id)
        .order("created_at", { ascending: false })
        .limit(50);
      const me = (await supabase.auth.getUser()).data.user?.id;
      const last = msgs?.[0];
      setLastMessage(last ? { body: last.body, created_at: last.created_at, mine: last.sender_id === me } : null);
      setUnread((msgs ?? []).filter((m) => m.sender_id !== me && !m.read_at).length);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!booking || !session) {
    return (
      <Screen style={{ padding: space.xl, gap: space.lg }}>
        <Skeleton width="65%" height={30} />
        <Card>
          <Skeleton width="50%" height={16} />
          <Skeleton width="80%" height={13} style={{ marginTop: space.sm }} />
        </Card>
        <Card>
          <Skeleton width="40%" height={16} />
          <Skeleton width="100%" height={13} style={{ marginTop: space.sm }} />
          <Skeleton width="100%" height={13} style={{ marginTop: space.sm }} />
        </Card>
      </Screen>
    );
  }

  const meId = session.user.id;
  const role = booking.buyer_id === meId ? "buyer" : "provider";
  const legs = [...booking.booking_legs].sort((a, b) => a.position - b.position);
  const currency = booking.currency ?? "USD";
  const canAccept = role === "buyer" && quote?.status === "sent" && ["quoted", "negotiating"].includes(booking.status);
  const webStep = ["accepted", "contract_signed", "deposit_paid"].includes(booking.status);
  const canCancel = ["requested", "quoted", "negotiating", "accepted", "contract_signed"].includes(booking.status);
  const title = booking.aircraft?.name ?? (booking.kind === "crew" ? "Crew engagement" : "Charter");

  async function onAccept() {
    setBusy(true);
    const res = await acceptQuote(booking!.id, quote!.id);
    setBusy(false);
    if (res.error) Alert.alert("Could not accept", res.error);
    else load();
  }

  function onCancel() {
    Alert.alert("Cancel this booking?", "This cannot be undone.", [
      { text: "Keep it", style: "cancel" },
      {
        text: "Cancel booking",
        style: "destructive",
        onPress: async () => {
          const res = await cancelBooking(booking!.id, role);
          if (res.error) Alert.alert("Failed", res.error);
          else load();
        },
      },
    ]);
  }

  return (
    <Screen>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: space.xl, paddingBottom: insets.bottom + space.xxxl, gap: space.xl }}
      >
        <View style={{ gap: space.sm }}>
          <Text variant="label" tone="accent">
            {booking.kind === "crew" ? "Crew" : "Charter"}
            {role === "provider" ? "  ·  You are the operator" : ""}
          </Text>
          <Text variant="display" accessibilityRole="header">
            {title}
          </Text>
          <View style={{ flexDirection: "row" }}>
            <StatusPill status={booking.status} />
          </View>
        </View>

        <View>
          <SectionTitle title="Itinerary" />
          <Card>
            {legs.map((l, i) => (
              <Leg
                key={l.id}
                index={i}
                origin={l.origin}
                destination={l.destination}
                when={l.depart_at}
                pax={l.passengers}
                last={i === legs.length - 1}
                crew={booking.kind === "crew"}
              />
            ))}
          </Card>
        </View>

        {quote && (
          <View>
            <SectionTitle
              title={`Quote v${quote.version}`}
              action={<Pill label={quote.status} tone={quote.status === "sent" ? "info" : quote.status === "accepted" ? "success" : "neutral"} />}
            />
            <Card raised>
              {[...quote.quote_line_items]
                .sort((a, b) => a.position - b.position)
                .map((li, i) => (
                  <View
                    key={i}
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      paddingVertical: space.sm,
                      gap: space.md,
                    }}
                  >
                    <Text variant="body" tone="secondary" style={{ flex: 1 }} numberOfLines={2}>
                      {li.description || li.kind.replace(/_/g, " ")}
                    </Text>
                    <Text variant="body">
                      {Number(li.amount) < 0 ? "- " : ""}
                      {money(Math.abs(Number(li.amount)), currency)}
                    </Text>
                  </View>
                ))}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginTop: space.md,
                  paddingTop: space.md,
                  borderTopWidth: 1,
                  borderTopColor: colors.borderStrong,
                }}
              >
                <Text variant="subhead">Total</Text>
                <Text style={{ fontFamily: fonts.display, fontSize: 24, lineHeight: 30, color: colors.text }}>
                  {money(quote.total, currency)}
                </Text>
              </View>
              {quote.expires_at && quote.status === "sent" && (
                <Text variant="caption" tone="tertiary" style={{ marginTop: space.xs }}>
                  Valid until {dateTime(quote.expires_at)} UTC
                </Text>
              )}
              {quote.notes ? (
                <View
                  style={{
                    marginTop: space.md,
                    padding: space.md,
                    borderRadius: radius.sm,
                    backgroundColor: colors.surfaceSunken,
                  }}
                >
                  <Text variant="caption" tone="secondary">
                    {quote.notes}
                  </Text>
                </View>
              ) : null}
              {canAccept && (
                <Button
                  title={`Accept quote  ·  ${money(quote.total, currency)}`}
                  variant="success"
                  icon="checkmark-circle"
                  onPress={onAccept}
                  loading={busy}
                  size="lg"
                  style={{ marginTop: space.lg }}
                />
              )}
            </Card>
          </View>
        )}

        {webStep && role === "buyer" && (
          <Button
            title={booking.status === "accepted" ? "Sign agreement and pay" : "Continue payment"}
            iconRight="open-outline"
            size="lg"
            onPress={() => Linking.openURL(`${WEB_BASE_URL}/bookings/${booking.id}`)}
          />
        )}
        {role === "provider" && ["requested", "quoted", "negotiating"].includes(booking.status) && (
          <Button
            title={quote ? "Revise quote" : "Send a quote"}
            iconRight="open-outline"
            size="lg"
            onPress={() => Linking.openURL(`${WEB_BASE_URL}/bookings/${booking.id}`)}
          />
        )}

        {conversationId && (
          <View>
            <SectionTitle title="Messages" />
            <PressableCard
              onPress={() =>
                router.push({ pathname: "/conversation/[id]", params: { id: conversationId, title } })
              }
              accessibilityRole="button"
              accessibilityLabel={`Open conversation${unread ? `, ${unread} unread` : ""}`}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
                <Avatar label={initials(booking.aircraft?.name, "J")} />
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                    <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                      {role === "buyer" ? "Operator" : "Traveler"}
                    </Text>
                    {lastMessage && (
                      <Text variant="caption" tone="tertiary">
                        {relativeTime(lastMessage.created_at)}
                      </Text>
                    )}
                  </View>
                  <Text variant="caption" tone={unread ? "primary" : "secondary"} numberOfLines={1}>
                    {lastMessage ? `${lastMessage.mine ? "You: " : ""}${lastMessage.body}` : "No messages yet. Say hello."}
                  </Text>
                </View>
                {unread > 0 ? (
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
                      {unread}
                    </Text>
                  </View>
                ) : (
                  <Icon name="chevron-forward" size="sm" color={colors.textTertiary} />
                )}
              </View>
            </PressableCard>
          </View>
        )}

        {canCancel && <Button title="Cancel booking" variant="danger" onPress={onCancel} />}
      </ScrollView>
    </Screen>
  );
}
