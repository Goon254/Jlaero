"use server";

// Broker workspace actions for one trip. Each is a thin permission + parsing
// layer over lib/trips/workflow.ts, which owns status guards, audit and
// notifications. Signature: (tripId, prev, formData) bound per trip.
import { revalidatePath } from "next/cache";
import { localToInstant, PAYMENT_METHODS, type PaymentMethod } from "@jlaero/shared";
import { db } from "@/lib/db";
import { assertStaff } from "@/lib/trips/access";
import { bool, failure, num, str, type ActionState } from "@/lib/trips/action-state";
import { flushNotifications } from "@/lib/trips/notify";
import * as wf from "@/lib/trips/workflow";
import { approveAndSend, createRfqRound, extractPastedQuote } from "@/lib/sourcing/engine";
import { createClient } from "@/lib/supabase/server";

function done(tripId: string, message: string): ActionState {
  revalidatePath(`/desk/trips/${tripId}`);
  revalidatePath("/desk");
  revalidatePath(`/trips/${tripId}`);
  return { ok: true, message };
}

async function afterNotify() {
  try { await flushNotifications(); } catch (e) { console.error("notification flush failed", e); }
}

async function run(tripId: string, cap: "broker" | "finance" | "admin", fn: (userId: string, isAdmin: boolean) => Promise<string>): Promise<ActionState> {
  try {
    const user = await assertStaff(cap);
    const message = await fn(user.id, user.isAdmin);
    await afterNotify();
    return done(tripId, message);
  } catch (e) {
    return failure(e);
  }
}

// ---------------------------------------------------------------------------
// Trip management
// ---------------------------------------------------------------------------
export async function assignBrokerAction(tripId: string, _p: ActionState, f: FormData) {
  return run(tripId, "broker", async (uid) => {
    await wf.assignBroker(tripId, str(f, "broker_id"), uid);
    return "Broker updated";
  });
}

export async function updateTripAction(tripId: string, _p: ActionState, f: FormData) {
  return run(tripId, "broker", async (uid) => {
    const origin = str(f, "origin")?.toUpperCase() ?? null;
    const destination = str(f, "destination")?.toUpperCase() ?? null;
    const departureDate = str(f, "departure_date");
    if (!origin || !destination || !departureDate) throw new Error("Origin, destination and departure date are required.");
    const departureTime = str(f, "departure_time");
    const returnDate = str(f, "return_date");
    const returnTime = str(f, "return_time");
    const tz = await db()`select icao, tz from airports where icao = any(${[origin, destination]})`;
    const tzOf = (icao: string) => tz.find((a) => a.icao === icao);
    if (!tzOf(origin) || !tzOf(destination)) throw new Error("Pick airports from the list.");
    const departAt = localToInstant(departureDate, departureTime, tzOf(origin)!.tz);
    const returnAt = returnDate ? localToInstant(returnDate, returnTime, tzOf(destination)!.tz) : null;
    if (returnAt && returnAt <= departAt) throw new Error("Return must be after departure.");
    const pax = num(f, "passengers");
    if (!pax || pax < 1) throw new Error("Enter the passenger count.");
    await wf.updateTrip(tripId, {
      origin_icao: origin, destination_icao: destination,
      departure_date: departureDate, departure_time: departureTime, depart_at: departAt,
      return_date: returnDate, return_time: returnDate ? returnTime : null, return_at: returnAt,
      passengers: pax, aircraft_category: str(f, "aircraft_category"), aircraft_preference: str(f, "aircraft_preference"),
      vehicle_required: bool(f, "vehicle_required"), catering_required: bool(f, "catering_required"),
      special_requests: str(f, "special_requests"), search_radius_miles: num(f, "search_radius_miles") ?? undefined,
    }, uid);
    return "Trip saved";
  });
}

export async function addNoteAction(tripId: string, _p: ActionState, f: FormData) {
  return run(tripId, "broker", async (uid) => {
    await wf.addNote({ type: "trip", id: tripId }, str(f, "body") ?? "", uid);
    return "Note added";
  });
}

export async function cancelTripAction(tripId: string, _p: ActionState, f: FormData) {
  return run(tripId, "broker", async (uid) => {
    const reason = str(f, "reason");
    if (!reason) throw new Error("Give a reason for the cancellation.");
    await wf.cancelTrip(tripId, reason, uid, bool(f, "notify_client"));
    return "Trip cancelled";
  });
}

