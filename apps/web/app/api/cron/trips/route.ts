import { NextResponse } from "next/server";
import { formatLocal } from "@jlaero/shared";
import { db } from "@/lib/db";
import { getSettings, withActor } from "@/lib/trips/core";
import { flushNotifications, notifyClient, notifyStaff } from "@/lib/trips/notify";

// Time-driven steps of the trip workflow (blueprint s25, spec s14-s16, s20).
// Runs every 10 minutes (vercel.json) with the CRON_SECRET bearer token.
//   - 72-hour reminder: countdown, cancellation policy, itinerary link;
//     trip moves to WITHIN_72_HOURS
//   - trips turn ACTIVE shortly before departure
//   - finished trips close after the feedback window
//   - pending notification emails are delivered
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const READY = ["confirmed", "itinerary_pending", "itinerary_ready"];

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sql = db();
  const s = await getSettings();
  const out = { reminders: 0, unconfirmedAlerts: 0, active: 0, closed: 0, email: {} as unknown };

  // 72-hour reminder, once per trip.
  const due = await sql`select t.id, t.trip_number, t.status, t.depart_at, t.origin_icao, t.destination_icao, a.tz
    from trips t join airports a on a.icao = t.origin_icao
    where t.reminder_72h_sent_at is null and t.depart_at > now()
      and t.depart_at <= now() + make_interval(hours => ${s.automation.reminder_hours})
      and t.status not in ('cancelled', 'closed', 'completed', 'feedback_requested')`;
  for (const t of due) {
    await withActor(null, async (tx) => {
      const [locked] = await tx`select reminder_72h_sent_at, status from trips where id = ${t.id} for update`;
      if (!locked || locked.reminder_72h_sent_at) return;
      await tx`update trips set reminder_72h_sent_at = now() where id = ${t.id}`;
      if (READY.includes(locked.status)) {
        const [it] = await tx`select 1 from client_itineraries where trip_id = ${t.id} and status = 'published'`;
        await tx`update trips set status = 'within_72_hours' where id = ${t.id}`;
        await notifyClient(tx, t.id, "72_HOUR_REMINDER", {
          title: "Your trip is approaching",
          message: `Your scheduled departure from ${t.origin_icao} to ${t.destination_icao} is within ${s.automation.reminder_hours} hours: ${formatLocal(t.depart_at, t.tz)}.\n\nPlease review the cancellation policy before making any changes to your trip.${it ? "\n\nYour itinerary is ready in the app." : ""}`,
          link: `/trips/${t.id}`,
        });
        if (!it) {
          await notifyStaff(tx, t.id, "OPERATIONAL_ALERT", { title: `${t.trip_number} departs within ${s.automation.reminder_hours}h without an itinerary`, message: "Publish the client itinerary.", link: `/desk/trips/${t.id}` }, { urgent: true });
        }
        out.reminders++;
      } else {
        // Not confirmed yet and departure is close: the broker must act now.
        await notifyStaff(tx, t.id, "OPERATIONAL_ALERT", {
          title: `${t.trip_number} departs within ${s.automation.reminder_hours}h and is not confirmed`,
          message: `Current status: ${String(locked.status).replace(/_/g, " ")}.`,
          link: `/desk/trips/${t.id}`,
        }, { urgent: true });
        out.unconfirmedAlerts++;
      }
    });
  }

  // Active shortly before departure (live tracking opens, spec s16).
  const activate = await sql`select id from trips where status in ('within_72_hours', 'itinerary_ready', 'confirmed', 'itinerary_pending')
    and depart_at <= now() + make_interval(hours => ${s.automation.active_hours_before})`;
  for (const t of activate) {
    await withActor(null, (tx) => tx`update trips set status = 'active' where id = ${t.id} and status in ('within_72_hours', 'itinerary_ready', 'confirmed', 'itinerary_pending')`);
    out.active++;
  }

  // Close trips whose feedback window has passed.
  const stale = await sql`select id from trips where status = 'feedback_requested'
    and thank_you_sent_at < now() - make_interval(days => ${s.automation.feedback_close_days})`;
  for (const t of stale) {
    await withActor(null, (tx) => tx`update trips set status = 'closed', closed_at = now() where id = ${t.id} and status = 'feedback_requested'`);
    out.closed++;
  }

  out.email = await flushNotifications();
  return NextResponse.json({ ok: true, ...out });
}
