import { useState } from "react";
import { Linking, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { WEB_BASE_URL } from "@/lib/config";
import { fonts, space, useTheme } from "@/lib/theme";
import { Button, Input, Screen, Segmented, Text } from "@/components/ui";

type Mode = "signin" | "signup";

export default function Login() {
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signUp({ email: email.trim(), password });
    setBusy(false);
    if (error) setError(error.message);
    else router.replace("/(tabs)");
  }

  return (
    <Screen>
      <LinearGradient
        colors={
          scheme === "dark"
            ? ["#152038", colors.bg, colors.bg]
            : ["#fff9ea", colors.bg, colors.bg]
        }
        style={{ position: "absolute", left: 0, right: 0, top: 0, height: 420 }}
      />
        <KeyboardAwareScrollView
          bottomOffset={24}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            paddingHorizontal: space.xxl,
            paddingTop: insets.top + space.xxxl,
            paddingBottom: insets.bottom + space.xxl,
          }}
        >
          <View style={{ alignItems: "center", marginBottom: space.xxxl }}>
            <Text
              accessibilityRole="header"
              style={{
                fontFamily: fonts.display,
                fontSize: 46,
                lineHeight: 54,
                letterSpacing: -1,
                color: colors.text,
              }}
            >
              Jlaero
            </Text>
            <View style={{ width: 36, height: 2, backgroundColor: colors.accent, marginVertical: space.md }} />
            <Text
              style={{
                fontFamily: fonts.displayItalic,
                fontSize: 18,
                lineHeight: 24,
                color: colors.textSecondary,
              }}
            >
              Private aviation, on demand
            </Text>
          </View>

          <Segmented<Mode>
            value={mode}
            onChange={(m) => {
              setMode(m);
              setError(null);
            }}
            options={[
              { value: "signin", label: "Sign in" },
              { value: "signup", label: "Create account" },
            ]}
            style={{ marginBottom: space.xxl }}
          />

          <View style={{ gap: space.lg }}>
            <Input
              label="Email"
              icon="mail-outline"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
            />
            <Input
              label="Password"
              icon="lock-closed-outline"
              value={password}
              onChangeText={setPassword}
              placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
              secureTextEntry
              secureToggle
              autoComplete={mode === "signup" ? "new-password" : "password"}
              textContentType={mode === "signup" ? "newPassword" : "password"}
              returnKeyType="go"
              onSubmitEditing={submit}
              error={error}
            />
          </View>

          <Button
            title={mode === "signin" ? "Sign in" : "Create account"}
            onPress={submit}
            loading={busy}
            size="lg"
            iconRight="arrow-forward"
            style={{ marginTop: space.xxl }}
          />

          <Text variant="caption" tone="tertiary" align="center" style={{ marginTop: space.xl }}>
            By continuing you agree to our{" "}
            <Text
              variant="caption"
              tone="accent"
              onPress={() => Linking.openURL(`${WEB_BASE_URL}/terms`)}
              accessibilityRole="link"
            >
              Terms
            </Text>{" "}
            and{" "}
            <Text
              variant="caption"
              tone="accent"
              onPress={() => Linking.openURL(`${WEB_BASE_URL}/privacy`)}
              accessibilityRole="link"
            >
              Privacy Policy
            </Text>
            .
          </Text>
        </KeyboardAwareScrollView>
    </Screen>
  );
}
