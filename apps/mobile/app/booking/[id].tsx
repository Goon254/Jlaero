import { useCallback, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { acceptQuote, cancelBooking } from "@/lib/booking";
import { WEB_BASE_URL } from "@/lib/config";
import { colors, statusColors } from "@/lib/theme";
import { button, buttonText, card } from "@/lib/styles";
import { Chat } from "@/components/Chat";

type Booking = {
  id: string;
  kind: string;
  status: string;
  buyer_id: string;
  provider_id: string;
  aircraft: { name: string } | null;
  booking_legs: { id: string; position: number; origin: string; destination: string | null; depart_at: string | null; passengers: number | null }[];
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

export default function BookingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [{ data: b }, { data: q }, { data: c }] = await Promise.all([
      supabase
        .from("bookings")
        .select(
          "id, kind, status, buyer_id, provider_id, aircraft(name), booking_legs(id, position, origin, destination, depart_at, passengers)"
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
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!booking || !session) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.ink, justifyContent: "center" }}>
        <Text style={{ color: colors.textFaint, textAlign: "center" }}>Loading…</Text>
      </View>
    );
  }

  const meId = session.user.id;
  const role = booking.buyer_id === meId ? "buyer" : "provider";
  const legs = [...booking.booking_legs].sort((a, b) => a.position - b.position);
  const canAccept =
    role === "buyer" &&
    quote?.status === "sent" &&
    ["quoted", "negotiating"].includes(booking.status);
  const webStep = ["accepted", "contract_signed", "deposit_paid"].includes(booking.status);
  const canCancel = [
    "requested", "quoted", "negotiating", "accepted", "contract_signed",
  ].includes(booking.status);

  async function onAccept() {
    setBusy(true);
    const res = await acceptQuote(booking!.id, quote!.id);
    setBusy(false);
    if (res.error) Alert.alert("Could not accept", res.error);
    else load();
  }

  function onCancel() {
    Alert.alert("Cancel booking?", "This cannot be undone.", [
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
    <ScrollView style={{ flex: 1, backgroundColor: colors.ink }} contentContainerStyle={{ padding: 16, gap: 14 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: "700", flex: 1 }} numberOfLines={1}>
          {booking.aircraft?.name ?? (booking.kind === "crew" ? "Crew engagement" : "Charter")}
        </Text>
        <Text style={{ color: statusColors[booking.status] ?? colors.textDim, fontWeight: "700", textTransform: "capitalize" }}>
          {booking.status.replace(/_/g, " ")}
        </Text>
      </View>

      <View style={card}>
        <Text style={{ color: colors.text, fontWeight: "700", marginBottom: 6 }}>Itinerary</Text>
        {legs.map((l, i) => (
          <Text key={l.id} style={{ color: colors.textDim, marginTop: 2 }}>
            {booking.kind === "crew"
              ? `${i === 0 ? "Starts" : "Ends"} at ${l.origin}`
              : `${l.origin} → ${l.destination}`}
            {l.depart_at
              ? ` · ${new Date(l.depart_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" })} UTC`
              : ""}
            {l.passengers ? ` · ${l.passengers} pax` : ""}
          </Text>
        ))}
      </View>

      {quote && (
        <View style={card}>
          <Text style={{ color: colors.text, fontWeight: "700" }}>
            Quote v{quote.version} · {quote.status}
          </Text>
          {[...quote.quote_line_items]
            .sort((a, b) => a.position - b.position)
            .map((li, i) => (
              <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
                <Text style={{ color: colors.textDim, flex: 1, marginRight: 8 }} numberOfLines={1}>
                  {li.description || li.kind.replace(/_/g, " ")}
                </Text>
                <Text style={{ color: colors.text }}>
                  ${Math.abs(Number(li.amount)).toLocaleString()}
                </Text>
              </View>
            ))}
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 }}>
            <Text style={{ color: colors.text, fontWeight: "700" }}>Total</Text>
            <Text style={{ color: colors.gold, fontWeight: "700", fontSize: 16 }}>
              ${Number(quote.total).toLocaleString()}
            </Text>
          </View>
          {canAccept && (
            <Pressable onPress={onAccept} disabled={busy} style={[button, { marginTop: 12, backgroundColor: colors.green, opacity: busy ? 0.6 : 1 }]}>
              <Text style={[buttonText, { color: colors.ink }]}>
                Accept quote · ${Number(quote.total).toLocaleString()}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {webStep && role === "buyer" && (
        <Pressable
          onPress={() => Linking.openURL(`${WEB_BASE_URL}/bookings/${booking.id}`)}
          style={button}
        >
          <Text style={buttonText}>
            {booking.status === "accepted" ? "Sign agreement & pay on web" : "Continue payment on web"}
          </Text>
        </Pressable>
      )}
      {role === "provider" && ["requested", "quoted", "negotiating"].includes(booking.status) && (
        <Pressable
          onPress={() => Linking.openURL(`${WEB_BASE_URL}/bookings/${booking.id}`)}
          style={button}
        >
          <Text style={buttonText}>Send / revise quote on web</Text>
        </Pressable>
      )}

      {conversationId && (
        <View>
          <Text style={{ color: colors.text, fontWeight: "700", marginBottom: 8 }}>Messages</Text>
          <Chat conversationId={conversationId} meId={meId} />
        </View>
      )}

      {canCancel && (
        <Pressable onPress={onCancel} style={{ alignItems: "center", paddingVertical: 10 }}>
          <Text style={{ color: colors.red }}>Cancel booking</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}
