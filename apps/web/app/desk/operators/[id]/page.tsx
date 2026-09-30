import Link from "next/link";
import { notFound } from "next/navigation";
import { AIRCRAFT_CATEGORY_LABELS, QUOTE_SOURCE_LABELS, type AircraftCategory, type QuoteSource, type QuoteStatus } from "@jlaero/shared";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/trips/access";
import { ActionForm } from "@/components/lux/ActionForm";
import { Card, Field, Input, Money, PageHeader, Pill, SectionTitle, Stat, Textarea } from "@/components/lux/ui";
import { QuoteStatusPill } from "@/components/lux/status";
import { Table, Td, shortDate, shortDateTime } from "../../_lib/table";
import { addContact, addOperatorNote, contactAction, removeAircraft, saveAircraft, updateOperator } from "../actions";
import { AircraftFields, NETWORK_LABELS, networkTone, OperatorFields } from "../fields";

function hours(ms: number | null) {
  if (ms == null) return "No replies yet";
  const h = ms / 3600000;
  return h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${h.toFixed(1)} h` : `${Math.round(h / 24)} days`;
}

export default async function DeskOperator({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff("broker");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sql = db();
  const [op] = await sql`select * from operators where id = ${id}`;
  if (!op) notFound();

  const [contacts, aircraft, faaFleet, quotes, statRows, notes] = await Promise.all([
    sql`select * from operator_contacts where operator_id = ${id} order by is_primary desc, created_at`,
    sql`select * from operator_aircraft where operator_id = ${id} order by aircraft_type, tail_number`,
    sql`select n_number, model, category, seats, year_mfr from registry_aircraft where operator_id = ${id} order by model limit 50`,
    sql`select q.id, q.aircraft_type, q.operator_cost, q.client_price, q.currency, q.status, q.source, q.model, q.created_at,
               t.id as trip_id, t.trip_number
        from trip_quotes q join trips t on t.id = q.trip_id where q.operator_id = ${id} order by q.created_at desc limit 50`,
    // Response tracking: RFQ outcomes and time to first inbound reply.
    sql`select count(*) filter (where r.sent_at is not null)::int as sent,
               count(*) filter (where r.status in ('replied', 'quoted', 'declined'))::int as replied,
               count(*) filter (where r.status = 'quoted')::int as quoted,
               count(*) filter (where r.status = 'declined')::int as declined,
               count(*) filter (where r.status = 'no_response')::int as no_response,
               avg(extract(epoch from (m.first_reply - r.sent_at)) * 1000) as avg_ms
        from rfq_recipients r
        left join lateral (select min(received_at) as first_reply from rfq_messages x where x.recipient_id = r.id and x.direction = 'inbound') m on true
        where r.operator_id = ${id}`,
    sql`select n.*, p.full_name as author from staff_notes n left join profiles p on p.id = n.author_id
        where n.target_type = 'operator' and n.target_id = ${id} order by n.created_at desc`,
  ]);
  const stats = statRows[0]!;

  return (
    <>
      <PageHeader
        eyebrow={<Link href="/desk/operators" className="hover:underline">Operators</Link>}
        title={op.name}
        subtitle={[op.certificate_number && `Certificate ${op.certificate_number}`, [op.hq_city, op.hq_state].filter(Boolean).join(", "), op.website].filter(Boolean).join(" · ")}
        actions={<Pill tone={networkTone[op.network_status] ?? "neutral"}>{NETWORK_LABELS[op.network_status]}</Pill>}
      />

      <div className="mb-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="RFQs sent" value={stats.sent} />
        <Stat label="Replied" value={stats.replied} />
        <Stat label="Quoted" value={stats.quoted} />
        <Stat label="Declined" value={stats.declined} />
        <Stat label="No response" value={stats.no_response} />
        <Stat label="Avg first reply" value={<span className="text-lg">{hours(stats.avg_ms == null ? null : Number(stats.avg_ms))}</span>} />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-8">
          <section>
            <SectionTitle>Operator information</SectionTitle>
            <Card>
              <ActionForm action={updateOperator} submitLabel="Save operator">
                <input type="hidden" name="operatorId" value={op.id} />
                <OperatorFields op={op} />
                <div className="grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
                  <Field label="Search priority" htmlFor="op-priority" hint="Higher is searched first among approved operators (-100 to 100).">
                    <Input id="op-priority" name="search_priority" type="number" min={-100} max={100} defaultValue={op.search_priority} />
                  </Field>
                  <fieldset className="space-y-2">
                    <legend className="mb-1.5 text-sm font-medium">Integration</legend>
                    {[["email_integration", "Email RFQs"], ["api_available", "Operator API"], ["website_integration", "Website quoting"]].map(([k, l]) => (
                      <label key={k} className="flex min-h-[32px] items-center gap-2 text-sm text-fg-2">
                        <input type="checkbox" name={k} defaultChecked={Boolean(op[k!])} className="h-4 w-4 accent-[var(--accent)]" />{l}
                      </label>
                    ))}
                  </fieldset>
                  <Field label="Integration notes" htmlFor="op-int" className="sm:col-span-2" hint="Portal logins live in the password manager, never here.">
                    <Textarea id="op-int" name="integration_notes" rows={2} defaultValue={op.integration_notes ?? ""} />
                  </Field>
                  <Field label="Notes" htmlFor="op-notes" className="sm:col-span-2"><Textarea id="op-notes" name="notes" rows={3} defaultValue={op.notes ?? ""} /></Field>
                </div>
              </ActionForm>
            </Card>
          </section>

          <section id="aircraft">
            <SectionTitle>Aircraft</SectionTitle>
            <div className="space-y-3">
              {aircraft.map((a) => (
                <details key={a.id} className="rounded-2xl border border-line bg-surface">
                  <summary className="flex min-h-[56px] cursor-pointer flex-wrap items-center gap-3 px-5 py-3">
                    <span className="font-semibold">{a.aircraft_type}</span>
                    {a.tail_number && <span className="font-mono text-xs text-fg-2">{a.tail_number}</span>}
                    {a.category && <span className="text-sm text-fg-2">{AIRCRAFT_CATEGORY_LABELS[a.category as AircraftCategory]}</span>}
                    {a.passenger_capacity && <span className="text-sm text-fg-2">{a.passenger_capacity} seats</span>}
                    {a.home_base_icao && <span className="font-mono text-xs text-fg-2">{a.home_base_icao}</span>}
                    <Pill tone={a.availability_status === "available" ? "ok" : ["maintenance", "unavailable"].includes(a.availability_status) ? "bad" : "neutral"}>{a.availability_status}</Pill>
                  </summary>
                  <div className="border-t border-line px-5 py-4">
                    <ActionForm action={saveAircraft} submitLabel="Save aircraft">
                      <input type="hidden" name="operatorId" value={op.id} /><input type="hidden" name="aircraftId" value={a.id} />
                      <AircraftFields ac={a} prefix={`ac-${a.id.slice(0, 8)}`} />
                    </ActionForm>
                    <div className="mt-3 border-t border-line pt-3">
                      <ActionForm action={removeAircraft} submitLabel="Remove aircraft" variant="ghost" confirm={`Remove ${a.aircraft_type} from this operator?`} inline>
                        <input type="hidden" name="aircraftId" value={a.id} />
                      </ActionForm>
                    </div>
                  </div>
                </details>
              ))}
              <Card>
                <p className="mb-3 font-semibold">Add aircraft</p>
                <ActionForm action={saveAircraft} submitLabel="Add aircraft" resetOnSuccess>
                  <input type="hidden" name="operatorId" value={op.id} />
                  <AircraftFields ac={null} prefix="ac-new" />
                </ActionForm>
              </Card>
              {faaFleet.length > 0 && (
                <details className="rounded-2xl border border-line bg-surface px-5 py-3">
                  <summary className="min-h-[36px] cursor-pointer text-sm font-semibold">FAA registry fleet on this certificate ({faaFleet.length}{faaFleet.length === 50 ? "+" : ""})</summary>
                  <ul className="mt-2 grid gap-1 text-sm text-fg-2 sm:grid-cols-2">
                    {faaFleet.map((f) => <li key={f.n_number}><span className="font-mono">{f.n_number}</span> {f.model}{f.seats ? `, ${f.seats} seats` : ""}{f.year_mfr ? `, ${f.year_mfr}` : ""}</li>)}
                  </ul>
                </details>
              )}
            </div>
          </section>

          <section>
            <SectionTitle>Quote history</SectionTitle>
            {quotes.length === 0 ? <p className="text-sm text-fg-3">No quotes from this operator yet.</p> : (
              <Table head={["Trip", "Aircraft", "Operator cost", "Client price", "Source", "Status", "Date"]}>
                {quotes.map((q) => (
                  <tr key={q.id}>
                    <Td><Link href={`/desk/trips/${q.trip_id}`} className="font-semibold hover:underline">{q.trip_number}</Link></Td>
                    <Td>{q.aircraft_type}</Td>
                    <Td><Money value={q.operator_cost} currency={q.currency} /></Td>
                    <Td><Money value={q.client_price} currency={q.currency} /></Td>
                    <Td className="text-xs">{q.source === "manual" ? "Manual" : `${QUOTE_SOURCE_LABELS[q.source as QuoteSource]}${q.model ? " (AI)" : ""}`}</Td>
                    <Td><QuoteStatusPill status={q.status as QuoteStatus} /></Td>
                    <Td className="whitespace-nowrap">{shortDate(q.created_at)}</Td>
                  </tr>
                ))}
              </Table>
            )}
          </section>
        </div>

        <aside className="space-y-8">
          <section>
            <SectionTitle>Contacts</SectionTitle>
            <Card>
              {contacts.length === 0 ? <p className="text-sm text-fg-3">No contacts yet. RFQs go to the charter email above if set.</p> : (
                <ul className="divide-y divide-line">
                  {contacts.map((c) => (
                    <li key={c.id} className="py-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{c.full_name || c.email}</span>
                        {c.is_primary && <Pill tone="accent">Primary</Pill>}
                        {c.unsubscribed_at && <Pill tone="bad">Unsubscribed</Pill>}
                        {c.bounced_at && <Pill tone="warn">Bounced</Pill>}
                      </div>
                      <p className="break-all text-fg-2">{c.email}</p>
                      <p className="text-xs text-fg-3">{[c.role, c.phone].filter(Boolean).join(" · ")}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {!c.is_primary && !c.unsubscribed_at && (
                          <ActionForm action={contactAction} submitLabel="Make primary" variant="secondary" inline submitClassName="min-h-[36px] px-3 text-xs">
                            <input type="hidden" name="contactId" value={c.id} /><input type="hidden" name="op" value="primary" />
                          </ActionForm>
                        )}
                        {!c.unsubscribed_at && (
                          <ActionForm action={contactAction} submitLabel="Remove" variant="ghost" inline confirm="Remove this contact?" submitClassName="min-h-[36px] px-3 text-xs">
                            <input type="hidden" name="contactId" value={c.id} /><input type="hidden" name="op" value="remove" />
                          </ActionForm>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 border-t border-line pt-4">
                <ActionForm action={addContact} submitLabel="Add contact" resetOnSuccess>
                  <input type="hidden" name="operatorId" value={op.id} />
                  <Field label="Email" htmlFor="ct-email"><Input id="ct-email" name="email" type="email" required /></Field>
                  <Field label="Name" htmlFor="ct-name"><Input id="ct-name" name="full_name" /></Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Role" htmlFor="ct-role"><Input id="ct-role" name="role" placeholder="Charter sales" /></Field>
                    <Field label="Phone" htmlFor="ct-phone"><Input id="ct-phone" name="phone" type="tel" /></Field>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-fg-2"><input type="checkbox" name="is_primary" className="h-4 w-4 accent-[var(--accent)]" />Primary contact for RFQs</label>
                </ActionForm>
              </div>
            </Card>
          </section>

          <section>
            <SectionTitle>Staff notes</SectionTitle>
            <Card>
              <ActionForm action={addOperatorNote} submitLabel="Add note" resetOnSuccess>
                <input type="hidden" name="operatorId" value={op.id} />
                <Field label="New note" htmlFor="op-note"><Textarea id="op-note" name="body" /></Field>
              </ActionForm>
              <ul className="mt-4 divide-y divide-line">
                {notes.map((n) => (
                  <li key={n.id} className="py-3 text-sm">
                    <p className="whitespace-pre-wrap">{n.body}</p>
                    <p className="mt-1 text-xs text-fg-3">{n.author ?? "Staff"}, {shortDateTime(n.created_at)}</p>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        </aside>
      </div>
    </>
  );
}
