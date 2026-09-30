// Low-level helpers for the trip workflow: settings, actor-aware
// transactions, audit with before/after values, trip events, notes.
// Runs on the service connection; callers check permissions first.
import type { PricingSettings } from "@jlaero/shared";
import { db } from "@/lib/db";

export type Sql = ReturnType<typeof db>;
// postgres.js transaction handle; typed loosely because its generic
// TransactionSql type does not accept template calls in strict mode.
export type Tx = any;

export type SearchSettings = { radius_miles: number; include_prospects: boolean; max_operators: number; quote_deadline_hours: number };
export type AutomationSettings = { reminder_hours: number; active_hours_before: number; feedback_close_days: number; option_expiry_hours: number };
export type CompanySettings = { name: string; legal_name: string; support_email: string; support_phone: string; address: string };
export type PaymentInstructions = { credit_card: string; ach: string; wire: string; direct_deposit: string; terms: string };
export type CancellationPolicy = { title: string; body: string };

export type Settings = {
  pricing: PricingSettings;
  search: SearchSettings;
  automation: AutomationSettings;
  company: CompanySettings;
  payment_instructions: PaymentInstructions;
  cancellation_policy: CancellationPolicy;
};

const DEFAULTS: Settings = {
  pricing: { default_markup_pct: 10, min_markup_pct: 5, catering_default: 0, vehicle_default: 0, service_fee: 0 },
  search: { radius_miles: 100, include_prospects: true, max_operators: 12, quote_deadline_hours: 24 },
  automation: { reminder_hours: 72, active_hours_before: 2, feedback_close_days: 14, option_expiry_hours: 24 },
  company: { name: "Jlaero", legal_name: "Jlaero", support_email: "charter@jlaero.com", support_phone: "", address: "" },
  payment_instructions: { credit_card: "", ach: "", wire: "", direct_deposit: "", terms: "" },
  cancellation_policy: { title: "Cancellation policy", body: "" },
};

export async function getSettings(sql: Sql | Tx = db()): Promise<Settings> {
  const rows = await sql`select key, value from app_settings`;
  const out = structuredClone(DEFAULTS) as Record<string, Record<string, unknown>>;
  for (const r of rows) {
    if (r.key in out) out[r.key] = { ...out[r.key], ...(r.value as Record<string, unknown>) };
  }
  return out as unknown as Settings;
}

// Every workflow write runs in a transaction that records who did it, so the
// status trigger in 0019 attributes trip_events to the right person.
export async function withActor<T>(actorId: string | null, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db().begin(async (tx) => {
    await tx`select set_config('jlaero.actor_id', ${actorId ?? ""}, true)`;
    return fn(tx);
  }) as Promise<T>;
}

export async function audit(
  tx: Tx,
  actorId: string | null,
  action: string,
  target: { type: string; id: string },
  change: { old?: unknown; new?: unknown; meta?: Record<string, unknown> } = {}
) {
  await tx`insert into audit_logs (actor_id, action, target_type, target_id, old_value, new_value, meta)
    values (${actorId}, ${action}, ${target.type}, ${target.id},
            ${change.old === undefined ? null : tx.json(change.old)},
            ${change.new === undefined ? null : tx.json(change.new)},
            ${tx.json(change.meta ?? {})})`;
}

export async function tripEvent(
  tx: Tx,
  tripId: string,
  actorId: string | null,
  kind: string,
  message: string,
  opts: { meta?: Record<string, unknown>; clientVisible?: boolean } = {}
) {
  await tx`insert into trip_events (trip_id, actor_id, kind, message, meta, client_visible)
    values (${tripId}, ${actorId}, ${kind}, ${message}, ${tx.json(opts.meta ?? {})}, ${opts.clientVisible ?? false})`;
}

export class WorkflowError extends Error {}

// Lock the trip row and check it is in one of the expected statuses.
export async function lockTrip(tx: Tx, tripId: string, expected?: string[]) {
  const [trip] = await tx`select * from trips where id = ${tripId} for update`;
  if (!trip) throw new WorkflowError("Trip not found.");
  if (expected && !expected.includes(trip.status)) {
    throw new WorkflowError(`This step is not available while the trip is "${String(trip.status).replace(/_/g, " ")}".`);
  }
  return trip;
}

export async function setStatus(tx: Tx, tripId: string, status: string) {
  await tx`update trips set status = ${status} where id = ${tripId}`;
}
