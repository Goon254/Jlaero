import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PAYMENT_METHOD_LABELS, type PaymentMethod, type TripPaymentStatus } from "@jlaero/shared";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ClientShell } from "@/components/lux/ClientShell";
import { PaymentStatusPill } from "@/components/lux/status";
import { Card, EmptyState, Eyebrow, Money, Notice, PageHeader } from "@/components/lux/ui";
import { loadClientSettings } from "../../_lib/data";
import { PaymentForm } from "../../_lib/PaymentForm";

export const metadata = { title: "Payment | Jlaero" };

type Payment = {
  id: string; amount: string; currency: string; status: TripPaymentStatus; method: PaymentMethod | null;
  transaction_id: string | null; submitted_at: string | null; received_at: string | null; verified_at: string | null;
  failure_reason: string | null; created_at: string;
};

// Payment (spec s10, s11). Manual methods in Phase 1; the broker verifies.
export default async function PayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/trips/${id}/pay`);
  const supabase = await createClient();
  const { data: trip } = await supabase.from("trips").select("id, trip_number, status").eq("id", id).maybeSingle();
  if (!trip) notFound();
  const { data } = await supabase
    .from("trip_payments")
    .select("id, amount, currency, status, method, transaction_id, submitted_at, received_at, verified_at, failure_reason, created_at")
    .eq("trip_id", id)
    .order("created_at", { ascending: false });
  const payments = (data ?? []) as Payment[];
  const open = payments.find((p) => p.status === "pending" || p.status === "failed");
  const settings = await loadClientSettings();
  const d = (s: string | null) => (s ? new Date(s).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : null);

  return (
    <ClientShell>
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-fg-3">
        <Link href="/trips" className="hover:text-fg">My trips</Link> <span aria-hidden>/</span>{" "}
        <Link href={`/trips/${id}`} className="hover:text-fg">{trip.trip_number}</Link> <span aria-hidden>/</span> <span className="text-fg-2">Payment</span>
      </nav>
      <PageHeader eyebrow={trip.trip_number} title="Payment" subtitle="Your trip is confirmed only after payment is received and verified and the operator confirms the aircraft." />
      {!payments.length ? (
        <EmptyState title="Nothing to pay yet" body="Payment opens once you sign your charter agreement." action={<Link href={`/trips/${id}/contract`} className="text-sm font-semibold text-accent-text hover:underline">View agreement</Link>} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            {open ? (
              <Card>
                <Eyebrow className="mb-1">Amount due</Eyebrow>
                <p className="mb-6 font-display text-4xl font-semibold"><Money value={open.amount} currency={open.currency} /></p>
                {open.status === "failed" && (
                  <div className="mb-6">
                    <Notice tone="bad" title="We could not verify your last payment">{open.failure_reason ?? "Please check the details and submit again, or contact your broker."}</Notice>
                  </div>
                )}
                <PaymentForm
                  tripId={id}
                  paymentId={open.id}
                  amount={Number(open.amount)}
                  currency={open.currency}
                  instructions={settings.payment_instructions}
                  terms={settings.payment_instructions.terms ?? null}
                />
              </Card>
            ) : (
              <Card>
                <p className="font-display text-xl font-semibold">
                  {payments[0]!.status === "verified" ? "Payment verified" : payments[0]!.status === "refunded" ? "Payment refunded" : "Payment submitted"}
                </p>
                <p className="mt-2 text-sm text-fg-2">
                  {payments[0]!.status === "verified"
                    ? "Thank you. We are confirming the aircraft with the operator and will let you know as soon as your trip is confirmed."
                    : "Thank you. Your broker will verify the payment and confirm your trip."}
                </p>
              </Card>
            )}
          </div>
          <aside>
            <Card>
              <p className="mb-3 font-semibold">Payment history</p>
              <ul className="divide-y divide-line">
                {payments.map((p) => (
                  <li key={p.id} className="py-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <Money value={p.amount} currency={p.currency} className="font-semibold" />
                      <PaymentStatusPill status={p.status} />
                    </div>
                    <p className="mt-1 text-xs text-fg-3">
                      {[p.method ? PAYMENT_METHOD_LABELS[p.method] : null, p.transaction_id ? `Ref ${p.transaction_id}` : null].filter(Boolean).join(" · ")}
                    </p>
                    <p className="text-xs text-fg-3">
                      {p.verified_at ? `Verified ${d(p.verified_at)}` : p.received_at ? `Received ${d(p.received_at)}` : p.submitted_at ? `Submitted ${d(p.submitted_at)}` : `Due since ${d(p.created_at)}`}
                    </p>
                    {p.status === "failed" && p.failure_reason && <p className="mt-1 text-xs text-bad">{p.failure_reason}</p>}
                  </li>
                ))}
              </ul>
            </Card>
          </aside>
        </div>
      )}
    </ClientShell>
  );
}
