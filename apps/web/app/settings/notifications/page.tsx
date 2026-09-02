import { PageShell } from "@/components/PageShell";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { NotificationForm } from "./NotificationForm";

export default async function NotificationSettings() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("notification_preferences")
    .select("prefs")
    .eq("user_id", user.id)
    .maybeSingle();

  const prefs = (data?.prefs ?? {}) as Record<string, boolean>;

  return (
    <PageShell title="Notifications" subtitle="Choose what reaches you where.">
      <NotificationForm
        defaults={{
          email_bookings: prefs.email_bookings ?? true,
          email_messages: prefs.email_messages ?? true,
          push_bookings: prefs.push_bookings ?? true,
          push_messages: prefs.push_messages ?? true,
          email_marketing: prefs.email_marketing ?? false,
        }}
      />
    </PageShell>
  );
}
