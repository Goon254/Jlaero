import { useCallback, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { WEB_BASE_URL } from "@/lib/config";
import { colors } from "@/lib/theme";
import { card } from "@/lib/styles";

export default function Account() {
  const { session } = useSession();
  const [profile, setProfile] = useState<{
    full_name: string | null;
    verification: string;
  } | null>(null);
  const [roles, setRoles] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!session) return;
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, verification")
        .eq("id", session.user.id)
        .maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", session.user.id),
    ]);
    setProfile(p);
    setRoles((r ?? []).map((x) => x.role));
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const rows: { label: string; onPress: () => void; danger?: boolean }[] = [
    ...(roles.includes("owner")
      ? [{ label: "Manage listings (web)", onPress: () => Linking.openURL(`${WEB_BASE_URL}/owner`) }]
      : []),
    ...(roles.includes("crew")
      ? [{ label: "My crew profile (web)", onPress: () => Linking.openURL(`${WEB_BASE_URL}/crew/me`) }]
      : []),
    { label: "Payment settings (web)", onPress: () => Linking.openURL(`${WEB_BASE_URL}/settings/payments`) },
    { label: "Notification preferences (web)", onPress: () => Linking.openURL(`${WEB_BASE_URL}/settings/notifications`) },
    { label: "Help & FAQ", onPress: () => Linking.openURL(`${WEB_BASE_URL}/help`) },
    { label: "Terms of Service", onPress: () => Linking.openURL(`${WEB_BASE_URL}/terms`) },
    { label: "Privacy Policy", onPress: () => Linking.openURL(`${WEB_BASE_URL}/privacy`) },
    {
      label: "Delete account",
      danger: true,
      onPress: () =>
        Alert.alert(
          "Delete account",
          "Account deletion opens on the web where you can confirm. Your profile is anonymized and login disabled.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Continue", style: "destructive", onPress: () => Linking.openURL(`${WEB_BASE_URL}/settings/delete-account`) },
          ]
        ),
    },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.ink }} contentContainerStyle={{ padding: 16, gap: 14 }}>
      <View style={card}>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700" }}>
          {profile?.full_name ?? "Traveler"}
        </Text>
        <Text style={{ color: colors.textDim, marginTop: 2 }}>{session?.user.email}</Text>
        <Text style={{ color: colors.textFaint, marginTop: 6, fontSize: 13 }}>
          Roles: {roles.length ? roles.join(", ") : "traveler"}
          {profile?.verification === "verified" ? "  ·  ✓ verified" : ""}
        </Text>
      </View>

      <View style={[card, { padding: 0 }]}>
        {rows.map((r, i) => (
          <Pressable
            key={r.label}
            onPress={r.onPress}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 14,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: colors.border,
            }}
          >
            <Text style={{ color: r.danger ? colors.red : colors.text }}>{r.label}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable onPress={signOut} style={{ alignItems: "center", paddingVertical: 12 }}>
        <Text style={{ color: colors.textDim }}>Sign out</Text>
      </Pressable>
      <Text style={{ color: colors.textFaint, textAlign: "center", fontSize: 11 }}>
        Jlaero v0.1.0
      </Text>
    </ScrollView>
  );
}
