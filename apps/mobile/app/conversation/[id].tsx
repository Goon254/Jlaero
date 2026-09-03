import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSession } from "@/lib/session";
import { colors } from "@/lib/theme";
import { Chat } from "@/components/Chat";

export default function Conversation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  if (!session) return null;
  return (
    <View style={{ flex: 1, backgroundColor: colors.ink, padding: 16 }}>
      <Chat conversationId={id!} meId={session.user.id} />
    </View>
  );
}
