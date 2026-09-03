import { KeyboardAvoidingView, Platform } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSession } from "@/lib/session";
import { space } from "@/lib/theme";
import { Screen } from "@/components/ui";
import { Chat } from "@/components/Chat";

export default function Conversation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const insets = useSafeAreaInsets();
  // Native stack header: 44pt on iOS plus the status bar inset.
  const headerHeight = insets.top + 44;
  if (!session) return <Screen />;
  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={headerHeight}
        style={{ flex: 1 }}
      >
        <Chat
          conversationId={id!}
          meId={session.user.id}
          bare
          style={{ flex: 1, paddingBottom: insets.bottom > 0 ? insets.bottom - space.sm : 0 }}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}
