// AI side of the trip workflow (blueprint s9-s12, s27, s29):
//   - RFQ rounds: search operators, draft one email each (sent only after a
//     broker approves it)
//   - inbound email: operator replies become quotes pending broker review;
//     aircraft problems raise an operational alert; client emails to the
//     requests address become trips
// AI never approves a quote, sends options, or confirms anything.
import { AIRCRAFT_CATEGORY_LABELS, computePrice, formatLocal, localToInstant, type AircraftCategory } from "@jlaero/shared";
import { db } from "@/lib/db";
import { audit } from "./audit";
import { classifyReply, draftRfq, extractQuote, parseTripRequest, type ExtractedQuote } from "./claude";
import { parsePostmarkInbound, sendRfqEmail, type InboundEmail } from "./email";
import { findCandidates, loadTrip, tripSummaryText, type TripContext } from "./match";
import { getSettings, withActor } from "@/lib/trips/core";
import { notifyClient, notifyStaff } from "@/lib/trips/notify";
import { reportIssue } from "@/lib/trips/workflow";

// Step 1: pick operators and draft one email each. Nothing is sent.
export async function createRfqRound(tripId: string, actorId: string | null) {
  const sql = db();
  const settings = await getSettings();
  const trip = await loadTrip(tripId);
  const [t] = await sql`select status from trips where id = ${tripId}`;
  const purpose = ["operational_issue", "replacement_search"].includes(t?.status) ? "replacement" : "initial";
  // A replacement search skips operators already asked for this trip, and the
  // operator whose aircraft failed.
  const exclude = purpose === "replacement"
    ? (await sql`select distinct operator_id from operator_bookings where trip_id = ${tripId} and status in ('confirmed', 'replaced')`).map((r) => r.operator_id as string)
    : [];
  const candidates = await findCandidates(trip, settings.search.max_operators, { includeProspects: settings.search.include_prospects, excludeOperatorIds: exclude });
  const [nextRow] = await sql`select coalesce(max(round), 0) + 1 as next from rfqs where trip_id = ${tripId}`;
  const next = Number(nextRow?.next ?? 1);
  const [rfq] = await sql`insert into rfqs (trip_id, round, purpose, created_by, deadline_at)
    values (${tripId}, ${next}, ${purpose}, ${actorId}, ${new Date(Date.now() + settings.search.quote_deadline_hours * 3600 * 1000)}) returning id`;
  if (!rfq) throw new Error("could not create RFQ round");

  const fmtLocal = (d: Date | null, tz: string | null) => (d ? formatLocal(d, tz, { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }) : null);
  const summary = {
    tripNumber: trip.trip_number,
    originIcao: trip.origin.icao, originName: trip.origin.name,
    destinationIcao: trip.destination.icao, destinationName: trip.destination.name,
    departAtLocal: fmtLocal(trip.depart_at, trip.origin.tz)!, returnAtLocal: fmtLocal(trip.return_at, trip.destination.tz),
    passengers: trip.passengers,
    categoryLabel: trip.aircraft_preference ?? (trip.category_pref ? AIRCRAFT_CATEGORY_LABELS[trip.category_pref] : null),
    catering: trip.catering, vehicle: trip.vehicle,
    notes: trip.notes, distanceNm: trip.distanceNm,
  };

  let drafted = 0;
  const aiReady = Boolean(process.env.ANTHROPIC_API_KEY);
  const queue = [...candidates];
  const worker = async () => {
    for (let c = queue.shift(); c; c = queue.shift()) {
      let subject: string | null = null, body: string | null = null, model: string | null = null;
      if (c.contact_email && aiReady) {
        try {
          const d = await draftRfq(summary, {
            name: c.name, contactName: c.contact_name, baseHint: c.state_hint,
            fleetHint: [...new Set(c.fleet.map((f) => f.model))].slice(0, 4).join(", "),
          });
          subject = d.subject; body = d.body; model = d.model; drafted += 1;
        } catch (e) {
          await audit("rfq.draft_failed", { type: "operator", id: c.operator_id }, { error: String(e) }, actorId);
        }
      }
      if (!body) ({ subject, body } = templateRfq(trip, summary.departAtLocal, summary.returnAtLocal));
      await sql`insert into rfq_recipients (rfq_id, operator_id, contact_id, to_email, subject, body_text, draft_model, match_reason)
        values (${rfq.id}, ${c.operator_id}, ${c.contact_id}, ${c.contact_email}, ${subject}, ${body}, ${model}, ${c.reason})
        on conflict (rfq_id, operator_id) do nothing`;
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  await withActor(actorId, async (tx) => {
    await tx`update trips set status = 'searching' where id = ${tripId} and status = 'new_request'`;
    await tx`insert into trip_events (trip_id, actor_id, kind, message, meta)
      values (${tripId}, ${actorId}, 'ai', ${`Operator search: ${candidates.length} operators matched, ${drafted} emails drafted by AI`},
              ${tx.json({ rfq_id: rfq.id, purpose, candidates: candidates.length })})`;
  });
  await audit("rfq.round_created", { type: "rfq", id: rfq.id }, { tripId, purpose, candidates: candidates.length, drafted, categories: trip.categories }, actorId);
  return { rfqId: rfq.id as string, candidates: candidates.length, drafted };
}

// Structured fallback email when AI drafting is unavailable (blueprint s11B).
function templateRfq(trip: TripContext, departLocal: string, returnLocal: string | null) {
  const aircraft = trip.aircraft_preference ?? (trip.category_pref ? AIRCRAFT_CATEGORY_LABELS[trip.category_pref as AircraftCategory] : "Any suitable aircraft");
  return {
    subject: `Aircraft request ${trip.trip_number}: ${trip.origin.icao} to ${trip.destination.icao}, ${departLocal}`,
    body: [
      "Hello,",
      "",
      "Please quote the following trip:",
      "",
      `Trip ID: ${trip.trip_number}`,
      `Origin: ${trip.origin.icao} (${trip.origin.name})`,
      `Destination: ${trip.destination.icao} (${trip.destination.name})`,
      `Departure: ${departLocal}`,
      `Return: ${returnLocal ?? "One way"}`,
      `Passengers: ${trip.passengers}`,
      `Aircraft: ${aircraft}`,
      `Catering: ${trip.catering ? "Requested, please price separately" : "Not requested"}`,
      `Ground vehicle: ${trip.vehicle ? "Requested, please advise" : "Not requested"}`,
      trip.notes ? `Special requests: ${trip.notes}` : null,
      "",
      "Please include the aircraft type and year, availability, all-in price with FET and segment fees, any restrictions, and how long the quote is valid. A reply to this email reaches our desk directly.",
      "",
      "Jlaero Charter Desk",
    ].filter((l) => l !== null).join("\n"),
  };
}

// Step 2: a broker approves a draft; then it is sent.
export async function approveAndSend(recipientId: string, actorId: string, edits?: { subject?: string; body?: string; toEmail?: string }) {
  const sql = db();
  const [r] = await sql`select r.*, o.name as operator_name, f.trip_id from rfq_recipients r join operators o on o.id = r.operator_id join rfqs f on f.id = r.rfq_id where r.id = ${recipientId}`;
  if (!r) throw new Error("recipient not found");
  if (r.status === "sent") return { alreadySent: true };
  const subject = edits?.subject ?? r.subject;
  const body = edits?.body ?? r.body_text;
  const to = edits?.toEmail ?? r.to_email;
  if (!subject || !body || !to) throw new Error("subject, body and recipient email are required");
  const [contact] = await sql`select unsubscribed_at from operator_contacts where lower(email) = lower(${to})`;
  if (contact?.unsubscribed_at) throw new Error("this contact has unsubscribed");

  const { messageId } = await sendRfqEmail({ to, subject, text: body, replyToken: r.reply_token, tag: "rfq" });
  await sql`update rfq_recipients set status = 'sent', subject = ${subject}, body_text = ${body}, to_email = ${to},
      approved_by = ${actorId}, approved_at = now(), provider_message_id = ${messageId}, sent_at = now(), last_event_at = now()
      where id = ${recipientId}`;
  await sql`insert into rfq_messages (rfq_id, recipient_id, direction, kind, provider_message_id, from_address, to_address, subject, text_body)
      values (${r.rfq_id}, ${recipientId}, 'outbound', 'rfq', ${messageId}, ${process.env.RFQ_FROM_EMAIL ?? "charter@jlaero.com"}, ${to}, ${subject}, ${body})`;
  await sql`update operators set outreach_status = 'contacted' where id = ${r.operator_id} and outreach_status = 'new'`;
  await audit("rfq.sent", { type: "rfq_recipient", id: recipientId }, { to, operator: r.operator_name, messageId, tripId: r.trip_id }, actorId);
  return { messageId };
}

function isRequestsMailbox(to: string) {
  const addr = (process.env.REQUESTS_INBOUND_ADDRESS ?? "").toLowerCase();
  return Boolean(addr) && to.toLowerCase().includes(addr);
}

// Step 3: inbound email. Correlate, classify, extract.
export async function processInbound(payload: Record<string, unknown>) {
  const sql = db();
  const mail: InboundEmail = parsePostmarkInbound(payload);
  if (!mail.providerMessageId) throw new Error("missing MessageID");
  const [dup] = await sql`select id from rfq_messages where provider_message_id = ${mail.providerMessageId}`;
  if (dup) return { duplicate: true };

  // 1. reply token, 2. In-Reply-To against our outbound ids, 3. sender address.
  let recipient = mail.mailboxHash
    ? (await sql`select * from rfq_recipients where reply_token = ${mail.mailboxHash}`)[0]
    : null;
  if (!recipient && mail.inReplyTo) {
    const ids = [mail.inReplyTo, mail.references ?? ""].join(" ").match(/[0-9a-f-]{36}/gi) ?? [];
    if (ids.length) recipient = (await sql`select * from rfq_recipients where provider_message_id = any(${ids})`)[0];
  }
  const requestsMailbox = isRequestsMailbox(mail.to);
  if (!recipient && !requestsMailbox) {
    recipient = (await sql`select r.* from rfq_recipients r
      join operator_contacts c on c.operator_id = r.operator_id
      where lower(c.email) = ${mail.from} and r.status in ('sent', 'replied', 'quoted')
      order by r.sent_at desc limit 1`)[0];
  }

  const [msg] = await sql`insert into rfq_messages (rfq_id, recipient_id, direction, kind, provider_message_id, in_reply_to, from_address, to_address, subject, text_body, html_body, headers, raw, received_at)
    values (${recipient?.rfq_id ?? null}, ${recipient?.id ?? null}, 'inbound', 'unknown', ${mail.providerMessageId}, ${mail.inReplyTo}, ${mail.from}, ${mail.to}, ${mail.subject}, ${mail.text}, ${mail.html}, ${sql.json(mail.headers as never)}, ${sql.json(payload as never)}, ${mail.receivedAt})
    returning id`;
  if (!msg) throw new Error("could not store inbound message");

  if (/^\s*unsubscribe\b/i.test(mail.strippedReply)) {
    await sql`update operator_contacts set unsubscribed_at = now() where lower(email) = ${mail.from}`;
    await sql`update rfq_messages set kind = 'other', classification = ${sql.json({ kind: "unsubscribe" })} where id = ${msg.id}`;
    await audit("rfq.unsubscribe", { type: "rfq_message", id: msg.id }, { from: mail.from });
    return { messageId: msg.id, kind: "unsubscribe" };
  }

  // Client trip request by email (spec s3 option A).
  if (!recipient) {
    const [isOperator] = await sql`select 1 from operator_contacts where lower(email) = ${mail.from}`;
    if (requestsMailbox || !isOperator) return intakeRequest(msg.id, mail);
    // A known operator writing outside an RFQ thread: check for an
    // aircraft problem on a booked trip.
    return operatorNotice(msg.id, mail);
  }

  const cls = await classifyReply(mail.strippedReply);
  const kind = cls.kind === "unsubscribe" || cls.kind === "aircraft_issue" ? "other" : cls.kind;
  await sql`update rfq_messages set kind = ${kind}, classification = ${sql.json(cls as never)} where id = ${msg.id}`;
  await sql`update rfq_recipients set last_event_at = now(), status = ${cls.kind === "decline" ? "declined" : cls.kind === "quote" ? "quoted" : "replied"} where id = ${recipient.id} and status <> 'quoted'`;
  if (cls.kind === "unsubscribe") {
    await sql`update operator_contacts set unsubscribed_at = now() where lower(email) = ${mail.from}`;
  }
  if (cls.kind === "aircraft_issue") return operatorNotice(msg.id, mail);

  let quoteId: string | null = null;
  if (cls.kind === "quote") {
    const [rfq] = await sql`select trip_id from rfqs where id = ${recipient.rfq_id}`;
    const [op] = await sql`select name from operators where id = ${recipient.operator_id}`;
    if (!rfq || !op) throw new Error("rfq or operator missing for quote");
    const trip = await loadTrip(rfq.trip_id);
    const { quote, model } = await extractQuote(mail.strippedReply || mail.text, { tripSummary: tripSummaryText(trip), operatorName: op.name });
    if (quote.quote_found && quote.price.all_in_total) {
      quoteId = await storeExtractedQuote({ tripId: rfq.trip_id, trip, operatorId: recipient.operator_id, recipientId: recipient.id, messageId: msg.id, quote, model });
      await sql`update operators set outreach_status = 'responsive' where id = ${recipient.operator_id} and outreach_status in ('new', 'contacted')`;
    }
  }
  return { messageId: msg.id, kind: cls.kind, quoteId };
}

// Blueprint s12: AI output lands as PENDING BROKER REVIEW, priced with the
// default markup so the broker sees the client price immediately.
export async function storeExtractedQuote(input: {
  tripId: string; trip: TripContext; operatorId: string; recipientId: string | null; messageId: string | null;
  quote: ExtractedQuote; model: string; source?: "email" | "ai_extracted";
}) {
  const { quote, trip } = input;
  const settings = await getSettings();
  const ac = quote.aircraft[0];
  const price = computePrice({
    operatorCost: quote.price.all_in_total ?? 0,
    cateringCost: trip.catering && quote.catering === "additional" ? quote.catering_price ?? settings.pricing.catering_default : trip.catering ? settings.pricing.catering_default : 0,
    vehicleCost: trip.vehicle ? quote.vehicle_price ?? settings.pricing.vehicle_default : 0,
    otherCost: settings.pricing.service_fee,
  }, settings.pricing);
  const [t] = await db()`select status from trips where id = ${input.tripId}`;
  const isReplacement = ["operational_issue", "replacement_search"].includes(t?.status);
  const expires = quote.validity.quote_expires_at ? new Date(quote.validity.quote_expires_at) : null;
  const highlights = [
    ac?.max_pax ? `Seats up to ${ac.max_pax}` : null,
    trip.catering ? "Catering arranged" : null,
    trip.vehicle ? "Ground vehicle arranged" : null,
    quote.price.fet_included ? "Taxes and fees included" : null,
  ].filter(Boolean) as string[];
  return withActor(null, async (tx) => {
    const [q] = await tx`insert into trip_quotes (trip_id, operator_id, rfq_recipient_id, rfq_message_id, source, availability,
        aircraft_type, tail_number, year_mfr, passenger_capacity, headline, highlights,
        operator_cost, markup_pct, markup_amount, catering_cost, vehicle_cost, other_cost, client_price,
        operator_terms, restrictions, expires_at, confidence, model, status, is_replacement)
      values (${input.tripId}, ${input.operatorId}, ${input.recipientId}, ${input.messageId}, ${input.source ?? "email"},
        ${quote.available === true ? "available" : quote.available === false ? "unavailable" : "unknown"},
        ${ac?.aircraft_type ?? "Aircraft not stated"}, ${ac?.tail_number ?? null}, ${ac?.year ?? null}, ${ac?.max_pax ?? null},
        ${[ac?.aircraft_type, ac?.year].filter(Boolean).join(", ") || null}, ${highlights},
        ${price.operatorCost}, ${price.markupPct}, ${price.markupAmount}, ${price.cateringCost}, ${price.vehicleCost}, ${price.otherCost}, ${price.clientPrice},
        ${tx.json(quote as never)}, ${quote.restrictions}, ${expires && !isNaN(expires.getTime()) ? expires : null},
        ${quote.confidence}, ${input.model}, 'pending_review', ${isReplacement})
      returning id`;
    await tx`update trips set status = 'quotes_received' where id = ${input.tripId} and status in ('new_request', 'searching')`;
    await tx`insert into trip_events (trip_id, kind, message, meta)
      values (${input.tripId}, 'ai', ${`AI extracted a quote: ${ac?.aircraft_type ?? "aircraft"} at $${price.operatorCost.toLocaleString()} (confidence ${Math.round(quote.confidence * 100)}%). Pending broker review.`},
              ${tx.json({ quote_id: q.id })})`;
    await tx`insert into audit_logs (action, target_type, target_id, new_value, meta) values ('quote.extracted', 'trip_quote', ${q.id},
      ${tx.json({ operator_cost: price.operatorCost, client_price: price.clientPrice })}, ${tx.json({ model: input.model, confidence: quote.confidence })})`;
    await notifyStaff(tx, input.tripId, isReplacement ? "REPLACEMENT_AVAILABLE" : "NEW_QUOTE", {
      title: `${trip.trip_number}: new ${isReplacement ? "replacement " : ""}quote to review`,
      message: `${ac?.aircraft_type ?? "An aircraft"} at $${price.operatorCost.toLocaleString()} operator cost ($${price.clientPrice.toLocaleString()} to the client at ${price.markupPct}%). Verify before sending.`,
      link: `/desk/trips/${input.tripId}`,
    }, { urgent: isReplacement });
    return q.id as string;
  });
}

// Operator reports an aircraft problem (spec s17). If it matches a booked
// trip, flag it; otherwise route the email to staff.
async function operatorNotice(messageId: string, mail: InboundEmail) {
  const sql = db();
  const cls = await classifyReply(mail.strippedReply);
  await sql`update rfq_messages set classification = ${sql.json(cls as never)} where id = ${messageId}`;
  if (cls.kind === "aircraft_issue") {
    const trips = await sql`select distinct t.id, t.depart_at from trips t
      join operator_bookings b on b.trip_id = t.id and b.status = 'confirmed'
      join operator_contacts c on c.operator_id = b.operator_id and lower(c.email) = ${mail.from}
      where t.status in ('confirmed', 'itinerary_pending', 'itinerary_ready', 'within_72_hours', 'active')
      order by t.depart_at limit 5`;
    const mentioned = trips.find((t) => mail.text.includes(String(t.id))) ?? (trips.length === 1 ? trips[0] : null);
    if (mentioned) {
      await reportIssue(mentioned.id, { kind: "aircraft_unavailable", description: `Operator email: ${mail.subject}\n\n${mail.strippedReply.slice(0, 1500)}`, via: "operator_email" }, null);
      return { messageId, kind: "aircraft_issue", tripId: mentioned.id };
    }
  }
  await withActor(null, (tx) => notifyStaff(tx, null, "OPERATIONAL_ALERT", {
    title: `Operator email needs attention: ${mail.subject || "(no subject)"}`,
    message: `From ${mail.from}. ${cls.kind === "aircraft_issue" ? "It looks like an aircraft problem but could not be matched to one trip." : "Not matched to an RFQ."}\n\n${mail.strippedReply.slice(0, 800)}`,
    link: `/desk/inbox`,
  }, { urgent: cls.kind === "aircraft_issue" }));
  return { messageId, kind: cls.kind };
}

async function resolveAirport(guess: string | null, text: string | null) {
  const sql = db();
  const codes = [guess, text].filter(Boolean).map((s) => s!.trim().toUpperCase());
  for (const c of codes) {
    if (!/^[A-Z0-9]{3,4}$/.test(c)) continue;
    const [a] = await sql`select icao, tz from airports where icao = ${c} or iata = ${c} or ident = ${c} order by (icao = ${c}) desc limit 1`;
    if (a) return a as { icao: string; tz: string | null };
  }
  return null;
}

// Spec s3 option A / blueprint s29 role 1.
async function intakeRequest(messageId: string, mail: InboundEmail) {
  const sql = db();
  if (!process.env.ANTHROPIC_API_KEY) {
    await withActor(null, (tx) => notifyStaff(tx, null, "NEW_TRIP_REQUEST", { title: `Email request from ${mail.from}`, message: `${mail.subject}\n\n${mail.text.slice(0, 1200)}\n\nAI parsing is not configured; enter this trip manually.`, link: `/desk/trips/new?message=${messageId}` }));
    return { messageId, kind: "request_manual" };
  }
  const { request: r, model } = await parseTripRequest({ from: mail.from, fromName: mail.fromName, subject: mail.subject, text: mail.strippedReply || mail.text });
  await sql`update rfq_messages set kind = 'other', classification = ${sql.json({ kind: "trip_request", parsed: r, model } as never)} where id = ${messageId}`;
  if (!r.is_trip_request) {
    await audit("intake.ignored", { type: "rfq_message", id: messageId }, { from: mail.from, subject: mail.subject });
    return { messageId, kind: "not_a_request" };
  }
  const origin = await resolveAirport(r.origin_icao_guess, r.origin);
  const dest = await resolveAirport(r.destination_icao_guess, r.destination);
  const missing = [...r.missing_information];
  if (!origin) missing.push("departure airport");
  if (!dest) missing.push("destination airport");
  if (!r.departure_date) missing.push("departure date");
  if (!r.passengers) missing.push("passenger count");

  if (!origin || !dest || !r.departure_date || !r.passengers) {
    await withActor(null, (tx) => notifyStaff(tx, null, "NEW_TRIP_REQUEST", {
      title: `Email trip request needs details: ${mail.fromName || mail.from}`,
      message: `AI read a trip request but it is missing: ${[...new Set(missing)].join(", ")}. Open it to complete and create the trip.`,
      link: `/desk/trips/new?message=${messageId}`,
    }));
    return { messageId, kind: "request_incomplete" };
  }

  const departAt = localToInstant(r.departure_date, r.departure_time, origin.tz);
  const returnAt = r.return_date ? localToInstant(r.return_date, r.return_time, dest.tz) : null;
  const settings = await getSettings();
  const tripId = await withActor(null, async (tx) => {
    const [client] = await tx`insert into clients (full_name, email, phone, company_name, first_time_private_flyer)
      values (${r.client_name || mail.fromName || mail.from}, ${mail.from}, ${r.phone}, ${r.company_name}, ${r.first_time_flyer})
      on conflict (lower(email)) do update set phone = coalesce(clients.phone, excluded.phone), company_name = coalesce(clients.company_name, excluded.company_name)
      returning id`;
    const [trip] = await tx`insert into trips (client_id, source, origin_icao, destination_icao, departure_date, departure_time, depart_at,
        return_date, return_time, return_at, passengers, aircraft_category, aircraft_preference, vehicle_required, catering_required,
        first_time_flyer, special_requests, missing_info, search_radius_miles, source_email_id)
      values (${client.id}, 'email', ${origin.icao}, ${dest.icao}, ${r.departure_date}, ${r.departure_time}, ${departAt},
        ${r.return_date}, ${r.return_time}, ${returnAt && returnAt > departAt ? returnAt : null}, ${r.passengers}, ${r.aircraft_category}, ${r.aircraft_type},
        ${r.vehicle_required ?? false}, ${r.catering_required ?? false}, ${r.first_time_flyer}, ${r.special_requests},
        ${[...new Set(r.missing_information)]}, ${settings.search.radius_miles}, ${messageId})
      returning id, trip_number`;
    await tx`insert into trip_events (trip_id, kind, message, meta) values (${trip.id}, 'ai', 'Trip created from an email request by the AI request parser', ${tx.json({ model, message_id: messageId })})`;
    await notifyClient(tx, trip.id, "NEW_TRIP_REQUEST", {
      title: `We received your trip request ${trip.trip_number}`,
      message: `Thank you. Your request from ${origin.icao} to ${dest.icao} on ${r.departure_date} for ${r.passengers} passenger${r.passengers === 1 ? "" : "s"} is with our charter desk. We will send you aircraft options shortly.${r.missing_information.length ? `\n\nTo speed things up, please reply with: ${r.missing_information.join(", ")}.` : ""}`,
      link: `/trips/${trip.id}`,
    });
    await notifyStaff(tx, trip.id, "NEW_TRIP_REQUEST", {
      title: `New email trip request ${trip.trip_number}`,
      message: `${r.client_name || mail.from}: ${origin.icao} to ${dest.icao}, ${r.departure_date}, ${r.passengers} passengers.${r.missing_information.length ? ` Missing: ${r.missing_information.join(", ")}.` : ""}`,
      link: `/desk/trips/${trip.id}`,
    });
    return trip.id as string;
  });
  return { messageId, kind: "trip_request", tripId };
}

// A broker pastes an operator's quote (phone notes, WhatsApp, a forwarded
// email) and AI normalizes it; it still lands as pending review.
export async function extractPastedQuote(tripId: string, operatorId: string, text: string, actorId: string) {
  const trip = await loadTrip(tripId);
  const [op] = await db()`select name from operators where id = ${operatorId}`;
  if (!op) throw new Error("operator not found");
  const { quote, model } = await extractQuote(text, { tripSummary: tripSummaryText(trip), operatorName: op.name });
  if (!quote.quote_found || !quote.price.all_in_total) throw new Error("No price found in that text. Enter the quote manually instead.");
  const id = await storeExtractedQuote({ tripId, trip, operatorId, recipientId: null, messageId: null, quote, model, source: "ai_extracted" });
  await audit("quote.pasted", { type: "trip_quote", id }, { tripId }, actorId);
  return id;
}
