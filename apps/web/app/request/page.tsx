import Link from "next/link";
import { AIRCRAFT_CATEGORIES, AIRCRAFT_CATEGORY_LABELS } from "@jlaero/shared";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/lux/ActionForm";
import { ClientShell } from "@/components/lux/ClientShell";
import { ButtonLink, Card, Eyebrow, Field, Input, PageHeader, Select, Textarea } from "@/components/lux/ui";
import { requestTrip } from "@/app/trips/_lib/actions";
import { AirportField } from "@/app/trips/_lib/AirportField";
import { YesNo } from "@/app/trips/_lib/fields";

export const metadata = { title: "Request a charter | Jlaero" };

const CATEGORIES = AIRCRAFT_CATEGORIES.filter((c) => !["airliner", "helicopter"].includes(c));

// Trip questionnaire (spec s3 step 2). Submits through create_trip_request.
export default async function RequestPage() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <ClientShell signedIn={false}>
        <PageHeader eyebrow="Request a charter" title="Where would you like to fly?" subtitle="Sign in to request a trip. Your options, agreement, payment and itinerary stay together in one place." />
        <Card className="max-w-xl">
          <p className="text-fg-2">It takes a minute, and your broker can reach you as soon as options are ready.</p>
          <ButtonLink href="/login?next=/request" className="mt-5">Sign in to continue</ButtonLink>
        </Card>
      </ClientShell>
    );
  }
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("full_name, phone, company_name").eq("id", user.id).maybeSingle();
  const { data: client } = await supabase.from("clients").select("full_name, phone, company_name, first_time_private_flyer").eq("user_id", user.id).maybeSingle();
  const name = client?.full_name ?? profile?.full_name ?? "";
  const phone = client?.phone ?? profile?.phone ?? "";
  const company = client?.company_name ?? profile?.company_name ?? "";
  const today = new Date().toISOString().slice(0, 10);

  return (
    <ClientShell>
      <PageHeader
        eyebrow="Request a charter"
        title="Tell us about your trip"
        subtitle="We search certificated operators near your route and send up to three aircraft options with clear, all-in pricing. Your broker verifies every detail before you commit."
      />
      <ActionForm action={requestTrip} submitLabel="Get Charter Options" pendingLabel="Sending your request..." submitClassName="w-full sm:w-auto sm:min-w-[220px]">
        <Card>
          <Eyebrow className="mb-4">Your details</Eyebrow>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" htmlFor="full_name"><Input id="full_name" name="full_name" defaultValue={name} autoComplete="name" required /></Field>
            <Field label="Company (if applicable)" htmlFor="company"><Input id="company" name="company" defaultValue={company} autoComplete="organization" /></Field>
            <Field label="Email" htmlFor="email" hint="From your account. Change it in settings."><Input id="email" value={user.email ?? ""} readOnly aria-readonly className="bg-sunken text-fg-2" /></Field>
            <Field label="Phone" htmlFor="phone"><Input id="phone" name="phone" type="tel" defaultValue={phone} autoComplete="tel" required /></Field>
          </div>
        </Card>

        <Card>
          <Eyebrow className="mb-4">Your trip</Eyebrow>
          <div className="grid gap-4 sm:grid-cols-2">
            <AirportField name="origin" label="Departure" placeholder="Airport code, name or city" required />
            <AirportField name="destination" label="Destination" placeholder="Airport code, name or city" required />
            <Field label="Departure date" htmlFor="departure_date"><Input id="departure_date" name="departure_date" type="date" min={today} required /></Field>
            <Field label="Departure time" htmlFor="departure_time" hint="Local time at the departure airport."><Input id="departure_time" name="departure_time" type="time" required /></Field>
            <Field label="Return date (if round trip)" htmlFor="return_date"><Input id="return_date" name="return_date" type="date" min={today} /></Field>
            <Field label="Return time" htmlFor="return_time" hint="Local time at your destination."><Input id="return_time" name="return_time" type="time" /></Field>
            <Field label="Passengers" htmlFor="passengers"><Input id="passengers" name="passengers" type="number" inputMode="numeric" min={1} max={50} defaultValue={2} required /></Field>
            <Field label="Aircraft type requested" htmlFor="aircraft_category">
              <Select id="aircraft_category" name="aircraft_category" defaultValue="">
                <option value="">No preference, recommend for me</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{AIRCRAFT_CATEGORY_LABELS[c]}</option>)}
              </Select>
            </Field>
            <Field label="Specific aircraft (optional)" htmlFor="aircraft_preference" className="sm:col-span-2" hint="For example Gulfstream G450 or Challenger 350.">
              <Input id="aircraft_preference" name="aircraft_preference" />
            </Field>
          </div>
        </Card>

        <Card>
          <Eyebrow className="mb-4">Services and experience</Eyebrow>
          <div className="grid gap-6 sm:grid-cols-3">
            <YesNo name="vehicle" legend="Vehicle service" hint="Car to or from the aircraft." defaultValue="no" />
            <YesNo name="catering" legend="Catering" defaultValue="no" />
            <YesNo name="first_time" legend="Is this your first time flying private?" defaultValue={client?.first_time_private_flyer === false ? "no" : undefined} />
          </div>
          <Field label="Special requests" htmlFor="special_requests" className="mt-6" hint="Pets, special catering, a specific aircraft or airport, luggage, wheelchair or accessibility needs, anything else we should know.">
            <Textarea id="special_requests" name="special_requests" rows={4} />
          </Field>
        </Card>
      </ActionForm>
      <p className="mt-6 text-sm text-fg-3">
        Already requested a trip? <Link href="/trips" className="font-medium text-accent-text underline-offset-4 hover:underline">View my trips</Link>
      </p>
    </ClientShell>
  );
}
