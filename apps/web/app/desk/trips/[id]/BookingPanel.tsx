// From the client's selection to a confirmed, itinerary-ready trip (spec
// s8-s13; blueprint s16-s23): approve selection, contract, client payment,
// operator payment and confirmation, itinerary versions.
import Link from "next/link";
import { formatLocal, PAYMENT_METHOD_LABELS, PAYMENT_METHODS, type PaymentMethod, type TripPaymentStatus } from "@jlaero/shared";
import { FileText } from "lucide-react";
import { ActionForm } from "@/components/lux/ActionForm";
import { PaymentStatusPill } from "@/components/lux/status";
import { Card, DefinitionList, Field, Input, Money, Notice, Pill, SectionTitle, Select, Textarea } from "@/components/lux/ui";
import { createClient } from "@/lib/supabase/server";
import type { ItineraryContent } from "@/lib/trips/workflow";
import {
  approveSelectionAction, confirmOperatorAction, declineSelectionAction, paymentStatusAction, publishItineraryAction,
  recordOperatorPaymentAction, requestConfirmationAction, saveItineraryAction, uploadOperatorItineraryAction,
} from "./actions";
import type { DeskTrip } from "./data";

const when = (d: Date | string | null, tz: string | null = null) =>
  d ? formatLocal(d, tz, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "";

async function signedUrl(path: string | null) {
  if (!path) return null;
  const supabase = await createClient();
  const { data } = await supabase.storage.from("trip-docs").createSignedUrl(path, 600);
  return data?.signedUrl ?? null;
}

export async function BookingPanel({ data, isBroker, isFinance }: { data: DeskTrip; isBroker: boolean; isFinance: boolean }) {
  const { trip, quotes, contracts, payments, operatorPayments, bookings, opItins, clientItins } = data;
  const selected = quotes.find((q) => q.id === trip.selected_quote_id) ?? null;
  const verified = payments.some((p) => p.status === "verified");
  const booking = bookings.find((b) => ["pending", "requested", "confirmed"].includes(b.status)) ?? null;
  const draftItin = clientItins.find((i) => i.status === "draft") ?? null;
  const currentItin = clientItins.find((i) => i.status === "published") ?? null;
  const base = (draftItin ?? currentItin)?.content as ItineraryContent | undefined;
  // Aircraft, tail and operator follow the booked aircraft unless a draft is
  // being edited, so a replacement always carries into the next version.
  const ac = draftItin ? (draftItin.content as ItineraryContent) : null;
  const acDefaults = {
    aircraft: ac?.aircraft ?? selected?.aircraft_type ?? base?.aircraft ?? "",
    tail: ac?.tail_number ?? booking?.tail_number ?? selected?.tail_number ?? base?.tail_number ?? "",
    operator: ac?.operator ?? selected?.operator_name ?? base?.operator ?? "",
  };
  const proofUrls = new Map<string, string | null>();
  for (const p of [...payments, ...operatorPayments]) proofUrls.set(p.id, await signedUrl(p.proof_path));
  const itinUrls = new Map<string, string | null>();
  for (const i of opItins) itinUrls.set(i.id, await signedUrl(i.document_path));
  const opPaid = operatorPayments.filter((p) => ["sent", "confirmed"].includes(p.status)).reduce((s, p) => s + Number(p.amount), 0);
  const clientPaid = payments.filter((p) => p.status === "verified").reduce((s, p) => s + Number(p.amount), 0);

  if (!selected && !contracts.length && !payments.length) return null;

  const legDefaults = [
    { from: trip.origin_icao, to: trip.destination_icao, depart: formatLocal(trip.depart_at, trip.o_tz, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }) },
    trip.return_at ? { from: trip.destination_icao, to: trip.origin_icao, depart: formatLocal(trip.return_at, trip.d_tz, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }) } : null,
  ];

  return (
    <section aria-labelledby="booking-h" className="space-y-4">
      <SectionTitle><span id="booking-h">Booking</span></SectionTitle>

      {selected && (
        <Card className={trip.status === "client_selected" ? "border-info/50" : ""}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-fg-3">{selected.is_replacement ? "Replacement selected" : "Client selection"}</p>
              <p className="mt-1 font-display text-xl font-semibold">{selected.aircraft_type}</p>
              <p className="text-sm text-fg-2">{selected.operator_name} · selected {when(selected.selected_at)}</p>
            </div>
            <p className="font-display text-2xl font-semibold"><Money value={selected.client_price} /></p>
          </div>
          {trip.status === "client_selected" && isBroker && (
            <div className="mt-4 space-y-3 border-t border-line pt-4">
              <p className="text-sm text-fg-2">
                Verify the aircraft is still available at this price with {selected.operator_name}
                {selected.operator_phone ? ` (${selected.operator_phone})` : ""}. You can still adjust pricing in the quote above.
                {selected.is_replacement ? " Approving books the replacement and moves the trip to operator confirmation." : " Approving generates the contract from the active template and sends it to the client."}
              </p>
              <ActionForm action={approveSelectionAction.bind(null, trip.id)} submitLabel={selected.is_replacement ? "Approve replacement" : "Approve and send contract"} confirm="Availability and price verified with the operator?" />
              <details>
                <summary className="cursor-pointer text-sm text-fg-2">Not available as quoted?</summary>
                <ActionForm action={declineSelectionAction.bind(null, trip.id)} submitLabel="Decline selection" variant="danger" className="mt-3">
                  <Field label="What to tell the client"><Input name="reason" placeholder="The operator has just sold that date." /></Field>
                </ActionForm>
              </details>
            </div>
          )}
        </Card>
      )}

      {contracts.length > 0 && (
        <Card>
          <h3 className="font-display text-lg font-semibold">Contract</h3>
          <ul className="mt-3 divide-y divide-line text-sm">
            {contracts.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <FileText className="h-4 w-4 text-fg-3" aria-hidden />
                <span className="font-medium">{c.contract_number}</span>
                <Pill tone={c.status === "signed" ? "ok" : c.status === "sent" ? "info" : "neutral"}>{c.status}</Pill>
                <span className="text-fg-3">template v{c.template_version} · <Money value={c.total_amount} /></span>
                <span className="text-fg-3">
                  {c.status === "signed" ? `Signed by ${c.signer_name} ${when(c.signed_at)} from ${c.signer_ip ?? "unknown IP"}` : c.status === "void" ? `Void: ${c.void_reason}` : `Sent ${when(c.sent_at)}`}
                </span>
                <Link href={`/desk/trips/${trip.id}/contract/${c.id}`} className="ml-auto text-accent-text underline-offset-4 hover:underline">View / download</Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {payments.length > 0 && (
        <Card>
          <h3 className="font-display text-lg font-semibold">Client payment</h3>
          <div className="mt-3 space-y-3">
            {payments.map((p) => (
              <div key={p.id} className="rounded-xl border border-line p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <PaymentStatusPill status={p.status as TripPaymentStatus} />
                  <span className="font-semibold"><Money value={p.amount} currency={p.currency} /></span>
                  <span className="text-sm text-fg-2">{p.method ? PAYMENT_METHOD_LABELS[p.method as PaymentMethod] : "method not chosen"}</span>
                  {p.transaction_id && <span className="text-sm text-fg-2">ref {p.transaction_id}</span>}
                  {proofUrls.get(p.id) && <a href={proofUrls.get(p.id)!} target="_blank" rel="noreferrer" className="text-sm text-accent-text underline">Proof</a>}
                  <span className="ml-auto text-xs text-fg-3">{p.verified_at ? `Verified by ${p.verified_by_name ?? "finance"} ${when(p.verified_at)}` : p.submitted_at ? `Submitted ${when(p.submitted_at)}` : `Created ${when(p.created_at)}`}</span>
                </div>
                {p.client_note && <p className="mt-2 text-sm text-fg-2">Client note: {p.client_note}</p>}
                {p.failure_reason && <p className="mt-2 text-sm text-bad">{p.failure_reason}</p>}
                {isFinance && ["pending", "submitted", "received"].includes(p.status) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {p.status !== "received" && <ActionForm action={paymentStatusAction.bind(null, trip.id, p.id, "received")} submitLabel="Mark received" variant="secondary" inline />}
                    <ActionForm action={paymentStatusAction.bind(null, trip.id, p.id, "verified")} submitLabel="Verify payment" inline confirm="Funds confirmed in the company account?" />
                    <ActionForm action={paymentStatusAction.bind(null, trip.id, p.id, "failed")} submitLabel="Mark failed" variant="ghost" inline>
                      <Input name="note" placeholder="Reason shown to client" aria-label="Failure reason" className="max-w-xs" />
                    </ActionForm>
                  </div>
                )}
                {isFinance && p.status === "verified" && (
                  <ActionForm action={paymentStatusAction.bind(null, trip.id, p.id, "refunded")} submitLabel="Record refund" variant="ghost" inline className="mt-3" confirm="Record this payment as refunded?">
                    <Input name="note" placeholder="Refund note" aria-label="Refund note" className="max-w-xs" />
                  </ActionForm>
                )}
              </div>
            ))}
          </div>
          {!isFinance && <p className="mt-3 text-xs text-fg-3">Payment verification needs finance or admin permissions.</p>}
        </Card>
      )}

      {(verified || operatorPayments.length > 0) && selected && (
        <Card>
          <h3 className="font-display text-lg font-semibold">Operator payment</h3>
          <DefinitionList className="mt-2" items={[
            ["Operator cost (agreed)", <Money key="c" value={selected.operator_cost} />],
            ["Paid to operator", <Money key="p" value={opPaid} />],
            ["Client paid (verified)", <Money key="v" value={clientPaid} />],
            ["Gross margin", <Money key="m" value={clientPaid - opPaid} />],
          ]} />
          {operatorPayments.length > 0 && (
            <ul className="mt-3 divide-y divide-line text-sm">
              {operatorPayments.map((p) => (
                <li key={p.id} className="flex flex-wrap gap-3 py-2">
                  <Pill tone={p.status === "confirmed" || p.status === "sent" ? "ok" : "neutral"}>{p.status}</Pill>
                  <Money value={p.amount} currency={p.currency} />
                  <span className="text-fg-2">{p.method ? PAYMENT_METHOD_LABELS[p.method as PaymentMethod] : ""} {p.confirmation_reference ? `ref ${p.confirmation_reference}` : ""}</span>
                  {proofUrls.get(p.id) && <a href={proofUrls.get(p.id)!} target="_blank" rel="noreferrer" className="text-accent-text underline">Proof</a>}
                  <span className="ml-auto text-xs text-fg-3">{p.payment_date ?? ""} · {p.recorded_by_name ?? ""}</span>
                </li>
              ))}
            </ul>
          )}
          {isFinance && verified && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-semibold">Record a payment to {selected.operator_name}</summary>
              <ActionForm action={recordOperatorPaymentAction.bind(null, trip.id)} submitLabel="Record operator payment" resetOnSuccess className="mt-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Amount"><Input name="amount" inputMode="decimal" defaultValue={Math.max(0, Number(selected.operator_cost) - opPaid) || ""} required /></Field>
                  <Field label="Method">
                    <Select name="method" defaultValue="wire">{PAYMENT_METHODS.map((m) => <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>)}</Select>
                  </Field>
                  <Field label="Payment date"><Input name="payment_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></Field>
                  <Field label="Confirmation reference"><Input name="reference" /></Field>
                </div>
                <Field label="Payment confirmation (upload)"><Input name="proof" type="file" accept="application/pdf,image/*" /></Field>
                <Field label="Notes"><Input name="notes" /></Field>
              </ActionForm>
            </details>
          )}
        </Card>
      )}

      {selected && (verified || booking) && (
        <Card>
          <h3 className="font-display text-lg font-semibold">Operator confirmation</h3>
          {booking ? (
            <DefinitionList className="mt-2" items={[
              ["Operator", booking.operator_name],
              ["Aircraft", `${booking.aircraft_type ?? selected.aircraft_type}${booking.tail_number ? ` (${booking.tail_number})` : ""}`],
              ["Crew", booking.crew ?? "Not recorded"],
              ["Contact", [booking.operator_contact, booking.operator_email, booking.operator_phone].filter(Boolean).join(" · ") || "Not recorded"],
              ["Status", booking.status],
              ["Confirmation number", booking.confirmation_number ?? "Pending"],
            ]} />
          ) : (
            <p className="mt-2 text-sm text-fg-2">Payment is verified. Send the trip details and payment to {selected.operator_name}, then record their confirmation.</p>
          )}
          {isBroker && ["payment_received", "operator_confirmation_pending"].includes(trip.status) && (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {trip.status === "payment_received" && (
                <ActionForm action={requestConfirmationAction.bind(null, trip.id)} submitLabel="Mark as sent to operator" variant="secondary">
                  <Field label="Operator contact"><Input name="contact" defaultValue={booking?.operator_contact ?? ""} /></Field>
                  <Field label="Email"><Input name="email" type="email" defaultValue={booking?.operator_email ?? selected.operator_email ?? ""} /></Field>
                  <Field label="Phone"><Input name="phone" defaultValue={booking?.operator_phone ?? selected.operator_phone ?? ""} /></Field>
                  <Field label="Notes"><Input name="notes" /></Field>
                </ActionForm>
              )}
              <ActionForm action={confirmOperatorAction.bind(null, trip.id)} submitLabel="Record operator confirmation">
                <Field label="Operator confirmation number"><Input name="confirmation_number" required /></Field>
                <Field label="Tail number"><Input name="tail_number" defaultValue={booking?.tail_number ?? selected.tail_number ?? ""} /></Field>
                <Field label="Crew"><Input name="crew" placeholder="Captain, first officer, flight attendant" /></Field>
              </ActionForm>
            </div>
          )}
        </Card>
      )}

      {["confirmed", "itinerary_pending", "itinerary_ready", "within_72_hours", "active", "completed", "feedback_requested", "closed"].includes(trip.status) && (
        <Card>
          <h3 className="font-display text-lg font-semibold">Itinerary</h3>
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            <div>
              <p className="text-sm font-semibold">Operator itinerary</p>
              {opItins.length ? (
                <ul className="mt-2 space-y-1 text-sm">
                  {opItins.map((i) => (
                    <li key={i.id}>
                      {itinUrls.get(i.id) ? <a className="text-accent-text underline" href={itinUrls.get(i.id)!} target="_blank" rel="noreferrer">{i.file_name ?? "Document"}</a> : "Details entered"}
                      <span className="text-fg-3"> · {when(i.received_at)}{(i.details as { notes?: string })?.notes ? ` · ${(i.details as { notes?: string }).notes}` : ""}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-1 text-sm text-fg-2">Not received yet.</p>}
              {isBroker && (
                <ActionForm action={uploadOperatorItineraryAction.bind(null, trip.id)} submitLabel="Save operator itinerary" variant="secondary" resetOnSuccess className="mt-3">
                  <Field label="Document"><Input name="document" type="file" accept="application/pdf,image/*" /></Field>
                  <Field label="Or key details"><Textarea name="notes" placeholder="Wheels up 15:30 from Signature TEB..." /></Field>
                </ActionForm>
              )}
            </div>
            <div>
              <p className="text-sm font-semibold">Client itinerary versions</p>
              {clientItins.length ? (
                <ul className="mt-2 space-y-1 text-sm">
                  {clientItins.map((i) => (
                    <li key={i.id} className="flex flex-wrap items-center gap-2">
                      <span>v{i.version}</span>
                      <Pill tone={i.status === "published" ? "ok" : i.status === "draft" ? "warn" : "neutral"}>{i.status}</Pill>
                      {i.change_summary && <span className="text-fg-2">{i.change_summary}</span>}
                      <Link href={`/desk/trips/${trip.id}/itinerary/${i.id}`} className="text-accent-text underline">Preview</Link>
                      {i.status === "draft" && isBroker && (
                        <ActionForm action={publishItineraryAction.bind(null, trip.id, i.id)} submitLabel="Publish to client" inline confirm="Publish this itinerary and notify the client?" />
                      )}
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-1 text-sm text-fg-2">No company itinerary yet. Fill in the form to create one with your branding.</p>}
            </div>
          </div>

          {isBroker && !["completed", "feedback_requested", "closed"].includes(trip.status) && (
            <details className="mt-5 rounded-xl border border-line bg-raised p-4" open={!clientItins.length && opItins.length > 0}>
              <summary className="cursor-pointer text-sm font-semibold">{draftItin ? `Edit draft v${draftItin.version}` : currentItin ? "Create a new version" : "Create the client itinerary"}</summary>
              {currentItin && !draftItin && <Notice tone="info">Published versions are never changed. Saving creates a new version; the client keeps seeing the current one until you publish.</Notice>}
              <ActionForm action={saveItineraryAction.bind(null, trip.id)} submitLabel="Save draft" className="mt-4">
                <input type="hidden" name="operator_itinerary_id" value={opItins[0]?.id ?? ""} />
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Aircraft"><Input key={acDefaults.aircraft} name="aircraft" defaultValue={acDefaults.aircraft} required /></Field>
                  <Field label="Tail number"><Input key={acDefaults.tail} name="tail_number" defaultValue={acDefaults.tail} /></Field>
                  <Field label="Operator"><Input key={acDefaults.operator} name="operator" defaultValue={acDefaults.operator} /></Field>
                  <Field label="Passengers"><Input name="passengers" inputMode="numeric" defaultValue={base?.passengers ?? trip.passengers} /></Field>
                  <Field label="Crew" className="sm:col-span-2"><Input name="crew" defaultValue={base?.crew ?? booking?.crew ?? ""} /></Field>
                </div>
                {[0, 1].map((i) => {
                  const leg = base?.legs?.[i];
                  const d = legDefaults[i];
                  if (!leg && !d && i > 0) return null;
                  return (
                    <fieldset key={i} className="rounded-xl border border-line p-3">
                      <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-fg-3">Leg {i + 1}</legend>
                      <div className="grid gap-3 sm:grid-cols-4">
                        <Field label="From"><Input name={`leg${i}_from`} defaultValue={leg?.from ?? d?.from ?? ""} /></Field>
                        <Field label="To"><Input name={`leg${i}_to`} defaultValue={leg?.to ?? d?.to ?? ""} /></Field>
                        <Field label="Departs (local)"><Input name={`leg${i}_depart`} defaultValue={leg?.depart_local ?? d?.depart ?? ""} /></Field>
                        <Field label="Arrives (local)"><Input name={`leg${i}_arrive`} defaultValue={leg?.arrive_local ?? ""} /></Field>
                        <Field label="Departure FBO" className="sm:col-span-2"><Input name={`leg${i}_from_fbo`} defaultValue={leg?.from_fbo ?? ""} placeholder="Signature Flight Support" /></Field>
                        <Field label="Arrival FBO"><Input name={`leg${i}_to_fbo`} defaultValue={leg?.to_fbo ?? ""} /></Field>
                        <Field label="Flight time"><Input name={`leg${i}_flight_time`} defaultValue={leg?.flight_time ?? ""} placeholder="2h 45m" /></Field>
                      </div>
                    </fieldset>
                  );
                })}
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Catering"><Input name="catering" defaultValue={base?.catering ?? (trip.catering_required ? "Catering arranged" : "")} /></Field>
                  <Field label="Ground transportation"><Input name="ground_transport" defaultValue={base?.ground_transport ?? (trip.vehicle_required ? "Vehicle arranged" : "")} /></Field>
                  <Field label="Contacts"><Input name="contacts" defaultValue={base?.contacts ?? `${data.settings.company.name} trip support ${data.settings.company.support_phone || data.settings.company.support_email}`} /></Field>
                  <Field label="Change summary" hint="Shown to the client on updated versions"><Input name="change_summary" defaultValue={draftItin?.change_summary ?? ""} placeholder="Replacement aircraft: Challenger 650" /></Field>
                </div>
                <Field label="Notes for the client"><Textarea name="notes" defaultValue={base?.notes ?? ""} /></Field>
              </ActionForm>
            </details>
          )}
        </Card>
      )}
    </section>
  );
}