// ---------------------------------------------------------------------------
// Sourcing: AI operator search + RFQ emails (blueprint s9-s11)
// ---------------------------------------------------------------------------
export async function startSearchAction(tripId: string, _p: ActionState, _f: FormData) {
  return run(tripId, "broker", async (uid) => {
    await wf.startSearch(tripId, uid).catch(() => undefined);
    const r = await createRfqRound(tripId, uid);
    return `${r.candidates} operators matched${r.drafted ? `, ${r.drafted} emails drafted by AI` : ""}. Review and send below.`;
  });
}

export async function sendRfqAction(tripId: string, recipientId: string, _p: ActionState, f: FormData) {
  return run(tripId, "broker", async (uid) => {
    const toEmail = str(f, "to_email");
    if (!toEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(toEmail)) throw new Error("Enter the operator's email address.");
    await approveAndSend(recipientId, uid, { toEmail, subject: str(f, "subject") ?? undefined, body: str(f, "body") ?? undefined });
    const [r] = await db()`select operator_id from rfq_recipients where id = ${recipientId}`;
    if (r) {
      await db()`insert into operator_contacts (operator_id, email, source, is_primary) values (${r.operator_id}, ${toEmail.toLowerCase()}, 'manual', true)
        on conflict (lower(email)) do nothing`;
    }
    return "RFQ sent";
  });
}

export async function skipRfqAction(tripId: string, recipientId: string, _p: ActionState, _f: FormData) {
  return run(tripId, "broker", async () => {
    await db()`update rfq_recipients set status = 'declined', last_event_at = now() where id = ${recipientId} and status = 'draft'`;
    return "Skipped";
  });
}

// ---------------------------------------------------------------------------
// Quotes (spec s5-s7; blueprint s7, s8, s11C, s12, s14)
// ---------------------------------------------------------------------------
async function resolveOperator(f: FormData, uid: string, isAdmin: boolean) {
  const existing = str(f, "operator_id");
  if (existing) return existing;
  const name = str(f, "new_operator_name");
  if (!name) throw new Error("Choose an operator or enter a new operator name.");
  // Brokers can add an operator on the fly for a manual quote; it enters as
  // a prospect so an admin still approves it into the network.
  const [o] = await db()`insert into operators (name, general_email, phone, network_status, source)
    values (${name}, ${str(f, "new_operator_email")}, ${str(f, "new_operator_phone")}, ${isAdmin ? "approved" : "prospect"}, 'manual') returning id`;
  if (!o) throw new Error("Could not add the operator.");
  await db()`insert into audit_logs (actor_id, action, target_type, target_id, new_value) values (${uid}, 'operator.created', 'operator', ${o.id}, ${db().json({ name })})`;
  return o.id as string;
}

export async function addQuoteAction(tripId: string, _p: ActionState, f: FormData) {
  return run(tripId, "broker", async (uid, isAdmin) => {
    const operatorId = await resolveOperator(f, uid, isAdmin);
    const expires = str(f, "expires_at");
    await wf.addQuote(tripId, {
      operatorId,
      aircraftType: str(f, "aircraft_type") ?? "",
      aircraftCategory: str(f, "aircraft_category"),
      tailNumber: str(f, "tail_number"),
      yearMfr: num(f, "year_mfr"),
      passengerCapacity: num(f, "passenger_capacity"),
      availability: (str(f, "availability") as "available" | "pending" | "unavailable" | "unknown" | null) ?? "unknown",
      operatorCost: num(f, "operator_cost") ?? 0,
      markupPct: num(f, "markup_pct"),
      cateringCost: num(f, "catering_cost"),
      vehicleCost: num(f, "vehicle_cost"),
      otherCost: num(f, "other_cost"),
      otherCostLabel: str(f, "other_cost_label"),
      expiresAt: expires ? new Date(expires) : null,
      restrictions: str(f, "restrictions"),
      notes: str(f, "notes"),
      source: "manual",
    }, uid, { isAdmin });
    return "Manual quote added";
  });
}

export async function pasteQuoteAction(tripId: string, _p: ActionState, f: FormData) {
  return run(tripId, "broker", async (uid, isAdmin) => {
    const text = str(f, "text");
    if (!text) throw new Error("Paste the operator's quote text.");
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("AI extraction is not configured. Enter the quote manually.");
    const operatorId = await resolveOperator(f, uid, isAdmin);
    await extractPastedQuote(tripId, operatorId, text, uid);
    return "AI read the quote. Verify it below before sending.";
  });
}

