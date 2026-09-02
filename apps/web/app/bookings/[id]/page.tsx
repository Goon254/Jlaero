import Link from "next/link";
import { notFound } from "next/navigation";
import type { BookingActor, BookingStatus } from "@jlaero/shared";
import { PageShell } from "@/components/PageShell";
import { Chat, type ChatMessage } from "@/components/Chat";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ActionBar } from "./ActionBar";
import { ContractPanel } from "./ContractPanel";
import { ManifestEditor } from "./ManifestEditor";
import { PayPanel } from "./PayPanel";
import { QuotePanel, type QuoteView } from "./QuotePanel";

const TIMELINE: BookingStatus[] = [
  "requested",
  "quoted",
  "accepted",
  "contract_signed",
  "paid_in_full",
  "in_progress",
  "completed",
];

export default async function BookingDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select(
      `id, kind, status, buyer_id, provider_id, currency, pets, luggage_notes,
       catering_notes, special_requests, created_at,
       aircraft(id, name, manufacturer, model),
       booking_legs(id, position, origin, destination, depart_at, passengers),
       booking_passengers(id, full_name, date_of_birth)`
    )
    .eq("id", id)
    .maybeSingle();
  if (!booking) notFound();

  const role: BookingActor | null =
    booking.buyer_id === user.id
      ? "buyer"
      : booking.provider_id === user.id
        ? "provider"
        : null;
  if (!role) notFound();

  const [
    { data: quotes },
    { data: conversation },
    { data: parties },
    { data: contract },
    { data: payments },
    { data: acceptedQuote },
  ] = await Promise.all([
    supabase
      .from("quotes")
      .select(
        "id, version, status, total, currency, expires_at, notes, quote_line_items(kind, description, quantity, unit_amount, amount, position)"
      )
      .eq("booking_id", id)
      .order("version", { ascending: false })
      .limit(1),
    supabase.from("conversations").select("id").eq("booking_id", id).maybeSingle(),
    supabase
      .from("profiles")
      .select("id, full_name, company_name")
      .in("id", [booking.buyer_id, booking.provider_id]),
    supabase
      .from("contracts")
      .select("status, buyer_signer_name, buyer_signed_at")
      .eq("booking_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("payments")
      .select("amount, status")
      .eq("booking_id", id),
    supabase
      .from("quotes")
      .select("total")
      .eq("booking_id", id)
      .eq("status", "accepted")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  let messages: ChatMessage[] = [];
  if (conversation) {
    const { data } = await supabase
      .from("messages")
      .select("id, sender_id, body, created_at")
      .eq("conversation_id", conversation.id)
      .order("created_at")
      .limit(200);
    messages = (data as ChatMessage[]) ?? [];
  }

  const names: Record<string, string> = {};
  for (const p of parties ?? []) {
    names[p.id] = p.company_name || p.full_name || "User";
  }

  const legs = [...booking.booking_legs].sort((a, b) => a.position - b.position);
  const aircraft = booking.aircraft as unknown as { name: string } | null;
  const status = booking.status as BookingStatus;
  const timelineIdx = TIMELINE.indexOf(status);
  const terminal = ["cancelled", "declined", "expired", "refunded", "disputed"].includes(status);
  const editableManifest = !terminal && !["completed", "in_progress"].includes(status);

  const counterparty =
    role === "buyer" ? names[booking.provider_id] : names[booking.buyer_id];

  return (
    <PageShell
      title={
        legs.length > 1
          ? `${legs[0]!.origin} ⇄ ${legs[0]!.destination}`
          : `${legs[0]?.origin ?? ""} → ${legs[0]?.destination ?? ""}`
      }
      subtitle={`${aircraft?.name ?? ""} · with ${counterparty ?? ""}`}
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        {terminal ? (
          <span className="rounded-full bg-red-900/50 px-4 py-1.5 text-sm capitalize text-red-300">
            {status.replace(/_/g, " ")}
          </span>
        ) : (
          <ol className="flex flex-wrap items-center gap-1 text-xs">
            {TIMELINE.map((s, i) => (
              <li key={s} className="flex items-center gap-1">
                {i > 0 && <span className="text-slate-700">→</span>}
                <span
                  className={`rounded-full px-2.5 py-1 capitalize ${
                    i < timelineIdx
                      ? "bg-slate-800 text-slate-400"
                      : i === timelineIdx
                        ? "bg-gold text-ink"
                        : "text-slate-600"
                  }`}
                >
                  {s.replace(/_/g, " ")}
                </span>
              </li>
            ))}
          </ol>
        )}
        <ActionBar bookingId={id} status={status} role={role} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-800 bg-ink-soft p-5">
            <h2 className="font-semibold">Itinerary</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {legs.map((l) => (
                <li key={l.id} className="flex items-center justify-between">
                  <span>
                    {l.origin} → {l.destination}
                  </span>
                  <span className="text-slate-400">
                    {l.depart_at
                      ? new Date(l.depart_at).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                          timeZone: "UTC",
                        }) + " UTC"
                      : "Time TBD"}
                    {l.passengers ? ` · ${l.passengers} pax` : ""}
                  </span>
                </li>
              ))}
            </ul>
            {(booking.pets || booking.special_requests || booking.luggage_notes) && (
              <p className="mt-3 border-t border-slate-800 pt-3 text-xs text-slate-500">
                {booking.pets ? "Traveling with pets. " : ""}
                {booking.luggage_notes ? `Luggage: ${booking.luggage_notes}. ` : ""}
                {booking.special_requests ?? ""}
              </p>
            )}
          </section>

          <QuotePanel
            bookingId={id}
            quote={(quotes?.[0] as QuoteView | undefined) ?? null}
            role={role}
            bookingStatus={status}
          />

          <ContractPanel
            bookingId={id}
            role={role}
            bookingStatus={status}
            contract={contract ?? null}
            summary={{
              route:
                legs.length > 1
                  ? `${legs[0]!.origin} ⇄ ${legs[0]!.destination}`
                  : `${legs[0]?.origin ?? ""} → ${legs[0]?.destination ?? ""}`,
              aircraftName: aircraft?.name ?? "the aircraft",
              total: acceptedQuote
                ? `$${Number(acceptedQuote.total).toLocaleString()}`
                : "the quoted amount",
              operator: names[booking.provider_id] ?? "the Operator",
              traveler: names[booking.buyer_id] ?? "the Charterer",
            }}
          />

          <PayPanel
            bookingId={id}
            role={role}
            bookingStatus={status}
            total={Number(acceptedQuote?.total ?? 0)}
            capturedTotal={(payments ?? [])
              .filter((p) => p.status === "captured")
              .reduce((s, p) => s + Number(p.amount), 0)}
          />

          <ManifestEditor
            bookingId={id}
            passengers={booking.booking_passengers}
            editable={editableManifest}
          />
        </div>

        <div>
          {conversation ? (
            <Chat
              conversationId={conversation.id}
              meId={user.id}
              initialMessages={messages}
              names={names}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-500">
              No conversation attached to this booking.
            </div>
          )}
          <p className="mt-3 text-center text-xs text-slate-600">
            Also in <Link href="/messages" className="text-gold">Messages</Link>
          </p>
        </div>
      </div>
    </PageShell>
  );
}
