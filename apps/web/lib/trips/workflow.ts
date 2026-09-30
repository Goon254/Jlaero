// The broker-assisted workflow (spec s28, blueprint s4). One function per
// human decision. Each runs in a single transaction: guard the current
// status, write, audit, notify. AI never calls these on its own (blueprint
// s13); they are invoked from staff server actions or the client RPCs in 0019.
import { computePrice, formatMoney, PAYMENT_METHOD_LABELS, type PaymentMethod } from "@jlaero/shared";
import { renderContract } from "./contract";
import { audit, getSettings, lockTrip, setStatus, tripEvent, withActor, WorkflowError, type Tx } from "./core";
import { notifyClient, notifyStaff } from "./notify";

const tripLink = (id: string) => `/trips/${id}`;
const deskLink = (id: string) => `/desk/trips/${id}`;

// ---------------------------------------------------------------------------
// Trip management
// ---------------------------------------------------------------------------
export async function assignBroker(tripId: string, brokerId: string | null, actorId: string) {
  return withActor(actorId, async (tx) => {
    const trip = await lockTrip(tx, tripId);
    await tx`update trips set broker_id = ${brokerId} where id = ${tripId}`;
    await audit(tx, actorId, "trip.broker_assigned", { type: "trip", id: tripId }, { old: trip.broker_id, new: brokerId });
    await tripEvent(tx, tripId, actorId, "note", brokerId ? "Broker assigned" : "Broker unassigned", { meta: { broker_id: brokerId } });
  });
}

export type TripEdit = {
  origin_icao?: string; destination_icao?: string;
  departure_date?: string; departure_time?: string | null; depart_at?: Date;
  return_date?: string | null; return_time?: string | null; return_at?: Date | null;
  passengers?: number; aircraft_category?: string | null; aircraft_preference?: string | null;
  vehicle_required?: boolean; catering_required?: boolean; special_requests?: string | null;
  search_radius_miles?: number;
};

export async function updateTrip(tripId: string, edit: TripEdit, actorId: string) {
  return withActor(actorId, async (tx) => {
    const trip = await lockTrip(tx, tripId);
    if (["completed", "feedback_requested", "closed", "cancelled"].includes(trip.status)) {
      throw new WorkflowError("A finished trip cannot be edited.");
    }
    const changed: Record<string, { old: unknown; new: unknown }> = {};
    for (const [k, v] of Object.entries(edit)) {
      if (v === undefined) continue;
      const before = trip[k] instanceof Date ? trip[k].toISOString() : trip[k];
      const after = v instanceof Date ? v.toISOString() : v;
      if (String(before ?? "") !== String(after ?? "")) changed[k] = { old: before, new: after };
    }
    if (!Object.keys(changed).length) return;
    const cols = Object.keys(changed);
    const values = Object.fromEntries(cols.map((c) => [c, (edit as Record<string, unknown>)[c]]));
    await tx`update trips set ${tx(values, cols)} where id = ${tripId}`;
    await audit(tx, actorId, "trip.edited", { type: "trip", id: tripId }, {
      old: Object.fromEntries(cols.map((c) => [c, changed[c]!.old])),
      new: Object.fromEntries(cols.map((c) => [c, changed[c]!.new])),
    });
    await tripEvent(tx, tripId, actorId, "note", `Trip details changed: ${cols.join(", ").replace(/_/g, " ")}`);
  });
}

export async function addNote(target: { type: "trip" | "client" | "operator" | "quote"; id: string }, body: string, actorId: string) {
  const text = body.trim();
  if (!text) throw new WorkflowError("Write a note first.");
  return withActor(actorId, async (tx) => {
    await tx`insert into staff_notes (target_type, target_id, author_id, body) values (${target.type}, ${target.id}, ${actorId}, ${text})`;
  });
}

export async function startSearch(tripId: string, actorId: string | null) {
  return withActor(actorId, async (tx) => {
    const trip = await lockTrip(tx, tripId, ["new_request", "searching", "quotes_received", "broker_review"]);
    if (trip.status === "new_request") await setStatus(tx, tripId, "searching");
  });
}

