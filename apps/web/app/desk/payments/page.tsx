import Link from "next/link";
import { FileText } from "lucide-react";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@jlaero/shared";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/trips/access";
import { createClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/lux/ActionForm";
import { Card, EmptyState, Input, Money, Notice, PageHeader, Pill, SectionTitle, Stat } from "@/components/lux/ui";
import { PaymentStatusPill } from "@/components/lux/status";
import { Table, Td, shortDate, shortDateTime } from "../_lib/table";
import { updatePayment } from "./actions";

export const metadata = { title: "Payments | Jlaero Desk" };

// Payment verification queue (spec s11, blueprint s19-s21). Finance and
// admins act; brokers can see status but not change it.
export default async function DeskPayments() {
  const user = await requireStaff("view");
  const canAct = user.isFinance;
  const sql = db();

  const queue = await sql`
    select p.*, t.trip_number, t.id as trip_id, t.status as trip_status, c.full_name as client_name, c.company_name
    from trip_payments p join trips t on t.id = p.trip_id join clients c on c.id = p.client_id
    where p.status in ('submitted', 'received', 'pending')
    order by case p.status when 'submitted' then 0 when 'received' then 1 else 2 end, coalesce(p.submitted_at, p.created_at) asc
    limit 200`;

  // Proof uploads live in the private trip-docs bucket; the staff storage
  // policy lets the signed-in user's session mint short-lived links.
  const supabase = await createClient();
  const proofUrls = new Map<string, string>();
  for (const p of queue) {
    if (!p.proof_path) continue;
    const { data } = await supabase.storage.from("trip-docs").createSignedUrl(p.proof_path, 600);
    if (data?.signedUrl) proofUrls.set(p.id, data.signedUrl);
  }

  const recent = await sql`
    select p.*, t.trip_number, t.id as trip_id, c.full_name as client_name, v.full_name as verified_by_name
    from trip_payments p join trips t on t.id = p.trip_id join clients c on c.id = p.client_id
    left join profiles v on v.id = p.verified_by
    where p.status in ('verified', 'failed', 'refunded', 'cancelled')
    order by coalesce(p.verified_at, p.updated_at) desc limit 50`;

  const ledger = user.isFinance ? await sql`
    select o.*, t.trip_number, t.id as trip_id, op.name as operator_name, r.full_name as recorded_by_name
    from operator_payments o join trips t on t.id = o.trip_id join operators op on op.id = o.operator_id
    left join profiles r on r.id = o.recorded_by
    order by o.created_at desc limit 50` : [];

  // Margin per trip: client money verified vs money sent to operators.
  const margins = user.isFinance ? await sql`
    select t.id, t.trip_number, t.status, q.client_price, q.operator_cost, q.markup_amount, q.currency,
           coalesce((select sum(amount) from trip_payments where trip_id = t.id and status = 'verified'), 0) as client_paid,
           coalesce((select sum(amount) from trip_payments where trip_id = t.id and status = 'refunded'), 0) as refunded,
           coalesce((select sum(amount) from operator_payments where trip_id = t.id and status in ('sent', 'confirmed')), 0) as operator_paid
    from trips t join trip_quotes q on q.id = t.selected_quote_id
    where exists (select 1 from trip_payments p where p.trip_id = t.id and p.status in ('verified', 'refunded'))
    order by t.depart_at desc limit 50` : [];

  const totals = (await sql`
    select coalesce(sum(amount) filter (where status = 'submitted'), 0) as submitted,
           count(*) filter (where status = 'submitted')::int as submitted_n,
           coalesce(sum(amount) filter (where status = 'verified' and verified_at > now() - interval '30 days'), 0) as verified_30
    from trip_payments`)[0]!;

  return (
    <>
      <PageHeader eyebrow="Payment management" title="Payments" subtitle="Verify client payments against the bank, then record what is paid to operators." />
      {!canAct && <div className="mb-6"><Notice tone="info" title="Read only">Payment verification needs finance or admin permissions.</Notice></div>}

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <Stat label="Awaiting verification" value={totals.submitted_n} hint={<Money value={totals.submitted} />} />
        <Stat label="Verified, last 30 days" value={<Money value={totals.verified_30} />} />
        <Stat label="In queue" value={queue.length} />
      </div>

      <SectionTitle>Queue</SectionTitle>
      {queue.length === 0 ? (
        <EmptyState title="Nothing to verify" body="Payments clients submit from the app appear here." />
      ) : (
        <div className="space-y-3">
          {queue.map((p) => (
            <Card key={p.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/desk/trips/${p.trip_id}`} className="font-semibold underline-offset-4 hover:underline">{p.trip_number}</Link>
                    <PaymentStatusPill status={p.status} />
                  </div>
                  <p className="mt-1 text-sm text-fg-2">{p.client_name}{p.company_name ? `, ${p.company_name}` : ""}</p>
                </div>
                <p className="font-display text-2xl font-semibold"><Money value={p.amount} currency={p.currency} /></p>
              </div>
              <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
                <div><dt className="text-fg-3">Method</dt><dd>{p.method ? PAYMENT_METHOD_LABELS[p.method as PaymentMethod] : "Not chosen yet"}</dd></div>
                <div><dt className="text-fg-3">Reference</dt><dd className="break-all font-mono text-xs">{p.transaction_id ?? "None"}</dd></div>
                <div><dt className="text-fg-3">Submitted</dt><dd>{p.submitted_at ? shortDateTime(p.submitted_at) : "Not yet"}</dd></div>
                <div><dt className="text-fg-3">Proof</dt><dd>{proofUrls.get(p.id) ? <a href={proofUrls.get(p.id)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent-text underline-offset-4 hover:underline"><FileText className="h-4 w-4" aria-hidden />View upload</a> : "None"}</dd></div>
              </dl>
              {p.client_note && <p className="mt-3 rounded-xl bg-sunken px-3 py-2 text-sm text-fg-2">Client note: {p.client_note}</p>}
              {canAct && (
                <div className="mt-4 flex flex-wrap items-start gap-3 border-t border-line pt-4">
                  <ActionForm action={updatePayment} submitLabel="Verify payment" inline>
                    <input type="hidden" name="paymentId" value={p.id} /><input type="hidden" name="tripId" value={p.trip_id} /><input type="hidden" name="to" value="verified" />
                  </ActionForm>
                  {p.status !== "received" && (
                    <ActionForm action={updatePayment} submitLabel="Mark received" variant="secondary" inline>
                      <input type="hidden" name="paymentId" value={p.id} /><input type="hidden" name="tripId" value={p.trip_id} /><input type="hidden" name="to" value="received" />
                    </ActionForm>
                  )}
                  <ActionForm action={updatePayment} submitLabel="Mark failed" variant="danger" inline confirm="Mark this payment as failed and notify the client?">
                    <input type="hidden" name="paymentId" value={p.id} /><input type="hidden" name="tripId" value={p.trip_id} /><input type="hidden" name="to" value="failed" />
                    <label className="sr-only" htmlFor={`fail-${p.id}`}>Reason for the client</label>
                    <Input id={`fail-${p.id}`} name="note" placeholder="Reason shown to the client" className="w-64" />
                  </ActionForm>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <div className="mt-10">
        <SectionTitle>Recently settled</SectionTitle>
        {recent.length === 0 ? <p className="text-sm text-fg-3">No settled payments yet.</p> : (
          <Table head={["Trip", "Client", "Amount", "Method", "Status", "Verified by", "Date", ""]}>
            {recent.map((p) => (
              <tr key={p.id}>
                <Td><Link href={`/desk/trips/${p.trip_id}`} className="font-semibold hover:underline">{p.trip_number}</Link></Td>
                <Td>{p.client_name}</Td>
                <Td><Money value={p.amount} currency={p.currency} /></Td>
                <Td>{p.method ? PAYMENT_METHOD_LABELS[p.method as PaymentMethod] : ""}</Td>
                <Td><PaymentStatusPill status={p.status} />{p.failure_reason && <p className="mt-1 text-xs text-fg-3">{p.failure_reason}</p>}</Td>
                <Td>{p.verified_by_name ?? ""}</Td>
                <Td className="whitespace-nowrap">{shortDate(p.verified_at ?? p.updated_at)}</Td>
                <Td>
                  {canAct && p.status === "verified" && (
                    <ActionForm action={updatePayment} submitLabel="Refund" variant="ghost" inline confirm="Mark this payment as refunded? Send the money back through the bank first.">
                      <input type="hidden" name="paymentId" value={p.id} /><input type="hidden" name="tripId" value={p.trip_id} /><input type="hidden" name="to" value="refunded" />
                    </ActionForm>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </div>

      {user.isFinance && (
        <>
          <div className="mt-10">
            <SectionTitle>Operator payments</SectionTitle>
            <p className="mb-3 text-sm text-fg-2">Recorded from each trip workspace. Kept separate from client payments.</p>
            {ledger.length === 0 ? <p className="text-sm text-fg-3">No operator payments recorded yet.</p> : (
              <Table head={["Trip", "Operator", "Amount", "Method", "Status", "Paid on", "Reference", "Recorded by"]}>
                {ledger.map((o) => (
                  <tr key={o.id}>
                    <Td><Link href={`/desk/trips/${o.trip_id}`} className="font-semibold hover:underline">{o.trip_number}</Link></Td>
                    <Td>{o.operator_name}</Td>
                    <Td><Money value={o.amount} currency={o.currency} /></Td>
                    <Td>{o.method ? PAYMENT_METHOD_LABELS[o.method as PaymentMethod] : ""}</Td>
                    <Td><Pill tone={o.status === "confirmed" ? "ok" : o.status === "failed" ? "bad" : "info"}>{o.status}</Pill></Td>
                    <Td className="whitespace-nowrap">{o.payment_date ? shortDate(o.payment_date) : ""}</Td>
                    <Td className="font-mono text-xs">{o.confirmation_reference ?? ""}</Td>
                    <Td>{o.recorded_by_name ?? ""}</Td>
                  </tr>
                ))}
              </Table>
            )}
          </div>

          <div className="mt-10">
            <SectionTitle>Margin by trip</SectionTitle>
            {margins.length === 0 ? <p className="text-sm text-fg-3">Margins appear once client payments are verified.</p> : (
              <Table head={["Trip", "Client paid", "Refunded", "Operator paid", "Operator cost (quote)", "Planned markup", "Realized margin"]}>
                {margins.map((m) => {
                  const realized = Number(m.client_paid) - Number(m.refunded) - Number(m.operator_paid);
                  return (
                    <tr key={m.id}>
                      <Td><Link href={`/desk/trips/${m.id}`} className="font-semibold hover:underline">{m.trip_number}</Link></Td>
                      <Td><Money value={m.client_paid} currency={m.currency} /></Td>
                      <Td><Money value={m.refunded} currency={m.currency} /></Td>
                      <Td>{Number(m.operator_paid) > 0 ? <Money value={m.operator_paid} currency={m.currency} /> : <span className="text-fg-3">Not paid yet</span>}</Td>
                      <Td><Money value={m.operator_cost} currency={m.currency} /></Td>
                      <Td><Money value={m.markup_amount} currency={m.currency} /></Td>
                      <Td className={realized < 0 ? "font-semibold text-bad" : "font-semibold"}>{Number(m.operator_paid) > 0 ? <Money value={realized} currency={m.currency} /> : <span className="font-normal text-fg-3">Pending</span>}</Td>
                    </tr>
                  );
                })}
              </Table>
            )}
          </div>
        </>
      )}
    </>
  );
}
