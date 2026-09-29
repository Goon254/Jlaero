import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { space, useTheme } from "@/lib/theme";
import { Card, Icon, Screen, SectionTitle, Skeleton, SwitchRow, Text } from "@/components/ui";

type Prefs = {
  push_bookings: boolean;
  push_messages: boolean;
  email_bookings: boolean;
  email_messages: boolean;
  email_marketing: boolean;
};

const DEFAULTS: Prefs = {
  push_bookings: true,
  push_messages: true,
  email_bookings: true,
  email_messages: true,
  email_marketing: false,
};

export default function NotificationSettings() {
  const { session } = useSession();
  const { colors } = useTheme();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!session) return;
    supabase
      .from("notification_preferences")
      .select("prefs")
      .eq("user_id", session.user.id)
      .maybeSingle()
      .then(({ data }) => setPrefs({ ...DEFAULTS, ...((data?.prefs as Partial<Prefs>) ?? {}) }));
  }, [session]);

  const update = useCallback(
    async (patch: Partial<Prefs>) => {
      if (!session || !prefs) return;
      const next = { ...prefs, ...patch };
      setPrefs(next);
      setState("saving");
      const { error } = await supabase
        .from("notification_preferences")
        .upsert({ user_id: session.user.id, prefs: next, updated_at: new Date().toISOString() });
      setState(error ? "error" : "saved");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setState("idle"), 1800);
    },
    [session, prefs]
  );

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.xxl, paddingBottom: space.huge }}>
        <Text variant="body" tone="secondary">
          Choose what reaches you and where. Notices required to complete a booking are always sent.
        </Text>

        {!prefs ? (
          <Card style={{ gap: space.lg }}>
            <Skeleton width="60%" />
            <Skeleton width="70%" />
            <Skeleton width="50%" />
          </Card>
        ) : (
          <>
            <View>
              <SectionTitle title="Push" />
              <Card padded={false}>
                <SwitchRow first label="Booking updates" detail="Quotes, acceptances, and status changes" value={prefs.push_bookings} onChange={(v) => update({ push_bookings: v })} />
                <SwitchRow label="New messages" value={prefs.push_messages} onChange={(v) => update({ push_messages: v })} />
              </Card>
            </View>
            <View>
              <SectionTitle title="Email" />
              <Card padded={false}>
                <SwitchRow first label="Booking updates" value={prefs.email_bookings} onChange={(v) => update({ email_bookings: v })} />
                <SwitchRow label="New messages" value={prefs.email_messages} onChange={(v) => update({ email_messages: v })} />
                <SwitchRow label="News and offers" detail="Occasional, never more than monthly" value={prefs.email_marketing} onChange={(v) => update({ email_marketing: v })} />
              </Card>
            </View>
          </>
        )}

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 20 }}>
          {state === "saving" && (
            <Text variant="caption" tone="tertiary">
              Saving
            </Text>
          )}
          {state === "saved" && (
            <>
              <Icon name="checkmark-circle" size={16} color={colors.success} />
              <Text variant="caption" tone="success">
                Saved
              </Text>
            </>
          )}
          {state === "error" && (
            <Text variant="caption" tone="danger">
              Could not save. Check your connection.
            </Text>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}
