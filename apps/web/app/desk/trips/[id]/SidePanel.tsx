// Right column: client, editable trip details, broker assignment, notes and
// the full timeline (spec s23 trip management; blueprint s30 audit).
import Link from "next/link";
import { AIRCRAFT_CATEGORIES, AIRCRAFT_CATEGORY_LABELS, formatLocal, TRIP_STATUS_LABELS, type TripStatus } from "@jlaero/shared";
import { ActionForm } from "@/components/lux/ActionForm";
import { TripStatusPill } from "@/components/lux/status";
import { Card, DefinitionList, Field, Input, Select, Textarea } from "@/components/lux/ui";
import { addNoteAction, assignBrokerAction, updateTripAction } from "./actions";
import type { DeskTrip } from "./data";

const CATEGORIES = AIRCRAFT_CATEGORIES.filter((c) => !["airliner", "helicopter"].includes(c));
const short = (d: Date | string) => formatLocal(d, null, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function SidePanel({ data, isBroker }: { data: DeskTrip; isBroker: boolean }) {
  const { trip, brokers, notes, events, clientTrips } = data;
  const editable = isBroker && !["completed", "feedback_requested", "closed", "cancelled"].includes(trip.status);
  const date = (d: Date | string | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");
  const time = (t: string | null) => (t ? String(t).slice(0, 5) : "");

  return (
    <aside className="space-y-4">
      <Card>
        <p className="text-xs font-semibold uppercase tracking-wider text-fg-3">Client</p>
        <Link href={`/desk/clients/${trip.client_id}`} className="mt-1 block font-display text-lg font-semibold hover:text-accent-text">{trip.client_name}</Link>
        <DefinitionList className="mt-2" items={[
          ["Company", trip.client_company ?? "None"],
          ["Email", <a key="e" href={`mailto:${trip.client_email}`} className="underline">{trip.client_email}</a>],
          ["Phone", trip.client_phone ? <a key="p" href={`tel:${trip.client_phone}`} className="underline">{trip.client_phone}</a> : "Not given"],
          ["Prefers", trip.preferred_contact_method],
          ["First time private", trip.first_time_flyer == null ? "Not asked" : trip.first_time_flyer ? "Yes" : "No"],
          ["App account", trip.client_user_id ? "Yes" : "No (email only)"],
        ]} />
        {clientTrips.length > 0 && (
          <div className="mt-3 border-t border-line pt-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-fg-3">Other trips</p>
            <ul className="mt-2 space-y-1.5 text-sm">
              {clientTrips.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2">
                  <Link href={`/desk/trips/${t.id}`} className="hover:text-accent-text">{t.trip_number} · {t.origin_icao}-{t.destination_icao}</Link>
                  <TripStatusPill status={t.status as TripStatus} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Card>
        <p className="text-xs font-semibold uppercase tracking-wider text-fg-3">Broker</p>
        {isBroker ? (
          <ActionForm action={assignBrokerAction.bind(null, trip.id)} submitLabel="Assign" variant="secondary" inline className="mt-2">
            <Select name="broker_id" defaultValue={trip.broker_id ?? ""} aria-label="Assigned broker" className="min-w-0 flex-1">
              <option value="">Unassigned</option>
              {brokers.map((b) => <option key={b.id} value={b.id}>{b.full_name ?? "Unnamed"}</option>)}
            </Select>
          </ActionForm>
        ) : <p className="mt-1">{trip.broker_name ?? "Unassigned"}</p>}
      </Card>

      {editable && (
        <Card padded={false}>
          <details>
            <summary className="cursor-pointer p-5 font-semibold">Edit trip details</summary>
            <div className="border-t border-line p-5">
              <ActionForm action={updateTripAction.bind(null, trip.id)} submitLabel="Save details">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="From (ICAO)"><Input name="origin" defaultValue={trip.origin_icao} required /></Field>
                  <Field label="To (ICAO)"><Input name="destination" defaultValue={trip.destination_icao} required /></Field>
                  <Field label="Departure date"><Input name="departure_date" type="date" defaultValue={date(trip.departure_date)} required /></Field>
                  <Field label="Time (local)"><Input name="departure_time" type="time" defaultValue={time(trip.departure_time)} /></Field>
                  <Field label="Return date"><Input name="return_date" type="date" defaultValue={date(trip.return_date)} /></Field>
                  <Field label="Time (local)"><Input name="return_time" type="time" defaultValue={time(trip.return_time)} /></Field>
                  <Field label="Passengers"><Input name="passengers" type="number" min={1} max={50} defaultValue={trip.passengers} /></Field>
                  <Field label="Radius (miles)"><Input name="search_radius_miles" type="number" min={1} max={1000} defaultValue={Number(trip.search_radius_miles)} /></Field>
                </div>
                <Field label="Aircraft class">
                  <Select name="aircraft_category" defaultValue={trip.aircraft_category ?? ""}>
                    <option value="">Any suitable</option>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{AIRCRAFT_CATEGORY_LABELS[c]}</option>)}
                  </Select>
                </Field>
                <Field label="Specific aircraft"><Input name="aircraft_preference" defaultValue={trip.aircraft_preference ?? ""} /></Field>
                <div className="flex gap-5 text-sm">
                  <label className="flex items-center gap-2"><input type="checkbox" name="catering_required" defaultChecked={trip.catering_required} className="h-4 w-4" /> Catering</label>
                  <label className="flex items-center gap-2"><input type="checkbox" name="vehicle_required" defaultChecked={trip.vehicle_required} className="h-4 w-4" /> Vehicle</label>
                </div>
                <Field label="Special requests"><Textarea name="special_requests" defaultValue={trip.special_requests ?? ""} /></Field>
              </ActionForm>
            </div>
          </details>
        </Card>
      )}

      <Card>
        <p className="text-xs font-semibold uppercase tracking-wider text-fg-3">Internal notes</p>
        {isBroker && (
          <ActionForm action={addNoteAction.bind(null, trip.id)} submitLabel="Add note" variant="secondary" resetOnSuccess className="mt-2">
            <Textarea name="body" rows={2} aria-label="Note" placeholder="Never visible to the client" />
          </ActionForm>
        )}
        <ul className="mt-3 space-y-3 text-sm">
          {notes.map((n) => (
            <li key={n.id}>
              <p className="whitespace-pre-wrap">{n.body}</p>
              <p className="text-xs text-fg-3">{n.author_name ?? "Staff"} · {short(n.created_at)}</p>
            </li>
          ))}
          {!notes.length && <li className="text-fg-3">No notes yet.</li>}
        </ul>
      </Card>

      <Card>
        <p className="text-xs font-semibold uppercase tracking-wider text-fg-3">Timeline</p>
        <ol className="mt-3 space-y-3 border-l border-line pl-4 text-sm">
          {events.map((e) => (
            <li key={e.id} className="relative">
              <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-line-strong" aria-hidden />
              <p>
                {e.kind === "status"
                  ? <>{e.from_status ? `${TRIP_STATUS_LABELS[e.from_status as TripStatus]} → ` : ""}<strong>{TRIP_STATUS_LABELS[e.to_status as TripStatus]}</strong></>
                  : e.message}
              </p>
              <p className="text-xs text-fg-3">
                {e.actor_name ?? (e.kind === "ai" ? "AI" : e.actor_id ? "Client" : "System")} · {short(e.created_at)}{e.client_visible ? " · client sees this" : ""}
              </p>
            </li>
          ))}
        </ol>
      </Card>
    </aside>
  );
}
