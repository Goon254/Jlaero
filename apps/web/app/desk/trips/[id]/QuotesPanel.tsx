// Quote management (spec s5-s7, s23; blueprint s7, s8, s12, s14): every
// operator response with its source, the pricing breakdown the broker checks
// before anything reaches the client, AI option recommendations, and the
// three-slot send form.
import { AIRCRAFT_CATEGORIES, AIRCRAFT_CATEGORY_LABELS, formatLocal, type QuoteSource, type QuoteStatus } from "@jlaero/shared";
import { Sparkles } from "lucide-react";
import { ActionForm } from "@/components/lux/ActionForm";
import { QuoteSourcePill, QuoteStatusPill } from "@/components/lux/status";
import { Card, cx, Field, Input, Money, Notice, Pill, SectionTitle, Select, Textarea } from "@/components/lux/ui";
import { recommendOptions } from "@/lib/trips/options";
import { addQuoteAction, pasteQuoteAction, reviewQuoteAction, sendOptionsAction, updateQuoteAction } from "./actions";
import type { DeskTrip } from "./data";

const CATEGORIES = AIRCRAFT_CATEGORIES.filter((c) => !["airliner", "helicopter"].includes(c));
const localInput = (d: Date | string | null) => (d ? new Date(d).toISOString().slice(0, 16) : "");

