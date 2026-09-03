import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { colors } from "@/lib/theme";
import { field, button, buttonText } from "@/lib/styles";

export default function Login() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    const { error } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) setError(error.message);
    else router.replace("/(tabs)");
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: colors.ink, justifyContent: "center", padding: 24 }}
    >
      <Text style={{ fontSize: 34, fontWeight: "700", color: colors.text, textAlign: "center" }}>
        Jl<Text style={{ color: colors.gold }}>aero</Text>
      </Text>
      <Text style={{ color: colors.textDim, textAlign: "center", marginTop: 6, marginBottom: 28 }}>
        Private aviation, on demand
      </Text>

      <View style={{ flexDirection: "row", marginBottom: 18, borderWidth: 1, borderColor: colors.border, borderRadius: 999, padding: 3 }}>
        {(["signin", "signup"] as const).map((m) => (
          <Pressable
            key={m}
            onPress={() => setMode(m)}
            style={{
              flex: 1,
              paddingVertical: 9,
              borderRadius: 999,
              backgroundColor: mode === m ? colors.gold : "transparent",
            }}
          >
            <Text style={{ textAlign: "center", fontWeight: "600", color: mode === m ? colors.ink : colors.textDim }}>
              {m === "signin" ? "Sign in" : "Create account"}
            </Text>
          </Pressable>
        ))}
      </View>

      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        placeholderTextColor={colors.textFaint}
        autoCapitalize="none"
        keyboardType="email-address"
        style={field}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        placeholderTextColor={colors.textFaint}
        secureTextEntry
        style={[field, { marginTop: 10 }]}
      />
      {error && <Text style={{ color: colors.red, marginTop: 10 }}>{error}</Text>}
      <Pressable onPress={submit} disabled={busy} style={[button, { marginTop: 18, opacity: busy ? 0.6 : 1 }]}>
        <Text style={buttonText}>{busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}
