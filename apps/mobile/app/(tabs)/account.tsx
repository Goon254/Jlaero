import { useCallback, useState } from "react";
import { Alert, Linking, ScrollView, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { WEB_BASE_URL } from "@/lib/config";
import { initials } from "@/lib/format";
import { space, useTheme, type ThemePreference } from "@/lib/theme";
import {
  Avatar,
  Button,
  Card,
  Icon,
  ListRow,
  Pill,
  Screen,
  ScreenHeader,
  SectionTitle,
  Segmented,
  Text,
} from "@/components/ui";

export default function Account() {
  const { session } = useSession();
  const { colors, preference, setPreference } = useTheme();
  const [profile, setProfile] = useState<{ full_name: string | null; verification: string } | null>(null);
  const [roles, setRoles] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!session) return;
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("full_name, verification").eq("id", session.user.id).maybeSingle(),
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

  function signOut() {
    Alert.alert("Sign out?", undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace("/login");
        },
      },
    ]);
  }

  const open = (path: string) => () => Linking.openURL(`${WEB_BASE_URL}${path}`);
  const verified = profile?.verification === "verified";
  const name = profile?.full_name ?? "Traveler";

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: space.huge, gap: space.xxl }}>
        <ScreenHeader title="Account" />

        <Card raised>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.lg }}>
            <Avatar label={initials(profile?.full_name, "T")} size={60} />
            <View style={{ flex: 1 }}>
              <Text variant="title" numberOfLines={1}>
                {name}
              </Text>
              <Text variant="caption" tone="secondary" numberOfLines={1}>
                {session?.user.email}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.lg }}>
            {(roles.length ? roles : ["traveler"]).map((r) => (
              <Pill key={r} label={r.replace(/_/g, " ")} tone="neutral" />
            ))}
            {verified && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Icon name="shield-checkmark" size={16} color={colors.success} />
                <Text variant="captionStrong" tone="success">
                  Verified
                </Text>
              </View>
            )}
          </View>
        </Card>

        <View>
          <SectionTitle title="Appearance" />
          <Segmented<ThemePreference>
            value={preference}
            onChange={setPreference}
            options={[
              { value: "system", label: "Auto", icon: "phone-portrait-outline" },
              { value: "light", label: "Light", icon: "sunny-outline" },
              { value: "dark", label: "Dark", icon: "moon-outline" },
            ]}
          />
        </View>

        {(roles.includes("owner") || roles.includes("crew")) && (
          <View>
            <SectionTitle title="Manage" />
            <Card padded={false}>
              {roles.includes("owner") && (
                <ListRow first icon="business-outline" label="My listings" detail="Opens on the web" external onPress={open("/owner")} />
              )}
              {roles.includes("crew") && (
                <ListRow
                  first={!roles.includes("owner")}
                  icon="ribbon-outline"
                  label="Crew profile"
                  detail="Opens on the web"
                  external
                  onPress={open("/crew/me")}
                />
              )}
            </Card>
          </View>
        )}

        <View>
          <SectionTitle title="Settings" />
          <Card padded={false}>
            <ListRow first icon="card-outline" label="Payments" detail="Cards and payouts" external onPress={open("/settings/payments")} />
            <ListRow icon="notifications-outline" label="Notifications" external onPress={open("/settings/notifications")} />
          </Card>
        </View>

        <View>
          <SectionTitle title="Support" />
          <Card padded={false}>
            <ListRow first icon="help-circle-outline" label="Help and FAQ" external onPress={open("/help")} />
            <ListRow icon="document-text-outline" label="Terms of Service" external onPress={open("/terms")} />
            <ListRow icon="lock-closed-outline" label="Privacy Policy" external onPress={open("/privacy")} />
            <ListRow
              icon="trash-outline"
              label="Delete account"
              danger
              onPress={() =>
                Alert.alert(
                  "Delete account",
                  "Deletion is confirmed on the web. Your profile is anonymized and login is disabled.",
                  [
                    { text: "Cancel", style: "cancel" },
                    { text: "Continue", style: "destructive", onPress: open("/settings/delete-account") },
                  ]
                )
              }
            />
          </Card>
        </View>

        <View style={{ gap: space.lg, alignItems: "center" }}>
          <Button title="Sign out" variant="secondary" icon="log-out-outline" onPress={signOut} style={{ alignSelf: "stretch" }} />
          <Text variant="caption" tone="tertiary">
            Jlaero 0.1.0
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}
