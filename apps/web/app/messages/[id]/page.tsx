import { notFound, redirect } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { Chat, type ChatMessage } from "@/components/Chat";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, booking_id")
    .eq("id", id)
    .maybeSingle();
  if (!conversation) notFound();

  // Booking-backed conversations live on the booking page
  if (conversation.booking_id) redirect(`/bookings/${conversation.booking_id}`);

  const [{ data: messages }, { data: participants }] = await Promise.all([
    supabase
      .from("messages")
      .select("id, sender_id, body, created_at")
      .eq("conversation_id", id)
      .order("created_at")
      .limit(200),
    supabase
      .from("conversation_participants")
      .select("user_id, profiles(full_name, company_name)")
      .eq("conversation_id", id),
  ]);

  const names: Record<string, string> = {};
  for (const p of (participants ?? []) as unknown as {
    user_id: string;
    profiles: { full_name: string | null; company_name: string | null } | null;
  }[]) {
    names[p.user_id] = p.profiles?.company_name || p.profiles?.full_name || "User";
  }

  return (
    <PageShell title="Conversation">
      <div className="max-w-2xl">
        <Chat
          conversationId={id}
          meId={user.id}
          initialMessages={(messages as ChatMessage[]) ?? []}
          names={names}
        />
      </div>
    </PageShell>
  );
}
