import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type ConversationRow = {
  conversation_id: string;
  conversations: {
    id: string;
    booking_id: string | null;
    bookings: {
      status: string;
      buyer_id: string;
      provider_id: string;
      aircraft: { name: string } | null;
      booking_legs: { position: number; origin: string; destination: string | null }[];
    } | null;
  };
};

export default async function MessagesInbox() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from("conversation_participants")
    .select(
      `conversation_id,
       conversations(id, booking_id,
         bookings(status, buyer_id, provider_id, aircraft(name),
           booking_legs(position, origin, destination)))`
    )
    .eq("user_id", user.id);

  const rows = (data ?? []) as unknown as ConversationRow[];
  const convIds = rows.map((r) => r.conversation_id);

  // Last message + unread counts in two queries
  const lastByConv = new Map<string, { body: string; created_at: string; sender_id: string }>();
  const unreadByConv = new Map<string, number>();
  if (convIds.length) {
    const { data: msgs } = await supabase
      .from("messages")
      .select("conversation_id, body, created_at, sender_id, read_at")
      .in("conversation_id", convIds)
      .order("created_at", { ascending: false })
      .limit(400);
    for (const m of msgs ?? []) {
      if (!lastByConv.has(m.conversation_id)) {
        lastByConv.set(m.conversation_id, m);
      }
      if (m.sender_id !== user.id && !m.read_at) {
        unreadByConv.set(m.conversation_id, (unreadByConv.get(m.conversation_id) ?? 0) + 1);
      }
    }
  }

  const sorted = rows
    .filter((r) => r.conversations)
    .sort((a, b) => {
      const la = lastByConv.get(a.conversation_id)?.created_at ?? "";
      const lb = lastByConv.get(b.conversation_id)?.created_at ?? "";
      return lb.localeCompare(la);
    });

  return (
    <PageShell title="Messages" subtitle="Conversations tied to your bookings.">
      {!sorted.length ? (
        <div className="rounded-2xl border border-dashed border-slate-700 p-12 text-center text-slate-400">
          No conversations yet. They start when a booking request is made.
        </div>
      ) : (
        <ul className="space-y-3">
          {sorted.map((r) => {
            const c = r.conversations;
            const b = c.bookings;
            const legs = [...(b?.booking_legs ?? [])].sort((x, y) => x.position - y.position);
            const route = legs.length
              ? `${legs[0]!.origin} → ${legs[legs.length - 1]!.destination ?? legs[0]!.destination}`
              : "Conversation";
            const last = lastByConv.get(c.id);
            const unread = unreadByConv.get(c.id) ?? 0;
            return (
              <li key={c.id}>
                <Link
                  href={b ? `/bookings/${c.booking_id}` : `/messages/${c.id}`}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-ink-soft px-5 py-4 hover:border-gold"
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {route}
                      <span className="ml-2 text-sm text-slate-400">
                        {b?.aircraft?.name ?? ""}
                      </span>
                    </p>
                    <p className="mt-0.5 truncate text-sm text-slate-500">
                      {last ? last.body : "No messages yet"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {b && (
                      <span className="rounded-full bg-slate-800 px-3 py-1 text-xs capitalize text-slate-300">
                        {b.status.replace(/_/g, " ")}
                      </span>
                    )}
                    {unread > 0 && (
                      <span className="rounded-full bg-gold px-2.5 py-1 text-xs font-semibold text-ink">
                        {unread}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}
