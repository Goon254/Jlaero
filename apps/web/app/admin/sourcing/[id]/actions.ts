"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { approveAndSend, buildOffer, createRfqRound, presentOffers, reviewQuote } from "@/lib/sourcing/engine";
import type { PricingPolicy } from "@/lib/sourcing/pricing";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

function fail(e: unknown): ActionResult {
  return { ok: false, error: e instanceof Error ? e.message : String(e) };
}

export async function startRound(requestId: string): Promise<ActionResult> {
  const user = await requireRole("admin");
  try {
    const r = await createRfqRound(requestId, user.id);
    revalidatePath(`/admin/sourcing/${requestId}`);
    return { ok: true, message: `${r.candidates} operators matched, ${r.drafted} emails drafted` };
  } catch (e) { return fail(e); }
}

export async function sendRecipient(requestId: string, recipientId: string, edits: { subject: string; body: string; toEmail: string }): Promise<ActionResult> {
  const user = await requireRole("admin");
  try {
    await approveAndSend(recipientId, user.id, edits);
    revalidatePath(`/admin/sourcing/${requestId}`);
    return { ok: true, message: "Sent" };
  } catch (e) { return fail(e); }
}

export async function addContact(requestId: string, operatorId: string, email: string, fullName: string | null): Promise<ActionResult> {
  await requireRole("admin");
  const clean = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) return { ok: false, error: "Enter a valid email" };
  const sql = db();
  try {
    const [c] = await sql`insert into operator_contacts (operator_id, email, full_name, source, is_primary)
      values (${operatorId}, ${clean}, ${fullName}, 'manual', true)
      on conflict (lower(email)) do update set operator_id = excluded.operator_id returning id`;
    if (!c) throw new Error("contact could not be saved");
    await sql`update rfq_recipients r set contact_id = ${c.id}, to_email = ${clean}
      from rfqs f where f.id = r.rfq_id and f.trip_request_id = ${requestId} and r.operator_id = ${operatorId} and r.status = 'draft'`;
    await sql`update operators set email_domain = coalesce(email_domain, ${clean.split("@")[1] ?? null}) where id = ${operatorId}`;
    revalidatePath(`/admin/sourcing/${requestId}`);
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function decideQuote(requestId: string, quoteId: string, decision: "approved" | "rejected", notes: string, overrideTotal: number | null): Promise<ActionResult> {
  const user = await requireRole("admin");
  try {
    await reviewQuote(quoteId, user.id, decision, notes || null, overrideTotal);
    revalidatePath(`/admin/sourcing/${requestId}`);
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function priceQuote(requestId: string, input: {
  quoteId: string; tier: PricingPolicy["tier"]; competitorPrice: number | null; competitorSource: string | null; manualPrice: number | null; headline: string | null;
}): Promise<ActionResult> {
  const user = await requireRole("admin");
  try {
    const r = await buildOffer({ ...input, actorId: user.id });
    revalidatePath(`/admin/sourcing/${requestId}`);
    return { ok: true, message: `${input.tier}: $${r.travelerPrice.toLocaleString()} (${r.markupPct}% margin). ${r.note}` };
  } catch (e) { return fail(e); }
}

export async function publishOffers(requestId: string): Promise<ActionResult> {
  const user = await requireRole("admin");
  try {
    const n = await presentOffers(requestId, user.id);
    revalidatePath(`/admin/sourcing/${requestId}`);
    revalidatePath(`/requests/${requestId}`);
    return { ok: true, message: `${n} offer${n === 1 ? "" : "s"} presented to the traveler` };
  } catch (e) { return fail(e); }
}

export async function withdrawOffer(requestId: string, offerId: string): Promise<ActionResult> {
  await requireRole("admin");
  const sql = db();
  await sql`update traveler_offers set status = 'withdrawn' where id = ${offerId} and status in ('draft', 'presented')`;
  revalidatePath(`/admin/sourcing/${requestId}`);
  return { ok: true };
}
