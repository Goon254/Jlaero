// Centralized notification engine (blueprint s24, spec s25).
// Writers insert rows inside the workflow transaction; delivery happens after
// commit (flushNotifications) so an email never goes out for a rolled-back step.
// App rows are delivered by being stored. SMS and push are recorded as
// 'skipped' until a provider is added.
import { db } from "@/lib/db";
import { sendTransactionalEmail } from "@/lib/sourcing/email";
import type { Tx } from "./core";

export type NotificationType =
  | "NEW_TRIP_REQUEST" | "NEW_QUOTE" | "QUOTES_RECEIVED" | "OPTIONS_READY" | "CLIENT_SELECTED"
  | "CONTRACT_READY" | "CONTRACT_SIGNED" | "PAYMENT_SUBMITTED" | "PAYMENT_RECEIVED" | "PAYMENT_FAILED"
  | "TRIP_CONFIRMED" | "ITINERARY_RECEIVED" | "ITINERARY_READY" | "72_HOUR_REMINDER" | "OPERATIONAL_ALERT"
  | "REPLACEMENT_AVAILABLE" | "REPLACEMENT_SELECTED" | "TRIP_COMPLETED" | "FEEDBACK_REQUEST" | "FEEDBACK_RECEIVED";

export function siteUrl(path = "") {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return base + path;
}

type Msg = { title: string; message: string; link?: string };

// Client: app row when they have an account, plus email always.
export async function notifyClient(tx: Tx, tripId: string, type: NotificationType, msg: Msg) {
  const [c] = await tx`select c.id, c.user_id, c.email from trips t join clients c on c.id = t.client_id where t.id = ${tripId}`;
  if (!c) return;
  if (c.user_id) {
    await tx`insert into notifications (user_id, client_id, trip_id, type, channel, audience, title, message, link, status, sent_at)
      values (${c.user_id}, ${c.id}, ${tripId}, ${type}, 'app', 'client', ${msg.title}, ${msg.message}, ${msg.link ?? null}, 'sent', now())`;
  }
  await tx`insert into notifications (user_id, client_id, to_address, trip_id, type, channel, audience, title, message, link)
    values (${c.user_id}, ${c.id}, ${c.email}, ${tripId}, ${type}, 'email', 'client', ${msg.title}, ${msg.message}, ${msg.link ?? null})`;
}

// Staff: the assigned broker, else every broker and admin. Finance events go
// to finance users too.
export async function notifyStaff(tx: Tx, tripId: string | null, type: NotificationType, msg: Msg, opts: { finance?: boolean; urgent?: boolean } = {}) {
  const roles = opts.finance ? ["admin", "finance", "broker"] : ["admin", "broker"];
  let recipients: { id: string; email: string | null }[] = [];
  if (tripId) {
    const [t] = await tx`select broker_id from trips where id = ${tripId}`;
    if (t?.broker_id && !opts.finance && !opts.urgent) {
      recipients = await tx`select p.id, u.email from profiles p join auth.users u on u.id = p.id where p.id = ${t.broker_id}`;
    }
  }
  if (!recipients.length) {
    recipients = await tx`select distinct p.id, u.email from user_roles r join profiles p on p.id = r.user_id
      join auth.users u on u.id = p.id where r.role::text = any(${roles}) and p.suspended_at is null`;
  }
  const title = opts.urgent ? `URGENT: ${msg.title}` : msg.title;
  for (const r of recipients) {
    await tx`insert into notifications (user_id, trip_id, type, channel, audience, title, message, link, status, sent_at)
      values (${r.id}, ${tripId}, ${type}, 'app', 'staff', ${title}, ${msg.message}, ${msg.link ?? null}, 'sent', now())`;
    if (r.email) {
      await tx`insert into notifications (user_id, to_address, trip_id, type, channel, audience, title, message, link)
        values (${r.id}, ${r.email}, ${tripId}, ${type}, 'email', 'staff', ${title}, ${msg.message}, ${msg.link ?? null})`;
    }
  }
}

function htmlEmail(title: string, message: string, link: string | null, company: string) {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const paras = esc(message).split(/\n{2,}/).map((p) => `<p style="margin:0 0 16px">${p.replace(/\n/g, "<br>")}</p>`).join("");
  return `<!doctype html><html><body style="margin:0;background:#f6f3ee;font-family:Inter,Helvetica,Arial,sans-serif;color:#1c2230">
<div style="max-width:560px;margin:0 auto;padding:32px 24px">
<div style="font-family:'Playfair Display',Georgia,serif;font-size:22px;letter-spacing:.5px;margin-bottom:24px">${esc(company)}</div>
<div style="background:#fffdf9;border:1px solid #e7e0d4;border-radius:14px;padding:28px">
<h1 style="font-family:'Playfair Display',Georgia,serif;font-weight:600;font-size:22px;margin:0 0 16px">${esc(title)}</h1>
${paras}
${link ? `<a href="${esc(link)}" style="display:inline-block;margin-top:8px;background:#1c2230;color:#f6f3ee;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600">View in ${esc(company)}</a>` : ""}
</div>
<p style="font-size:12px;color:#6b7280;margin-top:24px">${esc(company)} is an air charter broker. Flights are operated by FAA Part 135 certificated air carriers.</p>
</div></body></html>`;
}

// Deliver pending email rows. Safe to call repeatedly; each row is claimed
// with SKIP LOCKED so concurrent flushes never double-send.
export async function flushNotifications(limit = 40) {
  const sql = db();
  if (!process.env.POSTMARK_SERVER_TOKEN) {
    return { sent: 0, failed: 0, skipped: "email not configured" };
  }
  const [company] = await sql`select value->>'name' as name from app_settings where key = 'company'`;
  const name = company?.name ?? "Jlaero";
  let sent = 0, failed = 0;
  for (let i = 0; i < limit; i++) {
    const done = await sql.begin(async (tx) => {
      const [n] = await tx`select * from notifications where status = 'pending' and channel = 'email' and attempts < 5
        order by created_at limit 1 for update skip locked`;
      if (!n) return false;
      const link = n.link ? (String(n.link).startsWith("http") ? n.link : siteUrl(n.link)) : null;
      try {
        await sendTransactionalEmail({
          to: n.to_address, subject: n.title,
          text: `${n.message}${link ? `\n\n${link}` : ""}\n\n${name}`,
          html: htmlEmail(n.title, n.message, link, name),
          tag: String(n.type).toLowerCase().replace(/_/g, "-"),
        });
        await tx`update notifications set status = 'sent', sent_at = now(), attempts = attempts + 1 where id = ${n.id}`;
        sent++;
      } catch (e) {
        await tx`update notifications set attempts = attempts + 1, error = ${String(e).slice(0, 500)},
          status = case when attempts + 1 >= 5 then 'failed'::notification_status else 'pending'::notification_status end where id = ${n.id}`;
        failed++;
      }
      return true;
    });
    if (!done) break;
  }
  return { sent, failed };
}
