import { useCallback, useState } from "react";
import { ScrollView, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { openWeb } from "@/lib/web";
import { radius, space, useTheme } from "@/lib/theme";
import { Button, Card, Icon, Pill, Screen, SectionTitle, Skeleton, Text } from "@/components/ui";

export default function PaymentSettings() {
  const { session } = useSession();
  const { colors } = useTheme();
  const [roles, setRoles] = useState<string[] | null>(null);
  const [account, setAccount] = useState<{ payouts_enabled: boolean } | null | undefined>(undefined);

  const load = useCallback(async () => {
    if (!session) return;
    const [{ data: r }, { data: a }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", session.user.id),
      supabase.from("stripe_accounts").select("payouts_enabled").eq("user_id", session.user.id).maybeSingle(),
    ]);
    setRoles((r ?? []).map((x) => x.role));
    setAccount(a ?? null);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const isProvider = !!roles && (roles.includes("owner") || roles.includes("crew"));

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.xxl, paddingBottom: space.huge }}>
        <View>
          <SectionTitle title="Paying for charters" />
          <Card style={{ gap: space.md }}>
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
                <Icon name="lock-closed-outline" color={colors.accentText} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">Secured by Stripe</Text>
                <Text variant="caption" tone="secondary">
                  You pay at checkout after accepting a quote.
                </Text>
              </View>
            </View>
            <Text variant="caption" tone="tertiary">
              No card details are stored on Jlaero. Deposits and balances are collected on the web when you sign the
              charter agreement.
            </Text>
          </Card>
        </View>

        {roles === null ? (
          <Card>
            <Skeleton width="50%" />
          </Card>
        ) : isProvider ? (
          <View>
            <SectionTitle
              title="Getting paid"
              action={
                account === undefined ? null : !account ? (
                  <Pill label="Not set up" tone="neutral" />
                ) : account.payouts_enabled ? (
                  <Pill label="Active" tone="success" />
                ) : (
                  <Pill label="Action needed" tone="warning" />
                )
              }
            />
            <Card style={{ gap: space.lg }}>
              {account === undefined ? (
                <Skeleton width="70%" />
              ) : !account ? (
                <>
                  <Text variant="body" tone="secondary">
                    Set up your payout account with Stripe to receive charter earnings. It takes a few minutes and
                    needs your business and bank details.
                  </Text>
                  <Button title="Set up payouts" iconRight="open-outline" onPress={() => openWeb("/settings/payments", { auth: true })} />
                </>
              ) : account.payouts_enabled ? (
                <View style={{ flexDirection: "row", gap: space.sm, alignItems: "flex-start" }}>
                  <Icon name="checkmark-circle" color={colors.success} />
                  <Text variant="body" tone="secondary" style={{ flex: 1 }}>
                    Payouts are active. Earnings transfer automatically after each completed trip, minus the 10%
                    platform fee.
                  </Text>
                </View>
              ) : (
                <>
                  <Text variant="body" tone="secondary">
                    Your payout account needs more information before transfers can start.
                  </Text>
                  <Button title="Continue setup" iconRight="open-outline" onPress={() => openWeb("/settings/payments", { auth: true })} />
                </>
              )}
            </Card>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