export async function cancelTrip(tripId: string, reason: string, actorId: string, notifyTheClient: boolean) {
  return withActor(actorId, async (tx) => {
    const trip = await lockTrip(tx, tripId);
    if (["completed", "feedback_requested", "closed", "cancelled"].includes(trip.status)) {
      throw new WorkflowError("This trip is already finished.");
    }
    await tx`update trips set status = 'cancelled', cancelled_at = now(), cancel_reason = ${reason} where id = ${tripId}`;
    await tx`update trip_quotes set status = 'withdrawn' where trip_id = ${tripId} and status in ('pending_review', 'approved', 'option_sent', 'client_selected')`;
    await tx`update trip_contracts set status = 'void', voided_at = now(), void_reason = 'Trip cancelled' where trip_id = ${tripId} and status in ('draft', 'sent')`;
    await tx`update trip_payments set status = 'cancelled' where trip_id = ${tripId} and status in ('pending')`;
    await audit(tx, actorId, "trip.cancelled", { type: "trip", id: tripId }, { old: trip.status, new: "cancelled", meta: { reason } });
    if (notifyTheClient) {
      await notifyClient(tx, tripId, "TRIP_COMPLETED", {
        title: `Trip ${trip.trip_number} cancelled`,
        message: `Your trip ${trip.trip_number} has been cancelled.${reason ? `\n\n${reason}` : ""}\n\nIf you have questions, reply to this email or contact your broker.`,
        link: tripLink(tripId),
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Quotes (spec s5, s6; blueprint s7, s8, s11C)
// ---------------------------------------------------------------------------
export type QuoteInput = {
  operatorId: string;
  aircraftId?: string | null;
  aircraftType: string;
  aircraftCategory?: string | null;
  tailNumber?: string | null;
  yearMfr?: number | null;
  passengerCapacity?: number | null;
  availability?: "available" | "pending" | "unavailable" | "unknown";
  operatorCost: number;
  markupPct?: number | null;
  cateringCost?: number | null;
  vehicleCost?: number | null;
  otherCost?: number | null;
  otherCostLabel?: string | null;
  expiresAt?: Date | null;
  restrictions?: string | null;
  notes?: string | null;
  source?: "manual" | "ai_extracted" | "website" | "api";
  operatorTerms?: Record<string, unknown>;
  confidence?: number | null;
  model?: string | null;
  isReplacement?: boolean;
};

function defaultHighlights(q: { catering: boolean; vehicle: boolean; capacity?: number | null }) {
  const out: string[] = [];
  if (q.capacity) out.push(`Seats up to ${q.capacity}`);
  if (q.catering) out.push("Catering arranged");
  if (q.vehicle) out.push("Ground vehicle arranged");
  out.push("Taxes and fees included");
  return out;
}

export async function addQuote(tripId: string, input: QuoteInput, actorId: string, opts: { isAdmin?: boolean } = {}) {
  if (!(input.operatorCost > 0)) throw new WorkflowError("Enter the operator's price.");
  if (!input.aircraftType.trim()) throw new WorkflowError("Enter the aircraft type.");
  return withActor(actorId, async (tx) => {
    const trip = await lockTrip(tx, tripId);
    if (["completed", "feedback_requested", "closed", "cancelled"].includes(trip.status)) {
      throw new WorkflowError("This trip is finished.");
    }
    const settings = await getSettings(tx);
    const price = computePrice({
      operatorCost: input.operatorCost,
      markupPct: input.markupPct,
      cateringCost: input.cateringCost ?? (trip.catering_required ? settings.pricing.catering_default : 0),
      vehicleCost: input.vehicleCost ?? (trip.vehicle_required ? settings.pricing.vehicle_default : 0),
      otherCost: input.otherCost ?? settings.pricing.service_fee,
    }, settings.pricing);
    if (price.belowMinimum && !opts.isAdmin) {
      throw new WorkflowError(`Markup below the ${settings.pricing.min_markup_pct}% minimum needs admin approval.`);
    }
    const source = input.source ?? "manual";
    const manual = source === "manual";
    const isReplacement = input.isReplacement ?? ["operational_issue", "replacement_search"].includes(trip.status);
    const [q] = await tx`insert into trip_quotes (
        trip_id, operator_id, aircraft_id, source, availability, aircraft_type, aircraft_category, tail_number, year_mfr,
        passenger_capacity, headline, highlights, operator_cost, markup_pct, markup_amount, catering_cost, vehicle_cost,
        other_cost, other_cost_label, client_price, operator_terms, restrictions, expires_at, confidence, model,
        status, is_replacement, reviewed_by, reviewed_at, created_by)
      values (${tripId}, ${input.operatorId}, ${input.aircraftId ?? null}, ${source}, ${input.availability ?? "unknown"},
        ${input.aircraftType.trim()}, ${input.aircraftCategory ?? null}, ${input.tailNumber ?? null}, ${input.yearMfr ?? null},
        ${input.passengerCapacity ?? null}, ${input.aircraftType.trim()},
        ${defaultHighlights({ catering: trip.catering_required, vehicle: trip.vehicle_required, capacity: input.passengerCapacity })},
        ${price.operatorCost}, ${price.markupPct}, ${price.markupAmount}, ${price.cateringCost}, ${price.vehicleCost},
        ${price.otherCost}, ${input.otherCostLabel ?? null}, ${price.clientPrice}, ${tx.json(input.operatorTerms ?? {})},
        ${input.restrictions ?? null}, ${input.expiresAt ?? null}, ${input.confidence ?? null}, ${input.model ?? null},
        ${manual ? "approved" : "pending_review"}, ${isReplacement}, ${manual ? actorId : null}, ${manual ? new Date() : null}, ${actorId})
      returning id`;
    if (input.notes?.trim()) {
      await tx`insert into staff_notes (target_type, target_id, author_id, body) values ('quote', ${q.id}, ${actorId}, ${input.notes.trim()})`;
    }
    if (["new_request", "searching"].includes(trip.status)) await setStatus(tx, tripId, manual ? "broker_review" : "quotes_received");
    await audit(tx, actorId, "quote.created", { type: "trip_quote", id: q.id }, {
      new: { operator_cost: price.operatorCost, markup_pct: price.markupPct, client_price: price.clientPrice, source },
    });
    await tripEvent(tx, tripId, actorId, "quote", `${manual ? "Manual" : "AI"} quote added: ${input.aircraftType} at ${formatMoney(price.operatorCost)} operator cost`, { meta: { quote_id: q.id } });
    return q.id as string;
  });
}

export type PricingEdit = {
  markupPct?: number | null;
  cateringCost?: number | null;
  vehicleCost?: number | null;
  otherCost?: number | null;
  otherCostLabel?: string | null;
  clientPriceOverride?: number | null;
  operatorCost?: number | null;
  headline?: string | null;
  highlights?: string[] | null;
  availability?: string | null;
  expiresAt?: Date | null;
  passengerCapacity?: number | null;
};

// Edit pricing or presentation. Markup below the minimum, and fixing the final
// price directly, need admin (blueprint s31). Old and new prices are audited.
export async function updateQuote(quoteId: string, edit: PricingEdit, actorId: string, opts: { isAdmin: boolean }) {
  return withActor(actorId, async (tx) => {
    const [q] = await tx`select * from trip_quotes where id = ${quoteId} for update`;
    if (!q) throw new WorkflowError("Quote not found.");
    if (!["pending_review", "approved", "client_selected"].includes(q.status)) {
      throw new WorkflowError("Only quotes that have not been sent, or the one the client selected, can be repriced. Withdraw and re-add otherwise.");
    }
    if (q.status === "client_selected") {
      const [c] = await tx`select 1 from trip_contracts where quote_id = ${quoteId} and status in ('sent', 'signed')`;
      if (c) throw new WorkflowError("A contract has been sent for this quote. Void it before changing the price.");
    }
    if (edit.clientPriceOverride != null && !opts.isAdmin) throw new WorkflowError("Overriding the final price needs admin permissions.");
    const settings = await getSettings(tx);
    const price = computePrice({
      operatorCost: edit.operatorCost ?? Number(q.operator_cost),
      markupPct: edit.markupPct !== undefined ? edit.markupPct : Number(q.markup_pct),
      cateringCost: edit.cateringCost ?? Number(q.catering_cost),
      vehicleCost: edit.vehicleCost ?? Number(q.vehicle_cost),
      otherCost: edit.otherCost ?? Number(q.other_cost),
      clientPriceOverride: edit.clientPriceOverride ?? null,
    }, settings.pricing);
    if (price.belowMinimum && !opts.isAdmin) {
      throw new WorkflowError(`Markup below the ${settings.pricing.min_markup_pct}% minimum needs admin approval.`);
    }
    await tx`update trip_quotes set
        operator_cost = ${price.operatorCost}, markup_pct = ${price.markupPct}, markup_amount = ${price.markupAmount},
        catering_cost = ${price.cateringCost}, vehicle_cost = ${price.vehicleCost}, other_cost = ${price.otherCost},
        other_cost_label = ${edit.otherCostLabel !== undefined ? edit.otherCostLabel : q.other_cost_label},
        client_price = ${price.clientPrice}, price_overridden = ${price.overridden || q.price_overridden},
        headline = ${edit.headline !== undefined ? edit.headline : q.headline},
        highlights = ${edit.highlights ?? q.highlights},
        availability = ${edit.availability ?? q.availability},
        passenger_capacity = ${edit.passengerCapacity !== undefined ? edit.passengerCapacity : q.passenger_capacity},
        expires_at = ${edit.expiresAt !== undefined ? edit.expiresAt : q.expires_at}
      where id = ${quoteId}`;
    const before = { operator_cost: Number(q.operator_cost), markup_pct: Number(q.markup_pct), catering: Number(q.catering_cost), vehicle: Number(q.vehicle_cost), other: Number(q.other_cost), client_price: Number(q.client_price) };
    const after = { operator_cost: price.operatorCost, markup_pct: price.markupPct, catering: price.cateringCost, vehicle: price.vehicleCost, other: price.otherCost, client_price: price.clientPrice };
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      await audit(tx, actorId, price.overridden ? "quote.price_overridden" : "quote.repriced", { type: "trip_quote", id: quoteId }, { old: before, new: after });
      await tripEvent(tx, q.trip_id, actorId, "quote", `Client price changed ${formatMoney(before.client_price)} to ${formatMoney(after.client_price)}`, { meta: { quote_id: quoteId } });
    }
  });
}

export async function reviewQuote(quoteId: string, decision: "approved" | "rejected", actorId: string, note?: string | null) {
  return withActor(actorId, async (tx) => {
    const [q] = await tx`select * from trip_quotes where id = ${quoteId} for update`;
    if (!q) throw new WorkflowError("Quote not found.");
    if (!["pending_review", "approved", "rejected"].includes(q.status)) throw new WorkflowError("This quote has already gone to the client.");
    await tx`update trip_quotes set status = ${decision}, reviewed_by = ${actorId}, reviewed_at = now() where id = ${quoteId}`;
    if (note?.trim()) await tx`insert into staff_notes (target_type, target_id, author_id, body) values ('quote', ${quoteId}, ${actorId}, ${note.trim()})`;
    if (decision === "approved") {
      const [t] = await tx`select status from trips where id = ${q.trip_id} for update`;
      if (["new_request", "searching", "quotes_received"].includes(t.status)) await setStatus(tx, q.trip_id, "broker_review");
    }
    await audit(tx, actorId, `quote.${decision}`, { type: "trip_quote", id: quoteId }, { old: q.status, new: decision, meta: { note } });
    await tripEvent(tx, q.trip_id, actorId, "quote", `Quote ${decision === "approved" ? "verified" : "rejected"}: ${q.aircraft_type}`, { meta: { quote_id: quoteId } });
  });
}

// Send up to three verified options (spec s7; blueprint s14). Replaces any
// options the client has not acted on yet.
export async function sendOptions(tripId: string, quoteIds: string[], actorId: string, message?: string | null) {
  const ids = [...new Set(quoteIds)].slice(0, 3);
  if (!ids.length) throw new WorkflowError("Pick at least one option.");
  if (quoteIds.length > 3) throw new WorkflowError("Send at most three options.");
  return withActor(actorId, async (tx) => {
    const trip = await lockTrip(tx, tripId, ["new_request", "searching", "quotes_received", "broker_review", "options_sent", "replacement_search", "operational_issue", "replacement_pending_client"]);
    const replacement = ["replacement_search", "operational_issue", "replacement_pending_client"].includes(trip.status);
    const quotes = await tx`select * from trip_quotes where trip_id = ${tripId} and id = any(${ids}) for update`;
    if (quotes.length !== ids.length) throw new WorkflowError("One of the options is not on this trip.");
    for (const q of quotes) {
      if (!["approved", "option_sent"].includes(q.status)) throw new WorkflowError(`Verify "${q.aircraft_type}" before sending it.`);
      if (q.availability === "unavailable") throw new WorkflowError(`"${q.aircraft_type}" is marked unavailable.`);
      if (q.passenger_capacity && q.passenger_capacity < trip.passengers) throw new WorkflowError(`"${q.aircraft_type}" seats ${q.passenger_capacity}, fewer than the ${trip.passengers} passengers.`);
    }
    const settings = await getSettings(tx);
    const defaultExpiry = new Date(Date.now() + settings.automation.option_expiry_hours * 3600000);
    await tx`update trip_quotes set status = 'withdrawn', option_rank = null
      where trip_id = ${tripId} and status = 'option_sent' and id <> all(${ids})`;
    for (const [i, id] of ids.entries()) {
      const q = quotes.find((x: { id: string }) => x.id === id);
      const expires = q.expires_at && new Date(q.expires_at) < defaultExpiry ? q.expires_at : defaultExpiry;
      await tx`update trip_quotes set status = 'option_sent', option_rank = ${i + 1}, sent_at = now(), expires_at = ${expires},
        is_replacement = ${replacement} where id = ${id}`;
    }
    await setStatus(tx, tripId, replacement ? "replacement_pending_client" : "options_sent");
    await audit(tx, actorId, replacement ? "options.replacement_sent" : "options.sent", { type: "trip", id: tripId }, {
      new: quotes.map((q: { id: string; client_price: string }) => ({ quote_id: q.id, client_price: Number(q.client_price) })),
    });
    const n = ids.length;
    await notifyClient(tx, tripId, replacement ? "REPLACEMENT_AVAILABLE" : "OPTIONS_READY", {
      title: replacement ? `Replacement aircraft options for ${trip.trip_number}` : `Your charter options for ${trip.trip_number}`,
      message: (message?.trim() || (replacement
        ? `We found ${n === 1 ? "a replacement aircraft" : `${n} replacement aircraft options`} for your trip. Please review and choose the one you would like us to confirm.`
        : `We found ${n === 1 ? "an aircraft option" : `${n} aircraft options`} for your requested trip. Please review the options and let us know which aircraft you would like to move forward with.`))
        + "\n\nPrices are estimates until your broker and the operator confirm availability.",
      link: tripLink(tripId),
    });
  });
}

// Broker verifies the client's pick (spec s8), then the contract is generated
// and sent (spec s9). Replacement picks skip the contract and go straight to
// operator confirmation; the price difference, if any, is handled by the
// broker as an exception.
export async function approveSelection(tripId: string, actorId: string) {
  return withActor(actorId, async (tx) => {
    const trip = await lockTrip(tx, tripId, ["client_selected"]);
    const [q] = await tx`select * from trip_quotes where id = ${trip.selected_quote_id} for update`;
    if (!q || q.status !== "client_selected") throw new WorkflowError("The client's selection could not be found.");

    if (q.is_replacement) {
      const [prev] = await tx`select * from operator_bookings where trip_id = ${tripId} and status in ('pending', 'requested', 'confirmed') order by created_at desc limit 1`;
      if (prev) {
        await tx`update operator_bookings set status = 'replaced' where id = ${prev.id}`;
        await tx`update trip_quotes set status = 'replaced' where id = ${prev.quote_id}`;
      }
      await tx`insert into operator_bookings (trip_id, quote_id, operator_id, aircraft_type, tail_number, status, created_by)
        values (${tripId}, ${q.id}, ${q.operator_id}, ${q.aircraft_type}, ${q.tail_number}, 'pending', ${actorId})`;
      await setStatus(tx, tripId, "operator_confirmation_pending");
      await audit(tx, actorId, "replacement.approved", { type: "trip", id: tripId }, {
        old: prev ? { quote_id: prev.quote_id, aircraft: prev.aircraft_type } : null,
        new: { quote_id: q.id, aircraft: q.aircraft_type, client_price: Number(q.client_price) },
      });
      await tripEvent(tx, tripId, actorId, "operator", `Replacement approved: ${q.aircraft_type}. Confirm it with the operator.`, { clientVisible: true });
      return { contractId: null };
    }

    const r = await renderContract(tx, tripId, q.id);
    await tx`update trip_contracts set status = 'void', voided_at = now(), void_reason = 'Superseded' where trip_id = ${tripId} and status in ('draft', 'sent')`;
    const [c] = await tx`insert into trip_contracts (contract_number, trip_id, client_id, quote_id, template_id, template_version,
        rendered_body, body_sha256, total_amount, currency, status, sent_at, created_by)
      values (${r.contractNumber}, ${tripId}, ${trip.client_id}, ${q.id}, ${r.template.id}, ${r.template.version},
        ${r.rendered}, ${r.sha}, ${q.client_price}, ${q.currency}, 'sent', now(), ${actorId})
      returning id`;
    await setStatus(tx, tripId, "contract_sent");
    await audit(tx, actorId, "contract.generated", { type: "trip_contract", id: c.id }, {
      new: { contract_number: r.contractNumber, template_version: r.template.version, total: Number(q.client_price), sha256: r.sha },
    });
    await notifyClient(tx, tripId, "CONTRACT_READY", {
      title: `Your charter agreement for ${trip.trip_number} is ready`,
      message: `Your broker has confirmed the ${q.aircraft_type} for your trip. Please review and sign your charter agreement. Payment opens once it is signed.`,
      link: `${tripLink(tripId)}/contract`,
    });
    return { contractId: c.id as string };
  });
}

// The selected aircraft turned out to be unavailable or mispriced.
export async function declineSelection(tripId: string, reason: string, actorId: string) {
  return withActor(actorId, async (tx) => {
    const trip = await lockTrip(tx, tripId, ["client_selected", "contract_sent"]);
    await tx`update trip_quotes set status = 'withdrawn' where id = ${trip.selected_quote_id}`;
    await tx`update trip_contracts set status = 'void', voided_at = now(), void_reason = ${reason} where trip_id = ${tripId} and status = 'sent'`;
    await tx`update trips set selected_quote_id = null where id = ${tripId}`;
    const [was] = await tx`select is_replacement from trip_quotes where id = ${trip.selected_quote_id}`;
    await setStatus(tx, tripId, was?.is_replacement ? "replacement_search" : "broker_review");
    await audit(tx, actorId, "selection.declined", { type: "trip", id: tripId }, { meta: { reason, quote_id: trip.selected_quote_id } });
    await notifyClient(tx, tripId, "OPTIONS_READY", {
      title: `An update on your trip ${trip.trip_number}`,
      message: `The aircraft you selected is no longer available as quoted.${reason ? ` ${reason}` : ""} Your broker is preparing updated options and will send them shortly.`,
      link: tripLink(tripId),
    });
  });
}

// ---------------------------------------------------------------------------
// Payments (spec s10, s11; blueprint s19-s21). Finance or admin.
// ---------------------------------------------------------------------------
export async function setPaymentStatus(paymentId: string, to: "received" | "verified" | "failed" | "refunded", actorId: string, note?: string | null) {
  return withActor(actorId, async (tx) => {
    const [p] = await tx`select * from trip_payments where id = ${paymentId} for update`;
    if (!p) throw new WorkflowError("Payment not found.");
    const allowed: Record<string, string[]> = {
      received: ["pending", "submitted"],
      verified: ["pending", "submitted", "received"],
      failed: ["pending", "submitted", "received"],
      refunded: ["verified", "received"],
    };
    if (!allowed[to]!.includes(p.status)) throw new WorkflowError(`A ${p.status} payment cannot be marked ${to}.`);
    const trip = await lockTrip(tx, p.trip_id);
    await tx`update trip_payments set status = ${to},
      received_at = case when ${to} in ('received', 'verified') then coalesce(received_at, now()) else received_at end,
      verified_at = case when ${to} = 'verified' then now() else verified_at end,
      verified_by = case when ${to} = 'verified' then ${actorId}::uuid else verified_by end,
      failure_reason = case when ${to} = 'failed' then ${note ?? null} else failure_reason end
      where id = ${paymentId}`;
    await audit(tx, actorId, `payment.${to}`, { type: "trip_payment", id: paymentId }, { old: p.status, new: to, meta: { amount: Number(p.amount), note } });
    const amount = formatMoney(p.amount, p.currency);
    if (to === "verified") {
      if (trip.status === "payment_pending" || trip.status === "contract_signed") await setStatus(tx, trip.id, "payment_received");
      await tripEvent(tx, trip.id, actorId, "payment", `Payment of ${amount} verified`, { clientVisible: true });
      await notifyClient(tx, trip.id, "PAYMENT_RECEIVED", {
        title: `Payment received for ${trip.trip_number}`,
        message: `We have received and verified your payment of ${amount}. We are now confirming the aircraft with the operator and will let you know as soon as your trip is confirmed.`,
        link: tripLink(trip.id),
      });
      await notifyStaff(tx, trip.id, "PAYMENT_RECEIVED", { title: `${trip.trip_number}: payment verified`, message: `${amount} verified. Pay the operator and request confirmation.`, link: deskLink(trip.id) });
    } else if (to === "failed") {
      await tripEvent(tx, trip.id, actorId, "payment", `Payment could not be verified${note ? `: ${note}` : ""}`, { clientVisible: true });
      await notifyClient(tx, trip.id, "PAYMENT_FAILED", {
        title: `Action needed: payment for ${trip.trip_number}`,
        message: `We could not verify your payment of ${amount}.${note ? `\n\n${note}` : ""}\n\nPlease review the payment details in the app or contact your broker.`,
        link: `${tripLink(trip.id)}/pay`,
      });
    } else {
      await tripEvent(tx, trip.id, actorId, "payment", `Payment ${to}: ${amount}`, { clientVisible: to === "refunded" });
    }
  });
}

export async function recordOperatorPayment(tripId: string, input: {
  amount: number; method: PaymentMethod | null; paymentDate: string | null; reference: string | null; proofPath: string | null; notes: string | null;
}, actorId: string) {
  if (!(input.amount > 0)) throw new WorkflowError("Enter the amount paid to the operator.");
  return withActor(actorId, async (tx) => {
    const trip = await lockTrip(tx, tripId);
    const [paid] = await tx`select 1 from trip_payments where trip_id = ${tripId} and status = 'verified'`;
    if (!paid) throw new WorkflowError("Verify the client's payment before paying the operator.");
    const [q] = await tx`select * from trip_quotes where id = ${trip.selected_quote_id}`;
    if (!q) throw new WorkflowError("No selected aircraft on this trip.");
    const [ob] = await tx`select id from operator_bookings where trip_id = ${tripId} and quote_id = ${q.id} order by created_at desc limit 1`;
    const [op] = await tx`insert into operator_payments (trip_id, operator_id, operator_booking_id, amount, currency, method, status, payment_date, confirmation_reference, proof_path, notes, recorded_by)
      values (${tripId}, ${q.operator_id}, ${ob?.id ?? null}, ${input.amount}, ${q.currency}, ${input.method}, 'sent', ${input.paymentDate}, ${input.reference}, ${input.proofPath}, ${input.notes}, ${actorId})
      returning id`;
    await audit(tx, actorId, "operator_payment.recorded", { type: "operator_payment", id: op.id }, {
      new: { amount: input.amount, method: input.method, reference: input.reference }, meta: { operator_cost: Number(q.operator_cost) },
    });
    await tripEvent(tx, tripId, actorId, "payment", `Operator paid ${formatMoney(input.amount)}${input.method ? ` by ${PAYMENT_METHOD_LABELS[input.method]}` : ""}`);
  });
}

// ---------------------------------------------------------------------------
// Operator confirmation (spec s12)
// ---------------------------------------------------------------------------
export async function requestOperatorConfirmation(tripId: string, input: { contact: string | null; email: string | null; phone: string | null; notes: string | null }, actorId: string) {
  return withActor(actorId, async (tx) => {
    const trip = await lockTrip(tx, tripId, ["payment_received", "operator_confirmation_pending"]);
    const [q] = await tx`select * from trip_quotes where id = ${trip.selected_quote_id}`;
    if (!q) throw new WorkflowError("No selected aircraft on this trip.");
    const [existing] = await tx`select id from operator_bookings where trip_id = ${tripId} and quote_id = ${q.id} and status in ('pending', 'requested')`;
    if (existing) {
      await tx`update operator_bookings set status = 'requested', requested_at = now(), operator_contact = ${input.contact}, operator_email = ${input.email},
        operator_phone = ${input.phone}, notes = ${input.notes} where id = ${existing.id}`;
    } else {
      await tx`insert into operator_bookings (trip_id, quote_id, operator_id, aircraft_type, tail_number, operator_contact, operator_email, operator_phone, status, requested_at, notes, created_by)
        values (${tripId}, ${q.id}, ${q.operator_id}, ${q.aircraft_type}, ${q.tail_number}, ${input.contact}, ${input.email}, ${input.phone}, 'requested', now(), ${input.notes}, ${actorId})`;
    }
    await setStatus(tx, tripId, "operator_confirmation_pending");
    await tripEvent(tx, tripId, actorId, "operator", "Trip details and payment sent to the operator for confirmation");
  });
}

export async function confirmOperator(tripId: string, input: { confirmationNumber: string; tailNumber: string | null; crew: string | null }, actorId: string) {
  if (!input.confirmationNumber.trim()) throw new WorkflowError("Enter the operator's confirmation number.");
  return withActor(actorId, async (tx) => {
    const trip = await lockTrip(tx, tripId, ["operator_confirmation_pending", "payment_received"]);
    // Blueprint s20: contract signed + payment verified + operator confirmation.
    const [signed] = await tx`select 1 from trip_contracts where trip_id = ${tripId} and status = 'signed'`;
    const [paid] = await tx`select 1 from trip_payments where trip_id = ${tripId} and status = 'verified'`;
    if (!signed) throw new WorkflowError("The client has not signed the contract.");
    if (!paid) throw new WorkflowError("The client's payment has not been verified.");
    const [ob] = await tx`select * from operator_bookings where trip_id = ${tripId} and quote_id = ${trip.selected_quote_id}
      and status in ('pending', 'requested') order by created_at desc limit 1 for update`;
    const [q] = await tx`select * from trip_quotes where id = ${trip.selected_quote_id}`;
    if (ob) {
      await tx`update operator_bookings set status = 'confirmed', confirmed_at = now(), confirmation_number = ${input.confirmationNumber.trim()},
        tail_number = coalesce(${input.tailNumber}, tail_number), crew = ${input.crew} where id = ${ob.id}`;
    } else {
      await tx`insert into operator_bookings (trip_id, quote_id, operator_id, aircraft_type, tail_number, crew, confirmation_number, status, confirmed_at, created_by)
        values (${tripId}, ${q.id}, ${q.operator_id}, ${q.aircraft_type}, ${input.tailNumber ?? q.tail_number}, ${input.crew}, ${input.confirmationNumber.trim()}, 'confirmed', now(), ${actorId})`;
    }
    await tx`update trip_quotes set status = 'booked', tail_number = coalesce(${input.tailNumber}, tail_number) where id = ${q.id}`;
    // A replacement confirmation resolves the open issue and keeps an
    // existing itinerary flow going (a new version is published next).
    await tx`update trip_issues set resolved_at = now(), resolved_by = ${actorId}, resolution = ${`Replaced with ${q.aircraft_type}`}
      where trip_id = ${tripId} and resolved_at is null`;
    const [hadItinerary] = await tx`select 1 from client_itineraries where trip_id = ${tripId} and status = 'published'`;
    await setStatus(tx, tripId, hadItinerary ? "itinerary_pending" : "confirmed");
    await audit(tx, actorId, "operator.confirmed", { type: "trip", id: tripId }, { new: { confirmation_number: input.confirmationNumber, tail: input.tailNumber, quote_id: q.id } });
    await notifyClient(tx, tripId, "TRIP_CONFIRMED", {
      title: `Your trip ${trip.trip_number} is confirmed`,
      message: `Your ${q.aircraft_type} is confirmed with the operator. Your itinerary will follow shortly.`,
      link: tripLink(tripId),
    });
  });
}

// ---------------------------------------------------------------------------
// Itineraries (spec s13; blueprint s22, s23). Versions are never overwritten.
// ---------------------------------------------------------------------------
export async function addOperatorItinerary(tripId: string, input: { documentPath: string | null; fileName: string | null; details: Record<string, unknown> }, actorId: string) {
  return withActor(actorId, async (tx) => {
    const trip = await lockTrip(tx, tripId);
    const [ob] = await tx`select id from operator_bookings where trip_id = ${tripId} and status = 'confirmed' order by confirmed_at desc limit 1`;
    const [row] = await tx`insert into operator_itineraries (trip_id, operator_booking_id, document_path, file_name, details, uploaded_by)
      values (${tripId}, ${ob?.id ?? null}, ${input.documentPath}, ${input.fileName}, ${tx.json(input.details)}, ${actorId}) returning id`;
    if (trip.status === "confirmed") await setStatus(tx, tripId, "itinerary_pending");
    await tripEvent(tx, tripId, actorId, "itinerary", `Operator itinerary received${input.fileName ? `: ${input.fileName}` : ""}`);
    return row.id as string;
  });
}

export type ItineraryLeg = {
  from: string; to: string; depart_local: string; arrive_local?: string | null;
  from_fbo?: string | null; to_fbo?: string | null; flight_time?: string | null;
};
export type ItineraryContent = {
  aircraft: string; tail_number?: string | null; operator: string;
  legs: ItineraryLeg[];
  passengers: number;
  crew?: string | null;
  catering?: string | null;
  ground_transport?: string | null;
  notes?: string | null;
  contacts?: string | null;
};

export async function saveClientItinerary(tripId: string, content: ItineraryContent, changeSummary: string | null, operatorItineraryId: string | null, actorId: string) {
  return withActor(actorId, async (tx) => {
    await lockTrip(tx, tripId);
    const [draft] = await tx`select id from client_itineraries where trip_id = ${tripId} and status = 'draft' order by version desc limit 1`;
    if (draft) {
      await tx`update client_itineraries set content = ${tx.json(content)}, change_summary = ${changeSummary}, operator_itinerary_id = ${operatorItineraryId} where id = ${draft.id}`;
      return draft.id as string;
    }
    const [{ v }] = await tx`select coalesce(max(version), 0) + 1 as v from client_itineraries where trip_id = ${tripId}`;
    const [row] = await tx`insert into client_itineraries (trip_id, version, operator_itinerary_id, content, change_summary, created_by)
      values (${tripId}, ${v}, ${operatorItineraryId}, ${tx.json(content)}, ${changeSummary}, ${actorId}) returning id`;
    return row.id as string;
  });
}

export async function publishItinerary(itineraryId: string, actorId: string) {
  return withActor(actorId, async (tx) => {
    const [it] = await tx`select * from client_itineraries where id = ${itineraryId} for update`;
    if (!it || it.status !== "draft") throw new WorkflowError("Only a draft itinerary can be published.");
    const trip = await lockTrip(tx, it.trip_id, ["confirmed", "itinerary_pending", "itinerary_ready", "within_72_hours", "active"]);
    await tx`update client_itineraries set status = 'superseded' where trip_id = ${it.trip_id} and status = 'published'`;
    await tx`update client_itineraries set status = 'published', published_at = now(), sent_at = now() where id = ${itineraryId}`;
    if (["confirmed", "itinerary_pending"].includes(trip.status)) {
      const [s] = await tx`select (value->>'reminder_hours')::numeric as h from app_settings where key = 'automation'`;
      const within = new Date(trip.depart_at).getTime() - Date.now() <= Number(s?.h ?? 72) * 3600000;
      await setStatus(tx, it.trip_id, within ? "within_72_hours" : "itinerary_ready");
    }
    await audit(tx, actorId, "itinerary.published", { type: "client_itinerary", id: itineraryId }, { new: { version: it.version, summary: it.change_summary } });
    await notifyClient(tx, it.trip_id, "ITINERARY_READY", {
      title: it.version > 1 ? `Updated itinerary for ${trip.trip_number}` : `Your itinerary for ${trip.trip_number}`,
      message: it.version > 1
        ? `Your itinerary has been updated${it.change_summary ? `: ${it.change_summary}` : ""}. Please review the latest version.`
        : "Your trip itinerary is ready. You can view it in the app or download a copy.",
      link: `${tripLink(it.trip_id)}/itinerary`,
    });
  });
}

// ---------------------------------------------------------------------------
// Operations: AOG / replacement (spec s17-s19; blueprint s27, s28)
// ---------------------------------------------------------------------------
export async function reportIssue(tripId: string, input: { kind: string; description: string; via: string }, actorId: string | null) {
  if (!input.description.trim()) throw new WorkflowError("Describe the issue.");
  return withActor(actorId, async (tx) => {
    const trip = await lockTrip(tx, tripId, ["confirmed", "itinerary_pending", "itinerary_ready", "within_72_hours", "active", "operator_confirmation_pending", "payment_received"]);
    await tx`insert into trip_issues (trip_id, kind, description, reported_via, reported_by, previous_status)
      values (${tripId}, ${input.kind}, ${input.description.trim()}, ${input.via}, ${actorId}, ${trip.status})`;
    await setStatus(tx, tripId, "operational_issue");
    await audit(tx, actorId, "trip.operational_issue", { type: "trip", id: tripId }, { old: trip.status, new: "operational_issue", meta: input });
    await notifyStaff(tx, tripId, "OPERATIONAL_ALERT", {
      title: `${trip.trip_number}: replacement aircraft required`,
      message: `${input.kind.replace(/_/g, " ")}: ${input.description.trim()}\n\nDeparture ${new Date(trip.depart_at).toUTCString()}. Start the replacement search now.`,
      link: deskLink(tripId),
    }, { urgent: true });
  });
}

export async function startReplacementSearch(tripId: string, actorId: string) {
  return withActor(actorId, async (tx) => {
    await lockTrip(tx, tripId, ["operational_issue", "replacement_search"]);
    await setStatus(tx, tripId, "replacement_search");
  });
}

// Issue turned out to be a false alarm: put the trip back where it was.
export async function resolveIssueNoChange(tripId: string, resolution: string, actorId: string) {
  return withActor(actorId, async (tx) => {
    await lockTrip(tx, tripId, ["operational_issue", "replacement_search"]);
    const [issue] = await tx`select * from trip_issues where trip_id = ${tripId} and resolved_at is null order by created_at desc limit 1`;
    await tx`update trip_issues set resolved_at = now(), resolved_by = ${actorId}, resolution = ${resolution} where trip_id = ${tripId} and resolved_at is null`;
    await tx`update trip_quotes set status = 'withdrawn' where trip_id = ${tripId} and is_replacement and status in ('pending_review', 'approved')`;
    await setStatus(tx, tripId, issue?.previous_status ?? "confirmed");
    await audit(tx, actorId, "trip.issue_resolved", { type: "trip", id: tripId }, { meta: { resolution } });
  });
}

// ---------------------------------------------------------------------------
// Flight and completion (spec s16, s20, s21)
// ---------------------------------------------------------------------------
export async function markActive(tripId: string, actorId: string | null) {
  return withActor(actorId, async (tx) => {
    await lockTrip(tx, tripId, ["confirmed", "itinerary_pending", "itinerary_ready", "within_72_hours"]);
    await setStatus(tx, tripId, "active");
  });
}

export async function completeTrip(tripId: string, actorId: string | null) {
  return withActor(actorId, async (tx) => {
    const trip = await lockTrip(tx, tripId, ["active", "within_72_hours", "itinerary_ready", "confirmed", "itinerary_pending"]);
    await tx`update trips set status = 'completed', completed_at = now() where id = ${tripId}`;
    await audit(tx, actorId, "trip.completed", { type: "trip", id: tripId }, { old: trip.status, new: "completed" });
    const [company] = await tx`select value->>'name' as name from app_settings where key = 'company'`;
    await notifyClient(tx, tripId, "TRIP_COMPLETED", {
      title: `Thank you for flying with ${company?.name ?? "us"}`,
      message: "Thank you for flying with us. We appreciate the opportunity to assist with your trip.",
      link: tripLink(tripId),
    });
    await notifyClient(tx, tripId, "FEEDBACK_REQUEST", {
      title: "How was your trip?",
      message: "What did you think about your experience? A quick rating helps us look after you better next time.",
      link: `${tripLink(tripId)}#feedback`,
    });
    await tx`update trips set thank_you_sent_at = now(), status = 'feedback_requested' where id = ${tripId}`;
  });
}

export async function closeTrip(tripId: string, actorId: string | null) {
  return withActor(actorId, async (tx) => {
    await lockTrip(tx, tripId, ["completed", "feedback_requested"]);
    await tx`update trips set status = 'closed', closed_at = now() where id = ${tripId}`;
  });
}

// Client feedback arrived (via RPC). Staff get told; low ratings flagged.
export async function feedbackReceived(tripId: string) {
  return withActor(null, async (tx) => {
    const [f] = await tx`select f.rating, t.trip_number from trip_feedback f join trips t on t.id = f.trip_id where f.trip_id = ${tripId}`;
    if (!f) return;
    await notifyStaff(tx, tripId, "FEEDBACK_RECEIVED", {
      title: `${f.trip_number}: ${f.rating}-star feedback`,
      message: f.rating <= 3 ? "The client left a low rating. Please review and follow up." : "The client left feedback on their trip.",
      link: deskLink(tripId),
    }, { urgent: f.rating <= 2 });
  });
}

// Client-side events that staff must hear about. Called after the client RPCs.
export async function clientActed(tripId: string, what: "selected" | "signed" | "paid" | "requested") {
  return withActor(null, async (tx) => {
    const [t] = await tx`select t.*, c.full_name from trips t join clients c on c.id = t.client_id where t.id = ${tripId}`;
    if (!t) return;
    const who = t.full_name;
    if (what === "requested") {
      await notifyStaff(tx, tripId, "NEW_TRIP_REQUEST", { title: `New trip request ${t.trip_number}`, message: `${who} requested ${t.origin_icao} to ${t.destination_icao}, ${t.passengers} passengers.`, link: deskLink(tripId) });
    } else if (what === "selected") {
      const [q] = await tx`select aircraft_type, client_price, is_replacement from trip_quotes where id = ${t.selected_quote_id}`;
      await notifyStaff(tx, tripId, q?.is_replacement ? "REPLACEMENT_SELECTED" : "CLIENT_SELECTED", {
        title: `${t.trip_number}: client selected an aircraft`,
        message: `${who} selected ${q?.aircraft_type ?? "an option"} at ${formatMoney(q?.client_price)}. Verify availability and approve.`,
        link: deskLink(tripId),
      }, { urgent: Boolean(q?.is_replacement) });
    } else if (what === "signed") {
      await notifyStaff(tx, tripId, "CONTRACT_SIGNED", { title: `${t.trip_number}: contract signed`, message: `${who} signed the charter agreement. Payment is now due.`, link: deskLink(tripId) });
    } else if (what === "paid") {
      await notifyStaff(tx, tripId, "PAYMENT_SUBMITTED", { title: `${t.trip_number}: payment submitted`, message: `${who} reports a payment was sent. Verify it against the account.`, link: `/desk/payments` }, { finance: true });
    }
  });
}