export async function updateQuoteAction(tripId: string, quoteId: string, _p: ActionState, f: FormData) {
  return run(tripId, "broker", async (uid, isAdmin) => {
    const override = num(f, "client_price_override");
    const highlights = str(f, "highlights");
    const expires = str(f, "expires_at");
    await wf.updateQuote(quoteId, {
      operatorCost: num(f, "operator_cost"),
      markupPct: num(f, "markup_pct"),
      cateringCost: num(f, "catering_cost"),
      vehicleCost: num(f, "vehicle_cost"),
      otherCost: num(f, "other_cost"),
      otherCostLabel: str(f, "other_cost_label"),
      clientPriceOverride: override,
      headline: str(f, "headline"),
      highlights: highlights ? highlights.split("\n").map((s) => s.trim()).filter(Boolean) : null,
      availability: str(f, "availability"),
      passengerCapacity: num(f, "passenger_capacity"),
      expiresAt: expires ? new Date(expires) : undefined,
    }, uid, { isAdmin });
    return "Quote updated";
  });
}

export async function reviewQuoteAction(tripId: string, quoteId: string, decision: "approved" | "rejected", _p: ActionState, f: FormData) {
  return run(tripId, "broker", async (uid) => {
    await wf.reviewQuote(quoteId, decision, uid, str(f, "note"));
    return decision === "approved" ? "Quote verified" : "Quote rejected";
  });
}

export async function sendOptionsAction(tripId: string, _p: ActionState, f: FormData) {
  return run(tripId, "broker", async (uid) => {
    const ranked = [1, 2, 3].map((i) => str(f, `option_${i}`)).filter(Boolean) as string[];
    if (new Set(ranked).size !== ranked.length) throw new Error("Each option slot needs a different quote.");
    await wf.sendOptions(tripId, ranked, uid, str(f, "message"));
    return `${ranked.length} option${ranked.length === 1 ? "" : "s"} sent to the client`;
  });
}

export async function approveSelectionAction(tripId: string, _p: ActionState, _f: FormData) {
  return run(tripId, "broker", async (uid) => {
    const r = await wf.approveSelection(tripId, uid);
    return r.contractId ? "Selection approved. Contract generated and sent to the client." : "Replacement approved. Confirm it with the operator.";
  });
}

export async function declineSelectionAction(tripId: string, _p: ActionState, f: FormData) {
  return run(tripId, "broker", async (uid) => {
    await wf.declineSelection(tripId, str(f, "reason") ?? "", uid);
    return "Selection declined; the client was told new options are coming.";
  });
}

// ---------------------------------------------------------------------------
// Payments and operator (spec s10-s12; blueprint s19-s21)
// ---------------------------------------------------------------------------
export async function paymentStatusAction(tripId: string, paymentId: string, to: "received" | "verified" | "failed" | "refunded", _p: ActionState, f: FormData) {
  return run(tripId, "finance", async (uid) => {
    await wf.setPaymentStatus(paymentId, to, uid, str(f, "note"));
    return `Payment marked ${to}`;
  });
}

async function uploadDoc(tripId: string, file: File | null, folder: "staff") {
  if (!file || file.size === 0) return null;
  if (file.size > 15 * 1024 * 1024) throw new Error("Files must be under 15 MB.");
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  const path = `${tripId}/${folder}/${Date.now()}-${safe}`;
  const supabase = await createClient();
  const { error } = await supabase.storage.from("trip-docs").upload(path, file, { contentType: file.type || "application/octet-stream" });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return { path, name: file.name };
}

export async function recordOperatorPaymentAction(tripId: string, _p: ActionState, f: FormData) {
  return run(tripId, "finance", async (uid) => {
    const method = str(f, "method");
    const proof = await uploadDoc(tripId, f.get("proof") as File | null, "staff");
    await wf.recordOperatorPayment(tripId, {
      amount: num(f, "amount") ?? 0,
      method: method && (PAYMENT_METHODS as readonly string[]).includes(method) ? (method as PaymentMethod) : null,
      paymentDate: str(f, "payment_date"),
      reference: str(f, "reference"),
      proofPath: proof?.path ?? null,
      notes: str(f, "notes"),
    }, uid);
    return "Operator payment recorded";
  });
}

export async function requestConfirmationAction(tripId: string, _p: ActionState, f: FormData) {
  return run(tripId, "broker", async (uid) => {
    await wf.requestOperatorConfirmation(tripId, { contact: str(f, "contact"), email: str(f, "email"), phone: str(f, "phone"), notes: str(f, "notes") }, uid);
    return "Marked as sent to the operator";
  });
}

