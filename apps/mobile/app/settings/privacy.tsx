import { useCallback, useState } from "react";
import { Alert, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { WEB_BASE_URL } from "@/lib/config";
import { shortDate } from "@/lib/format";
import { radius, space, useTheme } from "@/lib/theme";
import { Button, Card, Icon, Input, Pill, Screen, SectionTitle, Skeleton, Text } from "@/components/ui";

type DataRequest = { id: string; status: string; created_at: string };

export default function PrivacySettings() {
  const { session } = useSession();
  const { colors } = useTheme();
  const [request, setRequest] = useState<DataRequest | null | undefined>(undefined);
  const [requesting, setRequesting] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase
      .from("data_requests")
      .select("id, status, created_at")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setRequest((data as DataRequest | null) ?? null);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function requestData() {
    if (!session) return;
    setRequesting(true);
    const { error } = await supabase.from("data_requests").insert({ user_id: session.user.id, kind: "export" });
    setRequesting(false);
    if (error) {
      Alert.alert("Could not file request", error.code === "23505" ? "You already have a request in progress." : error.message);
      return;
    }
    Alert.alert("Request received", "We will email a copy of your data to your account address within 30 days.");
    load();
  }

  async function deleteAccount() {
    if (!session) return;
    if (confirm.trim() !== "DELETE") {
      setDeleteError("Type DELETE to confirm.");
      return;
    }
    setDeleteError(null);
    Alert.alert("Delete your account?", "This cannot be undone.", [
      { text: "Keep my account", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setDeleting(true);
          try {
            const res = await fetch(`${WEB_BASE_URL}/api/account/delete`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ confirm: "DELETE" }),
            });
            const json = (await res.json().catch(() => ({}))) as { error?: string };
            if (!res.ok) {
              setDeleteError(json.error ?? "Deletion failed. Please try again.");
              return;
            }
            await supabase.auth.signOut();
            router.replace("/login");
          } catch {
            setDeleteError("Network error. Please try again.");
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  }

  const pending = request?.status === "pending";

  return (
    <Screen>
      <KeyboardAwareScrollView
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: space.xl, gap: space.xxl, paddingBottom: space.huge }}
      >
        <View>
          <SectionTitle
            title="Your data"
            action={pending ? <Pill label="In progress" tone="info" /> : request?.status === "fulfilled" ? <Pill label="Sent" tone="success" /> : null}
          />
          <Card style={{ gap: space.lg }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: radius.md,
                  backgroundColor: colors.accentSoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="download-outline" color={colors.accentText} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">Request a copy of your data</Text>
                <Text variant="caption" tone="secondary">
                  Profile, bookings, quotes, and messages, emailed within 30 days.
                </Text>
              </View>
            </View>
            {request === undefined ? (
              <Skeleton width="60%" />
            ) : pending ? (
              <Text variant="caption" tone="tertiary">
                Requested {shortDate(request!.created_at)}. We will email you when it is ready.
              </Text>
            ) : (
              <Button title="Request my data" variant="secondary" onPress={requestData} loading={requesting} />
            )}
          </Card>
        </View>

        <View>
          <SectionTitle title="Delete account" />
          <Card style={{ gap: space.lg, borderColor: colors.dangerSoft }}>
            <Text variant="bodyStrong" tone="danger">
              This is permanent
            </Text>
            <View style={{ gap: space.sm }}>
              {[
                "Your profile is anonymized and your login is disabled.",
                "Uploaded verification documents are deleted.",
                "Completed bookings and reviews remain, anonymized, so the other party keeps their records.",
                "Active bookings must be completed or cancelled first.",
              ].map((line) => (
                <View key={line} style={{ flexDirection: "row", gap: space.sm }}>
                  <Icon name="remove" size={14} color={colors.textTertiary} style={{ marginTop: 4 }} />
                  <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
                    {line}
                  </Text>
                </View>
              ))}
            </View>
            <Input
              label="Type DELETE to confirm"
              value={confirm}
              onChangeText={(t) => {
                setConfirm(t);
                setDeleteError(null);
              }}
              placeholder="DELETE"
              autoCapitalize="characters"
              autoCorrect={false}
              error={deleteError}
            />
            <Button
              title="Delete my account"
              variant="danger"
              icon="trash-outline"
              onPress={deleteAccount}
              loading={deleting}
              disabled={confirm.trim() !== "DELETE"}
              style={{ borderColor: colors.danger }}
            />
          </Card>
        </View>
      </KeyboardAwareScrollView>
    </Screen>
  );
}
