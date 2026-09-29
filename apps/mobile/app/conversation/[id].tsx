import { Stack, useLocalSearchParams } from "expo-router";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSession } from "@/lib/session";
import { Screen } from "@/components/ui";
import { Chat } from "@/components/Chat";

export default function Conversation() {
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const { session } = useSession();
  const insets = useSafeAreaInsets();
  if (!session) return <Screen />;
  return (
    <Screen>
      <Stack.Screen options={{ title: title || "Conversation" }} />
      <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={insets.top + 44} style={{ flex: 1 }}>
        <Chat conversationId={id!} meId={session.user.id} />
      </KeyboardAvoidingView>
    </Screen>
  );
}
