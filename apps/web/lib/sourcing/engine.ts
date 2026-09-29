// Orchestration for the sourcing loop. Every step that costs money or sends
// email is called from an admin server action or a verified webhook.
import { AIRCRAFT_CATEGORY_LABELS } from "@jlaero/shared";
import { db } from "@/lib/db";
import { audit } from "./audit";
import { classifyReply, draftRfq, extractQuote, type ExtractedQuote } from "./claude";
import { parsePostmarkInbound, sendRfqEmail, type InboundEmail } from "./email";
import { findCandidates, loadTrip, tripSummaryText, type TripContext } from "./match";
import { priceOffer, suggestTier, type PricingPolicy } from "./pricing";

const fmtLocal = (d: Date | null) =>
  d ? d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC" : null;

// Step 1: pick operators and draft one email each. Nothing is sent.
export async function createRfqRound(requestId: string, actorId: string, limit = 12) {
  const sql = db();
  const trip = await loadTrip(requestId);
  const candidates = await findCandidates(trip, limit);
  const [nextRow] = await sql`select coalesce(max(round), 0) + 1 as next from rfqs where trip_request_id = ${requestId}`;
  const next = Number(nextRow?.next ?? 1);
  const [rfq] = await sql`insert into rfqs (trip_request_id, round, created_by, deadline_at)
    values (${requestId}, ${next}, ${actorId}, ${new Date(Date.now() + 48 * 3600 * 1000)}) returning id`;
  if (!rfq) throw new Error("could not create RFQ round");

  const summary = {
    originIcao: trip.origin.icao, originName: trip.origin.name,
    destinationIcao: trip.destination.icao, destinationName: trip.destination.name,
    departAtLocal: fmtLocal(trip.depart_at)!, returnAtLocal: fmtLocal(trip.return_at),
    passengers: trip.passengers,
    categoryLabel: trip.category_pref ? AIRCRAFT_CATEGORY_LABELS[trip.category_pref] : null,
    notes: trip.notes, distanceNm: trip.distanceNm,
  };

  let drafted = 0;
  const queue = [...candidates];
  const worker = async () => {
    for (let c = queue.shift(); c; c = queue.shift()) {
      let subject: string | null = null, body: string | null = null, model: string | null = null;
      if (c.contact_email) {
        try {
          const d = await draftRfq(summary, {
            name: c.name, contactName: c.contact_name, baseHint: c.state_hint,
            fleetHint: [...new Set(c.fleet.map((f) => f.model))].slice(0, 4).join(", "),
          });
          subject = d.subject; body = d.body; model = d.model; drafted += 1;
        } catch (e) {
          body = null;
          await audit("rfq.draft_failed", { type: "operator", id: c.operator_id }, { error: String(e) }, actorId);
        }
      }
      await sql`insert into rfq_recipients (rfq_id, operator_id, contact_id, to_email, subject, body_text, draft_model, match_reason)
        values (${rfq.id}, ${c.operator_id}, ${c.contact_id}, ${c.contact_email}, ${subject}, ${body}, ${model}, ${c.reason})
        on conflict (rfq_id, operator_id) do nothing`;
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  await sql`update trip_requests set status = 'sourcing' where id = ${requestId} and status = 'open'`;
  await audit("rfq.round_created", { type: "rfq", id: rfq.id }, { requestId, candidates: candidates.length, drafted, categories: trip.categories }, actorId);
  return { rfqId: rfq.id as string, candidates: candidates.length, drafted };
}

// Step 2: a human approves a draft; then it is sent.
export async function approveAndSend(recipientId: string, actorId: string, edits?: { subject?: string; body?: string; toEmail?: string }) {
  const sql = db();
  const [r] = await sql`select r.*, o.name as operator_name from rfq_recipients r join operators o on o.id = r.operator_id where r.id = ${recipientId}`;
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
  await audit("rfq.sent", { type: "rfq_recipient", id: recipientId }, { to, operator: r.operator_name, messageId }, actorId);
  return { messageId };
}

// Step 3: inbound reply. Correlate, classify, extract.
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
  if (!recipient) {
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
  if (!recipient) {
    await audit("rfq.unmatched_inbound", { type: "rfq_message", id: msg.id }, { from: mail.from, subject: mail.subject });
    return { messageId: msg.id, kind: "unmatched" };
  }

  const cls = await classifyReply(mail.strippedReply);
  const kind = cls.kind === "unsubscribe" ? "other" : cls.kind;
  await sql`update rfq_messages set kind = ${kind}, classification = ${sql.json(cls as never)} where id = ${msg.id}`;
  await sql`update rfq_recipients set last_event_at = now(), status = ${cls.kind === "decline" ? "declined" : cls.kind === "quote" ? "quoted" : "replied"} where id = ${recipient.id} and status <> 'quoted'`;
  if (cls.kind === "unsubscribe") {
    await sql`update operator_contacts set unsubscribed_at = now() where lower(email) = ${mail.from}`;
  }

  let quoteId: string | null = null;
  if (cls.kind === "quote") {
    const [rfq] = await sql`select trip_request_id from rfqs where id = ${recipient.rfq_id}`;
    const [op] = await sql`select name, argus_rating, wyvern_rating from operators where id = ${recipient.operator_id}`;
    if (!rfq || !op) throw new Error("rfq or operator missing for quote");
    const trip = await loadTrip(rfq.trip_request_id);
    const { quote, model } = await extractQuote(mail.strippedReply || mail.text, { tripSummary: tripSummaryText(trip), operatorName: op.name });
    const ac = quote.aircraft[0];
    const [q] = await sql`insert into operator_quotes (rfq_id, recipient_id, message_id, operator_id, extracted, all_in_total, currency, aircraft_type, tail_number, fet_included, expires_at, confidence, model, status)
      values (${recipient.rfq_id}, ${recipient.id}, ${msg.id}, ${recipient.operator_id}, ${sql.json(quote as never)}, ${quote.price.all_in_total}, ${quote.price.currency === "OTHER" ? "USD" : quote.price.currency},
              ${ac?.aircraft_type ?? null}, ${ac?.tail_number ?? null}, ${quote.price.fet_included}, ${safeDate(quote.validity.quote_expires_at)}, ${quote.confidence}, ${model}, 'pending_review')
      returning id`;
    if (!q) throw new Error("could not store quote");
    quoteId = q.id;
    await sql`update operators set outreach_status = 'responsive' where id = ${recipient.operator_id} and outreach_status in ('new', 'contacted')`;
    await audit("quote.extracted", { type: "operator_quote", id: q.id }, { total: quote.price.all_in_total, confidence: quote.confidence, model });
  }
  return { messageId: msg.id, kind: cls.kind, quoteId };
}

function safeDate(s: string | null) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// Step 4: agent reviews a quote, then builds a priced offer for a tier.
export async function reviewQuote(quoteId: string, actorId: string, decision: "approved" | "rejected", notes: string | null, overrideTotal?: number | null) {
  const sql = db();
  await sql`update operator_quotes set status = ${decision}, reviewed_by = ${actorId}, reviewed_at = now(), review_notes = ${notes},
    all_in_total = coalesce(${overrideTotal ?? null}, all_in_total) where id = ${quoteId}`;
  await audit(`quote.${decision}`, { type: "operator_quote", id: quoteId }, { notes, overrideTotal: overrideTotal ?? null }, actorId);
}

export async function buildOffer(input: {
  quoteId: string; tier: PricingPolicy["tier"]; actorId: string;
  competitorPrice?: number | null; competitorSource?: string | null; manualPrice?: number | null; headline?: string | null;
}) {
  const sql = db();
  const [q] = await sql`select q.*, r.trip_request_id, o.argus_rating, o.wyvern_rating, o.name as operator_name
    from operator_quotes q join rfqs r on r.id = q.rfq_id join operators o on o.id = q.operator_id where q.id = ${input.quoteId}`;
  if (!q) throw new Error("quote not found");
  if (q.status !== "approved") throw new Error("approve the quote before pricing it");
  if (!q.all_in_total) throw new Error("quote has no total");
  const [policy] = await sql`select * from pricing_policies where tier = ${input.tier}`;
  const priced = priceOffer({
    operatorCost: Number(q.all_in_total), policy: policy as PricingPolicy,
    competitorPrice: input.competitorPrice ?? null, manualPrice: input.manualPrice ?? null,
  });
  const ex = q.extracted as ExtractedQuote;
  const ac = ex.aircraft[0];
  const headline = input.headline?.trim() || [ac?.aircraft_type ?? q.aircraft_type ?? "Private jet", ac?.year ? String(ac.year) : null, ac?.max_pax ? `${ac.max_pax} seats` : null].filter(Boolean).join(", ");
  const includes = [
    ex.price.fet_included ? "Federal excise tax and segment fees" : "Taxes as quoted by operator",
    ex.price.catering_included ? "Catering" : null,
    ex.price.deicing_included ? "De-icing" : null,
    ex.price.landing_ramp_fees_included ? "Landing and ramp fees" : null,
    "Jlaero concierge and 24/7 trip support",
  ].filter(Boolean) as string[];
  const expires = q.expires_at ?? new Date(Date.now() + 48 * 3600 * 1000);
  const [offer] = await sql`insert into traveler_offers (trip_request_id, operator_quote_id, tier, headline, includes, operator_cost, markup_pct, markup_abs, traveler_price, currency, strategy, competitor_price, competitor_source, expires_at, status, created_by)
    values (${q.trip_request_id}, ${input.quoteId}, ${input.tier}, ${headline}, ${includes}, ${q.all_in_total}, ${priced.markupPct}, ${priced.markupAbs}, ${priced.travelerPrice}, ${q.currency}, ${priced.strategy}, ${input.competitorPrice ?? null}, ${input.competitorSource ?? null}, ${expires}, 'draft', ${input.actorId})
    on conflict (trip_request_id, tier, operator_quote_id) do update set headline = excluded.headline, includes = excluded.includes, markup_pct = excluded.markup_pct, markup_abs = excluded.markup_abs, traveler_price = excluded.traveler_price, strategy = excluded.strategy, competitor_price = excluded.competitor_price, competitor_source = excluded.competitor_source, expires_at = excluded.expires_at, status = 'draft'
    returning id`;
  if (!offer) throw new Error("could not store offer");
  await audit("offer.priced", { type: "traveler_offer", id: offer.id }, { ...priced, operatorCost: Number(q.all_in_total), tier: input.tier }, input.actorId);
  return { offerId: offer.id as string, ...priced, headline };
}

export async function presentOffers(requestId: string, actorId: string) {
  const sql = db();
  const rows = await sql`update traveler_offers set status = 'presented', presented_at = now()
    where trip_request_id = ${requestId} and status = 'draft' returning id`;
  await sql`update trip_requests set status = 'offers_ready' where id = ${requestId} and status in ('open', 'sourcing')`;
  await audit("offers.presented", { type: "trip_request", id: requestId }, { count: rows.length }, actorId);
  return rows.length;
}

export { suggestTier, type TripContext };
