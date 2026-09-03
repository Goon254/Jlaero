import { useEffect, useRef, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { colors } from "@/lib/theme";
import { field } from "@/lib/styles";

export type ChatMessage = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export function Chat({
  conversationId,
  meId,
}: {
  conversationId: string;
  meId: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
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
      setMessages((prev) =>
        prev.some((x) => x.id === data.id) ? prev : [...prev, data as ChatMessage]
      );
    }
  }

  return (
    <View style={{ height: 360, borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.inkSoft }}>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 12, gap: 8 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          const mine = item.sender_id === meId;
          return (
            <View style={{ alignItems: mine ? "flex-end" : "flex-start" }}>
              <View
                style={{
                  maxWidth: "82%",
                  borderRadius: 14,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  backgroundColor: mine ? colors.gold : "#2b3752",
                }}
              >
                <Text style={{ color: mine ? colors.ink : colors.text }}>{item.body}</Text>
              </View>
            </View>
          );
        }}
      />
      <View style={{ flexDirection: "row", gap: 8, padding: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Write a message…"
          placeholderTextColor={colors.textFaint}
          style={[field, { flex: 1, borderRadius: 999, paddingVertical: 9 }]}
        />
        <Pressable
          onPress={send}
          style={{ backgroundColor: colors.gold, borderRadius: 999, paddingHorizontal: 16, justifyContent: "center" }}
        >
          <Text style={{ color: colors.ink, fontWeight: "700" }}>Send</Text>
        </Pressable>
      </View>
    </View>
  );
}
