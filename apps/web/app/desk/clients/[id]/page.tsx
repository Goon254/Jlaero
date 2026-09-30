import Link from "next/link";
import { notFound } from "next/navigation";
import { Star } from "lucide-react";
import { formatLocal } from "@jlaero/shared";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/trips/access";
import { ActionForm } from "@/components/lux/ActionForm";
import { Card, Field, Input, Money, PageHeader, Pill, SectionTitle, Select, Textarea } from "@/components/lux/ui";
import { TripStatusPill } from "@/components/lux/status";
import { Table, Td, shortDate, shortDateTime } from "../../_lib/table";
import { addClientNote, updateClient } from "../actions";

export default async function DeskClient({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaff("broker");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sql = db();
  const [c] = await sql`select c.*, u.email as account_email from clients c left join auth.users u on u.id = c.user_id where c.id = ${id}`;
  if (!c) notFound();

  const trips = await sql`
    select t.id, t.trip_number, t.status, t.depart_at, t.origin_icao, t.destination_icao, t.passengers, t.source, t.created_at,
           a.tz, q.client_price, q.currency, q.aircraft_type
    from trips t join airports a on a.icao = t.origin_icao left join trip_quotes q on q.id = t.selected_quote_id
    where t.client_id = ${id} order by t.depart_at desc`;
  const notes = await sql`select n.*, p.full_name as author from staff_notes n left join profiles p on p.id = n.author_id
    where n.target_type = 'client' and n.target_id = ${id} order by n.created_at desc`;
  const feedback = await sql`select f.*, t.trip_number from trip_feedback f join trips t on t.id = f.trip_id where f.client_id = ${id} order by f.created_at desc`;
  const prefs = Object.entries((c.preferences ?? {}) as Record<string, string>).map(([k, v]) => `${k}: ${v}`).join("\n");
  const booked = trips.filter((t) => !["new_request", "searching", "quotes_received", "broker_review", "options_sent", "cancelled"].includes(t.status));
  const spend = booked.reduce((s, t) => s + Number(t.client_price ?? 0), 0);

  return (
    <>
      <PageHeader
        eyebrow={<Link href="/desk/clients" className="hover:underline">Clients</Link>}
        title={c.full_name}
        subtitle={[c.company_name, c.email, c.phone].filter(Boolean).join(" · ")}
        actions={<>{c.user_id ? <Pill tone="ok">App account</Pill> : <Pill>Email only, no account yet</Pill>}{c.first_time_private_flyer && <Pill tone="accent">First time flying private</Pill>}</>}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-8">
          <section>
            <SectionTitle>Trip history</SectionTitle>
            <p className="mb-3 text-sm text-fg-2">{trips.length} request{trips.length === 1 ? "" : "s"}, {booked.length} booked, <Money value={spend} /> booked value.</p>
            {trips.length === 0 ? <p className="text-sm text-fg-3">No trips yet.</p> : (
              <Table head={["Trip", "Route", "Departure", "Pax", "Aircraft", "Price", "Status"]}>
                {trips.map((t) => (
                  <tr key={t.id} className="hover:bg-raised">
                    <Td><Link href={`/desk/trips/${t.id}`} className="font-semibold hover:underline">{t.trip_number}</Link><p className="text-xs text-fg-3">{t.source === "email" ? "by email" : `requested ${shortDate(t.created_at)}`}</p></Td>
                    <Td className="font-mono text-xs">{t.origin_icao} to {t.destination_icao}</Td>
                    <Td className="whitespace-nowrap">{formatLocal(t.depart_at, t.tz, { month: "short", day: "numeric", year: "numeric" })}</Td>
                    <Td>{t.passengers}</Td>
                    <Td>{t.aircraft_type ?? ""}</Td>
                    <Td>{t.client_price ? <Money value={t.client_price} currency={t.currency} /> : ""}</Td>
                    <Td><TripStatusPill status={t.status} /></Td>
                  </tr>
                ))}
              </Table>
            )}
          </section>

          <section>
            <SectionTitle>Feedback</SectionTitle>
            {feedback.length === 0 ? <p className="text-sm text-fg-3">No feedback yet.</p> : (
              <div className="space-y-3">
                {feedback.map((f) => (
                  <Card key={f.id}>
                    <div className="flex items-center justify-between gap-3">
                      <Link href={`/desk/trips/${f.trip_id}`} className="font-semibold hover:underline">{f.trip_number}</Link>
                      <span className="inline-flex items-center gap-1 font-semibold" aria-label={`${f.rating} out of 5`}>
                        {f.rating}<Star className="h-4 w-4 fill-current text-accent-text" aria-hidden />
                      </span>
                    </div>
                    {f.comments && <p className="mt-2 text-sm text-fg-2">{f.comments}</p>}
                  </Card>
                ))}
              </div>
            )}
          </section>

          <section>
            <SectionTitle>Staff notes</SectionTitle>
            <Card>
              <ActionForm action={addClientNote} submitLabel="Add note" resetOnSuccess>
                <input type="hidden" name="clientId" value={c.id} />
                <Field label="New note" htmlFor="note-body"><Textarea id="note-body" name="body" placeholder="Visible to staff only" /></Field>
              </ActionForm>
              <ul className="mt-5 divide-y divide-line">
                {notes.map((n) => (
                  <li key={n.id} className="py-3 text-sm">
                    <p className="whitespace-pre-wrap">{n.body}</p>
                    <p className="mt-1 text-xs text-fg-3">{n.author ?? "Staff"}, {shortDateTime(n.created_at)}</p>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        </div>

        <aside>
          <Card>
            <SectionTitle>Contact details</SectionTitle>
            {user.isBroker ? (
              <ActionForm action={updateClient} submitLabel="Save changes">
                <input type="hidden" name="clientId" value={c.id} />
                <Field label="Full name" htmlFor="cl-name"><Input id="cl-name" name="full_name" defaultValue={c.full_name} required /></Field>
                <Field label="Email" htmlFor="cl-email" hint={c.user_id && c.account_email !== c.email ? `App sign-in email: ${c.account_email}` : undefined}><Input id="cl-email" name="email" type="email" defaultValue={c.email} required /></Field>
                <Field label="Phone" htmlFor="cl-phone"><Input id="cl-phone" name="phone" type="tel" defaultValue={c.phone ?? ""} /></Field>
                <Field label="Company" htmlFor="cl-company"><Input id="cl-company" name="company_name" defaultValue={c.company_name ?? ""} /></Field>
                <Field label="Preferred contact" htmlFor="cl-method">
                  <Select id="cl-method" name="preferred_contact_method" defaultValue={c.preferred_contact_method}>
                    <option value="email">Email</option><option value="phone">Phone</option><option value="sms">Text message</option><option value="app">App</option>
                  </Select>
                </Field>
                <Field label="First time flying private?" htmlFor="cl-ftf">
                  <Select id="cl-ftf" name="first_time_private_flyer" defaultValue={c.first_time_private_flyer == null ? "" : c.first_time_private_flyer ? "yes" : "no"}>
                    <option value="">Unknown</option><option value="yes">Yes</option><option value="no">No</option>
                  </Select>
                </Field>
                <Field label="Preferences" htmlFor="cl-prefs" hint="One per line, for example: Catering: vegetarian">
                  <Textarea id="cl-prefs" name="preferences" defaultValue={prefs} rows={4} />
                </Field>
              </ActionForm>
            ) : null}
          </Card>
        </aside>
      </div>
    </>
  );
}
