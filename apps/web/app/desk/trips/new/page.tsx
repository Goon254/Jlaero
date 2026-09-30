import Link from "next/link";
import { AIRCRAFT_CATEGORIES, AIRCRAFT_CATEGORY_LABELS } from "@jlaero/shared";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/trips/access";
import type { ParsedTripRequest } from "@/lib/sourcing/claude";
import { ActionForm } from "@/components/lux/ActionForm";
import { Card, Field, Input, Notice, PageHeader, Select, Textarea } from "@/components/lux/ui";
import { createTripAction } from "../../actions";

const CATEGORIES = AIRCRAFT_CATEGORIES.filter((c) => !["airliner", "helicopter"].includes(c));

// Create a trip by hand, optionally prefilled from an email the AI parsed.
export default async function NewTripPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  await requireStaff("broker");
  const { message } = await searchParams;
  let parsed: Partial<ParsedTripRequest> = {};
  let email: { from_address: string; subject: string; text_body: string } | null = null;
  if (message && /^[0-9a-f-]{36}$/i.test(message)) {
    const [m] = await db()`select from_address, subject, text_body, classification from rfq_messages where id = ${message}`;
    if (m) {
      email = { from_address: m.from_address, subject: m.subject, text_body: m.text_body };
      parsed = ((m.classification as { parsed?: ParsedTripRequest })?.parsed ?? {}) as Partial<ParsedTripRequest>;
    }
  }
  const yn = (v: boolean | null | undefined) => (v == null ? "" : v ? "yes" : "no");

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader eyebrow={<Link href="/desk">Desk</Link>} title="New trip" subtitle="For requests taken by phone or email. Creates the same trip record as an app request." />
      {email && (
        <Card className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-fg-3">From email</p>
          <p className="mt-1 font-semibold">{email.subject}</p>
          <p className="text-sm text-fg-2">{email.from_address}</p>
          <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap rounded-xl bg-sunken p-3 text-xs">{email.text_body}</pre>
          {(parsed.missing_information?.length ?? 0) > 0 && <div className="mt-3"><Notice tone="warn" title="AI says this is missing">{parsed.missing_information!.join(", ")}</Notice></div>}
        </Card>
      )}
      <Card>
        <ActionForm action={createTripAction} submitLabel="Create trip">
          {message && <input type="hidden" name="message_id" value={message} />}
          <input type="hidden" name="source" value={email ? "email" : "phone"} />
          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-2 font-display text-lg font-semibold">Client</legend>
            <Field label="Full name"><Input name="full_name" required defaultValue={parsed.client_name ?? ""} /></Field>
            <Field label="Email"><Input name="email" type="email" required defaultValue={email?.from_address ?? ""} /></Field>
            <Field label="Phone"><Input name="phone" type="tel" defaultValue={parsed.phone ?? ""} /></Field>
            <Field label="Company"><Input name="company_name" defaultValue={parsed.company_name ?? ""} /></Field>
            <Field label="First time flying private?">
              <Select name="first_time" defaultValue={yn(parsed.first_time_flyer)}><option value="">Not asked</option><option value="yes">Yes</option><option value="no">No</option></Select>
            </Field>
          </fieldset>
          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-2 mt-4 font-display text-lg font-semibold">Trip</legend>
            <Field label="From (ICAO)" hint={parsed.origin ? `Client wrote: ${parsed.origin}` : undefined}><Input name="origin" required defaultValue={parsed.origin_icao_guess ?? ""} placeholder="KTEB" /></Field>
            <Field label="To (ICAO)" hint={parsed.destination ? `Client wrote: ${parsed.destination}` : undefined}><Input name="destination" required defaultValue={parsed.destination_icao_guess ?? ""} placeholder="KMIA" /></Field>
            <Field label="Departure date"><Input name="departure_date" type="date" required defaultValue={parsed.departure_date ?? ""} /></Field>
            <Field label="Departure time (local)"><Input name="departure_time" type="time" defaultValue={parsed.departure_time ?? ""} /></Field>
            <Field label="Return date"><Input name="return_date" type="date" defaultValue={parsed.return_date ?? ""} /></Field>
            <Field label="Return time (local)"><Input name="return_time" type="time" defaultValue={parsed.return_time ?? ""} /></Field>
            <Field label="Passengers"><Input name="passengers" type="number" min={1} max={50} required defaultValue={parsed.passengers ?? ""} /></Field>
            <Field label="Aircraft class">
              <Select name="aircraft_category" defaultValue={parsed.aircraft_category ?? ""}>
                <option value="">Any suitable</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{AIRCRAFT_CATEGORY_LABELS[c]}</option>)}
              </Select>
            </Field>
            <Field label="Specific aircraft" className="sm:col-span-2"><Input name="aircraft_preference" defaultValue={parsed.aircraft_type ?? ""} /></Field>
          </fieldset>
          <div className="flex flex-wrap gap-6 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" name="catering_required" defaultChecked={Boolean(parsed.catering_required)} className="h-4 w-4" /> Catering</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="vehicle_required" defaultChecked={Boolean(parsed.vehicle_required)} className="h-4 w-4" /> Vehicle service</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="notify_client" defaultChecked className="h-4 w-4" /> Email the client a confirmation</label>
          </div>
          <Field label="Special requests"><Textarea name="special_requests" defaultValue={parsed.special_requests ?? ""} placeholder="Pets, luggage, accessibility, specific airport..." /></Field>
        </ActionForm>
      </Card>
    </div>
  );
}
