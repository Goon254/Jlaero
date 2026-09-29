import { useEffect, useRef, useState } from "react";
import { FlatList, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { fonts, radius, space, useTheme } from "@/lib/theme";
import { Icon, Pressable, Text } from "@/components/ui";

export type ChatMessage = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

function sameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  const y = new Date();
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

function clock(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function Chat({ conversationId, meId }: { conversationId: string; meId: string }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    supabase
      .from("messages")
      .select("id, sender_id, body, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at")
      .limit(200)
      .then(({ data }) => setMessages((data as ChatMessage[]) ?? []));

    const channel = supabase
      .channel(`m-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const m = payload.new as ChatMessage;
          setMessages((prev) => (prev?.some((x) => x.id === m.id) ? prev : [...(prev ?? []), m]));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  useEffect(() => {
    supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId)
      .neq("sender_id", meId)
      .is("read_at", null)
      .then(() => {});
  }, [conversationId, meId, messages?.length]);

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setDraft("");
    const { data, error } = await supabase
      .from("messages")
      .insert({ conversation_id: conversationId, sender_id: meId, body })
      .select("id, sender_id, body, created_at")
      .single();
    setSending(false);
    if (error) {
      setDraft(body);
      return;
    }
    if (data) {
      setMessages((prev) => (prev?.some((x) => x.id === data.id) ? prev : [...(prev ?? []), data as ChatMessage]));
    }
  }

  const canSend = draft.trim().length > 0 && !sending;
  const list = messages ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        ref={listRef}
        data={list}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingVertical: space.lg, flexGrow: 1, justifyContent: "flex-end" }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        ListEmptyComponent={
          messages === null ? null : (
            <View style={{ alignItems: "center", gap: space.md, paddingVertical: space.huge }}>
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: radius.full,
                  backgroundColor: colors.accentSoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="chatbubble-ellipses-outline" color={colors.accentText} />
              </View>
              <Text variant="headline" align="center">
                Start the conversation
              </Text>
              <Text variant="caption" tone="secondary" align="center" style={{ maxWidth: 260 }}>
                Ask about catering, ground transport, or timing. Only you and the operator can see this.
              </Text>
            </View>
          )
        }
        renderItem={({ item, index }) => {
          const mine = item.sender_id === meId;
          const prev = list[index - 1];
          const next = list[index + 1];
          const newDay = !prev || !sameDay(prev.created_at, item.created_at);
          const firstOfGroup = newDay || prev?.sender_id !== item.sender_id;
          const lastOfGroup = !next || next.sender_id !== item.sender_id || !sameDay(next.created_at, item.created_at);
          return (
            <View>
              {newDay && (
                <View style={{ alignItems: "center", marginVertical: space.md }}>
                  <Text variant="label" tone="tertiary">
                    {dayLabel(item.created_at)}
                  </Text>
                </View>
              )}
              <View
                accessibilityLabel={`${mine ? "You" : "Operator"}, ${clock(item.created_at)}: ${item.body}`}
                style={{ alignItems: mine ? "flex-end" : "flex-start", marginTop: firstOfGroup ? space.sm : 2 }}
              >
                <View
                  style={{
                    maxWidth: "80%",
                    borderRadius: 20,
                    borderTopRightRadius: mine && !firstOfGroup ? 6 : 20,
                    borderBottomRightRadius: mine && !lastOfGroup ? 6 : 20,
                    borderTopLeftRadius: !mine && !firstOfGroup ? 6 : 20,
                    borderBottomLeftRadius: !mine && !lastOfGroup ? 6 : 20,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    backgroundColor: mine ? colors.accent : colors.surfaceRaised,
                    borderWidth: mine ? 0 : 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text variant="body" style={{ color: mine ? colors.onAccent : colors.text }}>
                    {item.body}
                  </Text>
                </View>
                {lastOfGroup && (
                  <Text variant="caption" tone="tertiary" style={{ marginTop: 4, marginHorizontal: 6, fontSize: 11 }}>
                    {clock(item.created_at)}
                    {mine ? "  ·  Sent" : ""}
                  </Text>
                )}
              </View>
            </View>
          );
        }}
      />

      <View
        style={{
          paddingHorizontal: space.md,
          paddingTop: space.sm,
          paddingBottom: Math.max(insets.bottom, space.sm),
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.bg,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            paddingLeft: space.lg,
            paddingRight: 6,
            paddingVertical: 6,
            gap: space.sm,
          }}
        >
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Message the operator"
            placeholderTextColor={colors.textTertiary}
            selectionColor={colors.accent}
            multiline
            accessibilityLabel="Message"
            style={{
              flex: 1,
              minHeight: 36,
              maxHeight: 120,
              paddingTop: 8,
              paddingBottom: 8,
              color: colors.text,
              fontFamily: fonts.sans,
              fontSize: 16,
              lineHeight: 20,
            }}
          />
          <Pressable
            onPress={send}
            disabled={!canSend}
            haptic="light"
            pressScale={0.9}
            accessibilityRole="button"
            accessibilityLabel="Send message"
            accessibilityState={{ disabled: !canSend }}
            style={{
              width: 36,
              height: 36,
              borderRadius: radius.full,
              backgroundColor: canSend ? colors.accent : colors.surfaceSunken,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="arrow-up" size={20} color={canSend ? colors.onAccent : colors.textTertiary} />
          </Pressable>
        </View>
        <Text variant="caption" tone="tertiary" align="center" style={{ marginTop: 6, fontSize: 11 }}>
          Keep payments on Jlaero for buyer protection.
        </Text>
      </View>
    </View>
  );
}
