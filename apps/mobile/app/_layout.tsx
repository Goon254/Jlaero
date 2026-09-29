import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SessionProvider } from "@/lib/session";
import { ThemeProvider, fonts, useTheme } from "@/lib/theme";
import { useAppFonts } from "@/lib/fonts";

SplashScreen.preventAutoHideAsync().catch(() => {});

function Navigation() {
  const { colors, scheme } = useTheme();
  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerShadowVisible: false,
          headerTintColor: colors.text,
          headerTitleStyle: { fontFamily: fonts.sansSemiBold, fontSize: 17, color: colors.text },
          headerBackButtonDisplayMode: "minimal",
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="search" options={{ headerShown: false }} />
        <Stack.Screen name="aircraft/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="booking/[id]" options={{ title: "Booking" }} />
        <Stack.Screen name="conversation/[id]" options={{ title: "Conversation" }} />
        <Stack.Screen name="settings/notifications" options={{ title: "Notifications" }} />
        <Stack.Screen name="settings/payments" options={{ title: "Payments" }} />
        <Stack.Screen name="settings/privacy" options={{ title: "Privacy and data" }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useAppFonts();
  const ready = fontsLoaded || !!fontError;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <KeyboardProvider>
      <ThemeProvider>
        <SessionProvider>
          <Navigation />
        </SessionProvider>
      </ThemeProvider>
    </KeyboardProvider>
  );
}