export function QuotesPanel({ data, isAdmin, operators }: { data: DeskTrip; isAdmin: boolean; operators: { id: string; name: string; network_status: string }[] }) {
  const { trip, quotes, settings } = data;
  const replacementMode = ["operational_issue", "replacement_search", "replacement_pending_client"].includes(trip.status);
  const canSend = ["new_request", "searching", "quotes_received", "broker_review", "options_sent", "operational_issue", "replacement_search", "replacement_pending_client"].includes(trip.status);
  const finished = ["completed", "feedback_requested", "closed", "cancelled"].includes(trip.status);
  const rec = recommendOptions(quotes.map((q) => ({ ...q, confidence: q.confidence })) as never, trip as never, { replacement: replacementMode });
  const recIds = new Map(rec.map((r, i) => [r.quoteId, { ...r, slot: i + 1 }]));
  const sendable = quotes.filter((q) => ["approved", "option_sent"].includes(q.status) && Boolean(q.is_replacement) === replacementMode);
  const recommendedSendable = rec.filter((r) => sendable.some((q) => q.id === r.quoteId)).map((r) => r.quoteId);
  const slotDefault = (i: number) => (recommendedSendable[i] ?? sendable.filter((q) => !recommendedSendable.includes(q.id))[i - recommendedSendable.length]?.id ?? "");
  const notesFor = (id: string) => data.quoteNotes.filter((n) => n.target_id === id);

  return (
    <section aria-labelledby="quotes-h" className="space-y-4">
      <SectionTitle>
        <span id="quotes-h">Quotes and pricing</span>
      </SectionTitle>
      <p className="-mt-2 text-sm text-fg-2">
        Default markup {settings.pricing.default_markup_pct}% (minimum {settings.pricing.min_markup_pct}%{isAdmin ? "" : ", lower needs admin"}). Client price = operator cost + markup + catering + vehicle + other fees.
      </p>

      {quotes.length === 0 ? (
        <Card><p className="text-sm text-fg-2">No quotes yet. Run the operator search below, or add a quote you received by phone or email.</p></Card>
      ) : (
        <div className="space-y-3">
          {quotes.map((q) => {
            const r = recIds.get(q.id);
            const editable = ["pending_review", "approved", "client_selected"].includes(q.status);
            return (
              <Card key={q.id} padded={false} className={cx(r && canSend && "ring-1 ring-accent/50", q.status === "client_selected" && "ring-2 ring-info/60")}>
                <details className="group" open={q.status === "pending_review" || q.status === "client_selected"}>
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-2 p-4 sm:p-5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {q.option_rank && ["option_sent", "client_selected"].includes(q.status) && <Pill tone="info">Option {q.option_rank}</Pill>}
                        {q.is_replacement && <Pill tone="bad">Replacement</Pill>}
                        <QuoteStatusPill status={q.status as QuoteStatus} />
                        <QuoteSourcePill source={q.source as QuoteSource} model={q.model} />
                        {r && canSend && <Pill tone="accent"><Sparkles className="h-3 w-3" aria-hidden /> AI pick #{r.slot}</Pill>}
                      </div>
                      <p className="mt-2 font-semibold">{q.aircraft_type}{q.year_mfr ? `, ${q.year_mfr}` : ""}{q.tail_number ? ` (${q.tail_number})` : ""}</p>
                      <p className="text-sm text-fg-2">
                        {q.operator_name} · {q.passenger_capacity ? `${q.passenger_capacity} seats` : "seats not stated"} · availability {q.availability}
                        {q.expires_at ? ` · expires ${formatLocal(q.expires_at, trip.o_tz, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : ""}
                      </p>
                      {r && canSend && r.reasons.length > 0 && <p className="mt-1 text-xs text-accent-text">{r.reasons.join(" · ")}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-fg-3">Operator <Money value={q.operator_cost} /> + {Number(q.markup_pct)}%</p>
                      <p className="font-display text-xl font-semibold"><Money value={q.client_price} /></p>
                    </div>
                  </summary>

                  <div className="space-y-4 border-t border-line p-4 sm:p-5">
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-line">
                        <tr><td className="py-1.5 text-fg-2">Operator cost</td><td className="text-right tabular-nums"><Money value={q.operator_cost} /></td></tr>
                        <tr><td className="py-1.5 text-fg-2">Markup {Number(q.markup_pct)}%{q.price_overridden ? " (price override)" : ""}</td><td className="text-right tabular-nums"><Money value={q.markup_amount} /></td></tr>
                        <tr><td className="py-1.5 text-fg-2">Catering</td><td className="text-right tabular-nums"><Money value={q.catering_cost} /></td></tr>
                        <tr><td className="py-1.5 text-fg-2">Vehicle</td><td className="text-right tabular-nums"><Money value={q.vehicle_cost} /></td></tr>
                        <tr><td className="py-1.5 text-fg-2">{q.other_cost_label || "Other approved fees"}</td><td className="text-right tabular-nums"><Money value={q.other_cost} /></td></tr>
                        <tr className="font-semibold"><td className="py-1.5">Client price</td><td className="text-right tabular-nums"><Money value={q.client_price} /></td></tr>
                      </tbody>
                    </table>
                    {q.restrictions && <Notice tone="warn" title="Restrictions">{q.restrictions}</Notice>}
                    {q.model && (
                      <Notice tone="accent" title={`AI extracted${q.confidence != null ? `, ${Math.round(Number(q.confidence) * 100)}% confidence` : ""}`}>
                        {(q.operator_terms as { ambiguities?: string | null })?.ambiguities ?? "Check the numbers against the operator's message before verifying."}
                      </Notice>
                    )}
                    {q.reviewer_name && <p className="text-xs text-fg-3">Verified by {q.reviewer_name}</p>}
                    {notesFor(q.id).map((n) => <p key={n.id} className="text-sm text-fg-2">Note from {n.author_name ?? "staff"}: {n.body}</p>)}

                    {editable && !finished && (
                      <details className="rounded-xl border border-line bg-raised p-4">
                        <summary className="cursor-pointer text-sm font-semibold">Edit pricing and presentation</summary>
                        <ActionForm action={updateQuoteAction.bind(null, trip.id, q.id)} submitLabel="Save quote" className="mt-4">
                          <div className="grid gap-3 sm:grid-cols-3">
                            <Field label="Operator cost"><Input name="operator_cost" inputMode="decimal" defaultValue={Number(q.operator_cost)} /></Field>
                            <Field label="Markup %"><Input name="markup_pct" inputMode="decimal" defaultValue={Number(q.markup_pct)} /></Field>
                            <Field label="Availability">
                              <Select name="availability" defaultValue={q.availability}>
                                {["available", "pending", "unknown", "unavailable"].map((a) => <option key={a} value={a}>{a}</option>)}
                              </Select>
                            </Field>
                            <Field label="Catering"><Input name="catering_cost" inputMode="decimal" defaultValue={Number(q.catering_cost)} /></Field>
                            <Field label="Vehicle"><Input name="vehicle_cost" inputMode="decimal" defaultValue={Number(q.vehicle_cost)} /></Field>
                            <Field label="Other fees"><Input name="other_cost" inputMode="decimal" defaultValue={Number(q.other_cost)} /></Field>
                            <Field label="Other fees label"><Input name="other_cost_label" defaultValue={q.other_cost_label ?? ""} placeholder="e.g. Pet fee" /></Field>
                            <Field label="Seats"><Input name="passenger_capacity" inputMode="numeric" defaultValue={q.passenger_capacity ?? ""} /></Field>
                            <Field label="Quote expires"><Input name="expires_at" type="datetime-local" defaultValue={localInput(q.expires_at)} /></Field>
                          </div>
                          {isAdmin && (
                            <Field label="Admin: set final client price" hint="Markup absorbs the difference. Audited as a price override.">
                              <Input name="client_price_override" inputMode="decimal" placeholder="Leave blank to use markup" />
                            </Field>
                          )}
                          <Field label="Client headline"><Input name="headline" defaultValue={q.headline ?? q.aircraft_type} /></Field>
                          <Field label="Highlights shown to the client" hint="One per line"><Textarea name="highlights" defaultValue={(q.highlights ?? []).join("\n")} /></Field>
                        </ActionForm>
                      </details>
                    )}

                    {["pending_review", "rejected"].includes(q.status) && !finished && (
                      <ActionForm action={reviewQuoteAction.bind(null, trip.id, q.id, "approved")} submitLabel="Verify quote" inline>
                        <Input name="note" placeholder="Optional note (e.g. confirmed by phone)" className="max-w-sm" aria-label="Verification note" />
                      </ActionForm>
                    )}
                    {["pending_review", "approved"].includes(q.status) && !finished && (
                      <ActionForm action={reviewQuoteAction.bind(null, trip.id, q.id, "rejected")} submitLabel="Reject" variant="ghost" inline>
                        <Input name="note" placeholder="Reason" className="max-w-sm" aria-label="Rejection reason" />
                      </ActionForm>
                    )}
                  </div>
                </details>
              </Card>
            );
          })}
        </div>
      )}

      {canSend && (
        <Card className="border-accent/40">
          <h3 className="font-display text-lg font-semibold">{replacementMode ? "Send replacement options" : "Send options to the client"}</h3>
          <p className="mt-1 text-sm text-fg-2">
            Up to three verified quotes. The client sees aircraft, seats, highlights and the client price, marked as estimates until confirmed.
            {rec.length > 0 && " Slots are prefilled with the AI's picks; change them freely."}
          </p>
          {sendable.length === 0 ? (
            <p className="mt-3 text-sm text-warn">Verify at least one {replacementMode ? "replacement " : ""}quote first.</p>
          ) : (
            <ActionForm action={sendOptionsAction.bind(null, trip.id)} submitLabel={replacementMode ? "Send replacement options" : "Send options"} className="mt-4"
              confirm="Send these options to the client now?">
              <div className="grid gap-3 sm:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <Field key={i} label={`Option ${i + 1}`}>
                    <Select name={`option_${i + 1}`} defaultValue={slotDefault(i)}>
                      <option value="">None</option>
                      {sendable.map((q) => <option key={q.id} value={q.id}>{q.aircraft_type} · {q.operator_name} · ${Number(q.client_price).toLocaleString()}</option>)}
                    </Select>
                  </Field>
                ))}
              </div>
              <Field label="Message to the client (optional)" hint="Leave blank for the standard message.">
                <Textarea name="message" placeholder="We found three aircraft options for your requested trip..." />
              </Field>
            </ActionForm>
          )}
        </Card>
      )}

      {!finished && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h3 className="font-display text-lg font-semibold">Add a manual quote</h3>
            <p className="mt-1 text-sm text-fg-2">For operators without email or API integration. Marked as manually entered and treated as verified.</p>
            <ActionForm action={addQuoteAction.bind(null, trip.id)} submitLabel="Add quote" resetOnSuccess className="mt-4">
              <OperatorPicker operators={operators} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Aircraft type"><Input name="aircraft_type" required placeholder="Gulfstream G450" /></Field>
                <Field label="Class">
                  <Select name="aircraft_category" defaultValue={trip.aircraft_category ?? ""}>
                    <option value="">Not set</option>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{AIRCRAFT_CATEGORY_LABELS[c]}</option>)}
                  </Select>
                </Field>
                <Field label="Seats"><Input name="passenger_capacity" inputMode="numeric" /></Field>
                <Field label="Tail number"><Input name="tail_number" /></Field>
                <Field label="Year"><Input name="year_mfr" inputMode="numeric" /></Field>
                <Field label="Availability">
                  <Select name="availability" defaultValue="available">
                    {["available", "pending", "unknown", "unavailable"].map((a) => <option key={a} value={a}>{a}</option>)}
                  </Select>
                </Field>
                <Field label="Operator price (all-in)"><Input name="operator_cost" inputMode="decimal" required placeholder="20000" /></Field>
                <Field label="Markup %" hint={`Blank = ${settings.pricing.default_markup_pct}%`}><Input name="markup_pct" inputMode="decimal" /></Field>
                {trip.catering_required && <Field label="Catering price"><Input name="catering_cost" inputMode="decimal" defaultValue={settings.pricing.catering_default || ""} /></Field>}
                {trip.vehicle_required && <Field label="Vehicle price"><Input name="vehicle_cost" inputMode="decimal" defaultValue={settings.pricing.vehicle_default || ""} /></Field>}
                <Field label="Other fees"><Input name="other_cost" inputMode="decimal" /></Field>
                <Field label="Other fees label"><Input name="other_cost_label" /></Field>
                <Field label="Quote expires"><Input name="expires_at" type="datetime-local" /></Field>
              </div>
              <Field label="Restrictions"><Input name="restrictions" placeholder="Curfew, pets, luggage limits..." /></Field>
              <Field label="Internal note"><Input name="notes" /></Field>
            </ActionForm>
          </Card>
          <Card>
            <h3 className="font-display text-lg font-semibold">Paste an operator quote</h3>
            <p className="mt-1 text-sm text-fg-2">Paste a message or call notes. AI extracts aircraft, availability, price, restrictions and fees into a quote pending your review.</p>
            <ActionForm action={pasteQuoteAction.bind(null, trip.id)} submitLabel="Extract with AI" pendingLabel="Reading..." resetOnSuccess className="mt-4">
              <OperatorPicker operators={operators} />
              <Field label="Operator's message">
                <Textarea name="text" rows={8} required placeholder="G450 available for your requested date. Charter price is $20,000. Catering additional. Vehicle available through our preferred provider." />
              </Field>
            </ActionForm>
          </Card>
        </div>
      )}
    </section>
  );
}

function OperatorPicker({ operators }: { operators: { id: string; name: string; network_status: string }[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Operator" hint="Approved, preferred, and operators already on this trip">
        <Select name="operator_id" defaultValue="">
          <option value="">New operator...</option>
          {operators.map((o) => <option key={o.id} value={o.id}>{o.name}{o.network_status === "preferred" ? " (preferred)" : o.network_status === "prospect" ? " (prospect)" : ""}</option>)}
        </Select>
      </Field>
      <Field label="Or new operator name" hint="Added as a prospect for admin approval"><Input name="new_operator_name" placeholder="ABC Aviation" /></Field>
    </div>
  );
}
