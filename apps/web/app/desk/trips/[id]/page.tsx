import { notFound } from "next/navigation";
import { AIRCRAFT_CATEGORY_LABELS, BROKER_NEXT_STEP, countdown, formatLocal, type AircraftCategory, type TripStatus } from "@jlaero/shared";
import { ArrowRight } from "lucide-react";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/trips/access";
import { TripStatusPill } from "@/components/lux/status";
import { Card, Eyebrow, Notice, Pill } from "@/components/lux/ui";
import { BookingPanel } from "./BookingPanel";
import { loadDeskTrip } from "./data";
import { OpsPanel } from "./OpsPanel";
import { QuotesPanel } from "./QuotesPanel";
import { SidePanel } from "./SidePanel";
import { SourcingPanel } from "./SourcingPanel";

export const dynamic = "force-dynamic";

// The broker's single view of a trip (spec s31): where the request is, which
// operators were contacted, what came back, how pricing was calculated, what
// the client chose, contract, payment, operator, and the flight.
export default async function DeskTripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await requireStaff("view");
  const data = await loadDeskTrip(id);
  if (!data) notFound();
  const { trip } = data;
  const operators = await db()`select distinct o.id, o.name, o.network_status from operators o
    where o.network_status in ('approved', 'preferred')
       or o.id in (select operator_id from trip_quotes where trip_id = ${id})
       or o.id in (select r.operator_id from rfq_recipients r join rfqs f on f.id = r.rfq_id where f.trip_id = ${id})
    order by o.name limit 500`;

  const status = trip.status as TripStatus;
  const cd = countdown(trip.depart_at);
  const route = `${trip.o_city ?? trip.o_name} (${trip.origin_icao}) to ${trip.d_city ?? trip.d_name} (${trip.destination_icao})`;
  const next = BROKER_NEXT_STEP[status];
  const departs = formatLocal(trip.depart_at, trip.o_tz, { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Eyebrow>{trip.trip_number}</Eyebrow>
          <TripStatusPill status={status} />
          <Pill tone="neutral">via {trip.source}</Pill>
          {!cd.past && cd.hoursTotal <= 72 && !["completed", "closed", "cancelled", "feedback_requested"].includes(status) && <Pill tone="warn">Departs in {cd.hoursTotal}h</Pill>}
        </div>
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">{route}</h1>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-fg-2">
          <span>{departs}</span>
          {trip.return_at && <span>Return {formatLocal(trip.return_at, trip.d_tz, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" })}</span>}
          <span>{trip.passengers} passenger{trip.passengers === 1 ? "" : "s"}</span>
          <span>{trip.aircraft_preference ?? (trip.aircraft_category ? AIRCRAFT_CATEGORY_LABELS[trip.aircraft_category as AircraftCategory] : "Any suitable aircraft")}</span>
          {trip.catering_required && <span>Catering</span>}
          {trip.vehicle_required && <span>Vehicle</span>}
          {trip.first_time_flyer && <span className="text-accent-text">First time flying private</span>}
        </div>
        {trip.special_requests && <p className="max-w-3xl rounded-xl bg-sunken px-4 py-3 text-sm"><span className="font-semibold">Special requests:</span> {trip.special_requests}</p>}
        {trip.missing_info?.length > 0 && <Notice tone="warn" title="AI flagged missing information">{trip.missing_info.join(", ")}</Notice>}
        {status === "cancelled" && <Notice tone="neutral" title="Cancelled">{trip.cancel_reason}</Notice>}
        {next && (
          <Card className="flex items-center gap-3 border-accent/40 bg-accent-soft py-4">
            <ArrowRight className="h-5 w-5 shrink-0 text-accent-text" aria-hidden />
            <p className="text-sm"><span className="font-semibold">Next step:</span> {next}</p>
          </Card>
        )}
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-10">
          <OpsPanel data={data} isBroker={user.isBroker} />
          <BookingPanel data={data} isBroker={user.isBroker} isFinance={user.isFinance} />
          <QuotesPanel data={data} isAdmin={user.isAdmin} operators={operators as never} />
          <SourcingPanel data={data} />
        </div>
        <SidePanel data={data} isBroker={user.isBroker} />
      </div>
    </div>
  );
}