export async function confirmOperatorAction(tripId: string, _p: ActionState, f: FormData) {
  return run(tripId, "broker", async (uid) => {
    await wf.confirmOperator(tripId, { confirmationNumber: str(f, "confirmation_number") ?? "", tailNumber: str(f, "tail_number"), crew: str(f, "crew") }, uid);
    return "Operator confirmed. The client has been notified.";
  });
}

// ---------------------------------------------------------------------------
// Itinerary (spec s13; blueprint s22, s23)
// ---------------------------------------------------------------------------
export async function uploadOperatorItineraryAction(tripId: string, _p: ActionState, f: FormData) {
  return run(tripId, "broker", async (uid) => {
    const doc = await uploadDoc(tripId, f.get("document") as File | null, "staff");
    const notes = str(f, "notes");
    if (!doc && !notes) throw new Error("Attach the operator's itinerary or enter its details.");
    await wf.addOperatorItinerary(tripId, { documentPath: doc?.path ?? null, fileName: doc?.name ?? null, details: notes ? { notes } : {} }, uid);
    return "Operator itinerary saved";
  });
}

export async function saveItineraryAction(tripId: string, _p: ActionState, f: FormData) {
  return run(tripId, "broker", async (uid) => {
    const legs = [0, 1].map((i) => ({
      from: str(f, `leg${i}_from`) ?? "",
      to: str(f, `leg${i}_to`) ?? "",
      depart_local: str(f, `leg${i}_depart`) ?? "",
      arrive_local: str(f, `leg${i}_arrive`),
      from_fbo: str(f, `leg${i}_from_fbo`),
      to_fbo: str(f, `leg${i}_to_fbo`),
      flight_time: str(f, `leg${i}_flight_time`),
    })).filter((l) => l.from && l.to && l.depart_local);
    if (!legs.length) throw new Error("Enter at least one leg with airports and departure time.");
    await wf.saveClientItinerary(tripId, {
      aircraft: str(f, "aircraft") ?? "",
      tail_number: str(f, "tail_number"),
      operator: str(f, "operator") ?? "",
      legs,
      passengers: num(f, "passengers") ?? 1,
      crew: str(f, "crew"),
      catering: str(f, "catering"),
      ground_transport: str(f, "ground_transport"),
      notes: str(f, "notes"),
      contacts: str(f, "contacts"),
    }, str(f, "change_summary"), str(f, "operator_itinerary_id"), uid);
    return "Itinerary draft saved. Preview it, then publish.";
  });
}

export async function publishItineraryAction(tripId: string, itineraryId: string, _p: ActionState, _f: FormData) {
  return run(tripId, "broker", async (uid) => {
    await wf.publishItinerary(itineraryId, uid);
    return "Itinerary published and sent to the client";
  });
}

// ---------------------------------------------------------------------------
// Operations (spec s16-s21; blueprint s27, s28)
// ---------------------------------------------------------------------------
export async function reportIssueAction(tripId: string, _p: ActionState, f: FormData) {
  return run(tripId, "broker", async (uid) => {
    await wf.reportIssue(tripId, { kind: str(f, "kind") ?? "other", description: str(f, "description") ?? "", via: str(f, "via") ?? "broker" }, uid);
    return "Trip flagged: operational issue";
  });
}

export async function replacementSearchAction(tripId: string, _p: ActionState, _f: FormData) {
  return run(tripId, "broker", async (uid) => {
    await wf.startReplacementSearch(tripId, uid);
    const r = await createRfqRound(tripId, uid);
    return `Replacement search: ${r.candidates} operators matched from the original trip requirements. Review the RFQs below.`;
  });
}

export async function resolveIssueAction(tripId: string, _p: ActionState, f: FormData) {
  return run(tripId, "broker", async (uid) => {
    await wf.resolveIssueNoChange(tripId, str(f, "resolution") ?? "Resolved with no aircraft change", uid);
    return "Issue resolved; trip restored";
  });
}

export async function markActiveAction(tripId: string, _p: ActionState, _f: FormData) {
  return run(tripId, "broker", async (uid) => { await wf.markActive(tripId, uid); return "Trip marked active"; });
}

export async function completeTripAction(tripId: string, _p: ActionState, _f: FormData) {
  return run(tripId, "broker", async (uid) => { await wf.completeTrip(tripId, uid); return "Trip completed. Thank-you and feedback request sent."; });
}

export async function closeTripAction(tripId: string, _p: ActionState, _f: FormData) {
  return run(tripId, "broker", async (uid) => { await wf.closeTrip(tripId, uid); return "Trip closed"; });
}
