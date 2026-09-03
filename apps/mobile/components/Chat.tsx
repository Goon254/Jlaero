import { useEffect, useRef, useState } from "react";
import { FlatList, ScrollView, TextInput, View, type StyleProp, type ViewStyle } from "react-native";
import { supabase } from "@/lib/supabase";
import { relativeTime } from "@/lib/format";
import { fonts, radius, space, touchTarget, useTheme } from "@/lib/theme";
import { IconButton, Text } from "@/components/ui";

export type ChatMessage = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export function Chat({
  conversationId,
  meId,
  style,
  bare = false,
}: {
  conversationId: string;
  meId: string;
  style?: StyleProp<ViewStyle>;
  /** Render without the card border (full-screen conversation). */
  bare?: boolean;
}) {
  const { colors } = useTheme();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const listRef = useRef<FlatList>(null);
  const scrollRef = useRef<ScrollView>(null);

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
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
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
  }, [conversationId, meId, messages.length]);

  async function send() {
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    const { data } = await supabase
      .from("messages")
      .insert({ conversation_id: conversationId, sender_id: meId, body })
      .select("id, sender_id, body, created_at")
      .single();
    if (data) {
      setMessages((prev) => (prev.some((x) => x.id === data.id) ? prev : [...prev, data as ChatMessage]));
    }
  }

  const canSend = draft.trim().length > 0;

  const listStyle = { padding: space.lg, gap: space.sm, flexGrow: 1, justifyContent: "flex-end" as const };
  const empty = (
    <Text variant="caption" tone="tertiary" align="center" style={{ paddingVertical: space.xxl }}>
      Say hello. Messages are shared with the other party only.
    </Text>
  );

  function renderMessage(item: ChatMessage, index: number) {
    const mine = item.sender_id === meId;
    const prev = messages[index - 1];
    const grouped = prev?.sender_id === item.sender_id;
    return (
      <View
        style={{ alignItems: mine ? "flex-end" : "flex-start", marginTop: grouped ? -4 : 0 }}
        accessibilityLabel={`${mine ? "You" : "Them"}: ${item.body}`}
      >
        <View
          style={{
            maxWidth: "82%",
            borderRadius: 18,
            borderBottomRightRadius: mine ? 6 : 18,
            borderBottomLeftRadius: mine ? 18 : 6,
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
        {!grouped || index === messages.length - 1 ? (
          <Text variant="caption" tone="tertiary" style={{ marginTop: 3, fontSize: 11, marginHorizontal: 4 }}>
            {relativeTime(item.created_at)}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View
      style={[
        bare
          ? { backgroundColor: colors.bg }
          : {
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.lg,
              backgroundColor: colors.surface,
              overflow: "hidden",
            },
        style,
      ]}
    >
      {bare ? (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={listStyle}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={empty}
          renderItem={({ item, index }) => renderMessage(item, index)}
        />
      ) : (
        // Embedded in a parent ScrollView (booking screen): a nested
        // VirtualizedList would break windowing, so render a plain ScrollView.
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={listStyle}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          {messages.length === 0 ? empty : messages.map((m, i) => <View key={m.id}>{renderMessage(m, i)}</View>)}
        </ScrollView>
      )}
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          gap: space.sm,
          paddingHorizontal: space.md,
          paddingVertical: space.sm,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: bare ? colors.bg : colors.surface,
        }}
      >
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Write a message"
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.accent}
          multiline
          accessibilityLabel="Message"
          style={{
            flex: 1,
            minHeight: touchTarget - 4,
            maxHeight: 120,
            paddingHorizontal: space.lg,
            paddingTop: 12,
            paddingBottom: 12,
            borderRadius: radius.full,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceSunken,
            color: colors.text,
            fontFamily: fonts.sans,
            fontSize: 15,
          }}
        />
        <IconButton
          icon="arrow-up"
          variant={canSend ? "accent" : "surface"}
          onPress={send}
          accessibilityLabel="Send message"
          size={touchTarget - 4}
        />
      </View>
    </View>
  );
}
