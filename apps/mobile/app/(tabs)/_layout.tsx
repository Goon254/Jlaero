import { Redirect, Tabs } from "expo-router";
import { Platform, type ColorValue } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSession } from "@/lib/session";
import { fonts, useTheme } from "@/lib/theme";
import { Screen } from "@/components/ui";

type Glyph = React.ComponentProps<typeof Ionicons>["name"];

function tabIcon(outline: Glyph, filled: Glyph) {
  return ({ focused, color }: { focused: boolean; color: ColorValue }) => (
    <Ionicons name={focused ? filled : outline} size={24} color={color} />
  );
}

export default function TabsLayout() {
  const { session, loading } = useSession();
  const { colors } = useTheme();
  if (loading) return <Screen />;
  if (!session) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 84 : 68,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontFamily: fonts.sansMedium, fontSize: 11, marginTop: 2 },
        tabBarActiveTintColor: colors.accentText,
        tabBarInactiveTintColor: colors.textTertiary,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Book", tabBarIcon: tabIcon("search-outline", "search") }}
      />
      <Tabs.Screen
        name="bookings"
        options={{ title: "Trips", tabBarIcon: tabIcon("ticket-outline", "ticket") }}
      />
      <Tabs.Screen
        name="messages"
        options={{ title: "Messages", tabBarIcon: tabIcon("chatbubbles-outline", "chatbubbles") }}
      />
      <Tabs.Screen
        name="account"
        options={{ title: "Account", tabBarIcon: tabIcon("person-outline", "person") }}
      />
    </Tabs>
  );
}
