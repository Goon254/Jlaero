// Everything the broker workspace shows for one trip (spec s31: full
// visibility from request to feedback). Service connection; callers have
// already passed requireStaff.
import { db } from "@/lib/db";
import { getSettings } from "@/lib/trips/core";

export async function loadDeskTrip(tripId: string) {
  const sql = db();
  const [trip] = await sql`
    select t.*, c.full_name as client_name, c.email as client_email, c.phone as client_phone, c.company_name as client_company,
           c.user_id as client_user_id, c.first_time_private_flyer, c.preferred_contact_method,
           o.name as o_name, o.municipality as o_city, o.tz as o_tz, o.latitude as o_lat, o.longitude as o_lon,
           d.name as d_name, d.municipality as d_city, d.tz as d_tz, d.latitude as d_lat, d.longitude as d_lon,
           b.full_name as broker_name
    from trips t
    join clients c on c.id = t.client_id
    join airports o on o.icao = t.origin_icao
    join airports d on d.icao = t.destination_icao
    left join profiles b on b.id = t.broker_id
    where t.id = ${tripId}`;
  if (!trip) return null;

  const [quotes, rfqs, recipients, contracts, payments, operatorPayments, bookings, opItins, clientItins, issues, events, notes, feedback, brokers, settings, clientTrips] = await Promise.all([
    sql`select q.*, op.name as operator_name, op.network_status, op.general_email as operator_email, op.phone as operator_phone,
          r.full_name as reviewer_name
        from trip_quotes q join operators op on op.id = q.operator_id
        left join profiles r on r.id = q.reviewed_by
        where q.trip_id = ${tripId} order by q.is_replacement desc, q.option_rank nulls last, q.created_at desc`,
    sql`select * from rfqs where trip_id = ${tripId} order by round desc`,
    sql`select r.*, o.name as operator_name, o.network_status, f.round, f.purpose,
          (select count(*)::int from rfq_messages m where m.recipient_id = r.id and m.direction = 'inbound') as replies,
          (select max(received_at) from rfq_messages m where m.recipient_id = r.id and m.direction = 'inbound') as last_reply_at
        from rfq_recipients r join rfqs f on f.id = r.rfq_id join operators o on o.id = r.operator_id
        where f.trip_id = ${tripId} order by f.round desc, r.status, o.name`,
    sql`select c.*, p.full_name as created_by_name from trip_contracts c left join profiles p on p.id = c.created_by
        where c.trip_id = ${tripId} order by c.created_at desc`,
    sql`select p.*, v.full_name as verified_by_name from trip_payments p left join profiles v on v.id = p.verified_by
        where p.trip_id = ${tripId} order by p.created_at desc`,
    sql`select p.*, o.name as operator_name, r.full_name as recorded_by_name from operator_payments p
        join operators o on o.id = p.operator_id left join profiles r on r.id = p.recorded_by
        where p.trip_id = ${tripId} order by p.created_at desc`,
    sql`select b.*, o.name as operator_name from operator_bookings b join operators o on o.id = b.operator_id
        where b.trip_id = ${tripId} order by b.created_at desc`,
    sql`select i.*, p.full_name as uploaded_by_name from operator_itineraries i left join profiles p on p.id = i.uploaded_by
        where i.trip_id = ${tripId} order by i.received_at desc`,
    sql`select * from client_itineraries where trip_id = ${tripId} order by version desc`,
    sql`select i.*, p.full_name as reporter_name from trip_issues i left join profiles p on p.id = i.reported_by
        where i.trip_id = ${tripId} order by i.created_at desc`,
    sql`select e.*, p.full_name as actor_name from trip_events e left join profiles p on p.id = e.actor_id
        where e.trip_id = ${tripId} order by e.created_at desc limit 200`,
    sql`select n.*, p.full_name as author_name from staff_notes n left join profiles p on p.id = n.author_id
        where n.target_type = 'trip' and n.target_id = ${tripId} order by n.created_at desc`,
    sql`select * from trip_feedback where trip_id = ${tripId}`,
    sql`select distinct p.id, p.full_name from user_roles r join profiles p on p.id = r.user_id
        where r.role::text in ('admin', 'broker') and p.suspended_at is null order by p.full_name`,
    getSettings(),
    sql`select id, trip_number, status, origin_icao, destination_icao, depart_at from trips
        where client_id = ${trip.client_id} and id <> ${tripId} order by created_at desc limit 5`,
  ]);

  const quoteNotes = quotes.length
    ? await sql`select n.*, p.full_name as author_name from staff_notes n left join profiles p on p.id = n.author_id
        where n.target_type = 'quote' and n.target_id = any(${quotes.map((q) => q.id)}) order by n.created_at`
    : [];

  return {
    trip, quotes, rfqs, recipients, contracts, payments, operatorPayments, bookings, opItins, clientItins,
    issues, events, notes, quoteNotes, feedback: feedback[0] ?? null, brokers, settings, clientTrips,
  };
}

export type DeskTrip = NonNullable<Awaited<ReturnType<typeof loadDeskTrip>>>;
