"use server";

import { revalidatePath } from "next/cache";
import { assertStaff } from "@/lib/trips/access";
import { bool, failure, num, str, type ActionState } from "@/lib/trips/action-state";
import { audit, withActor } from "@/lib/trips/core";

// Admin settings (blueprint s34). Every save records old and new values.
type Spec = { kind: "number"; min: number; max: number; label: string } | { kind: "bool"; label: string } | { kind: "text"; label: string; required?: boolean; email?: boolean };

const SCHEMAS: Record<string, Record<string, Spec>> = {
  pricing: {
    default_markup_pct: { kind: "number", min: 0, max: 100, label: "Default markup" },
    min_markup_pct: { kind: "number", min: 0, max: 100, label: "Minimum markup" },
    catering_default: { kind: "number", min: 0, max: 100000, label: "Default catering price" },
    vehicle_default: { kind: "number", min: 0, max: 100000, label: "Default vehicle price" },
    service_fee: { kind: "number", min: 0, max: 100000, label: "Service fee" },
  },
  search: {
    radius_miles: { kind: "number", min: 1, max: 1000, label: "Search radius" },
    include_prospects: { kind: "bool", label: "Include prospects" },
    max_operators: { kind: "number", min: 1, max: 50, label: "Operators per search" },
    quote_deadline_hours: { kind: "number", min: 1, max: 168, label: "Quote deadline" },
  },
  automation: {
    reminder_hours: { kind: "number", min: 1, max: 336, label: "Reminder lead time" },
    active_hours_before: { kind: "number", min: 0, max: 48, label: "Active before departure" },
    feedback_close_days: { kind: "number", min: 1, max: 90, label: "Feedback window" },
    option_expiry_hours: { kind: "number", min: 1, max: 336, label: "Option expiry" },
  },
  company: {
    name: { kind: "text", label: "Brand name", required: true },
    legal_name: { kind: "text", label: "Legal name", required: true },
    support_email: { kind: "text", label: "Support email", required: true, email: true },
    support_phone: { kind: "text", label: "Support phone" },
    address: { kind: "text", label: "Address" },
  },
  payment_instructions: {
    credit_card: { kind: "text", label: "Credit card" },
    ach: { kind: "text", label: "ACH" },
    wire: { kind: "text", label: "Wire" },
    direct_deposit: { kind: "text", label: "Direct deposit" },
    terms: { kind: "text", label: "Payment terms" },
  },
  cancellation_policy: {
    title: { kind: "text", label: "Title", required: true },
    body: { kind: "text", label: "Policy", required: true },
  },
};

export async function saveSetting(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const user = await assertStaff("admin");
    const key = str(f, "key");
    const schema = key ? SCHEMAS[key] : undefined;
    if (!key || !schema) return { ok: false, error: "Unknown setting." };
    const value: Record<string, unknown> = {};
    for (const [field, spec] of Object.entries(schema)) {
      if (spec.kind === "bool") value[field] = bool(f, field);
      else if (spec.kind === "number") {
        const n = num(f, field);
        if (n == null || n < spec.min || n > spec.max) return { ok: false, error: `${spec.label} must be between ${spec.min} and ${spec.max}.` };
        value[field] = n;
      } else {
        // Keep line breaks in long text; trim edges only.
        const raw = f.get(field);
        const t = typeof raw === "string" ? raw.trim() : "";
        if (spec.required && !t) return { ok: false, error: `${spec.label} is required.` };
        if (spec.email && t && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t)) return { ok: false, error: `${spec.label} must be an email.` };
        value[field] = t;
      }
    }
    if (key === "pricing" && Number(value.min_markup_pct) > Number(value.default_markup_pct)) {
      return { ok: false, error: "The minimum markup cannot be above the default markup." };
    }
    await withActor(user.id, async (tx) => {
      const [old] = await tx`select value from app_settings where key = ${key} for update`;
      const merged = { ...((old?.value as Record<string, unknown>) ?? {}), ...value };
      await tx`insert into app_settings (key, value, updated_by) values (${key}, ${tx.json(merged)}, ${user.id})
        on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by`;
      await audit(tx, user.id, "settings.changed", { type: "app_setting", id: key }, { old: old?.value ?? null, new: merged });
    });
    revalidatePath("/desk/settings");
    return { ok: true, message: "Saved" };
  } catch (e) {
    return failure(e);
  }
}

// Contract templates are versioned (blueprint s17): drafts are editable,
// publishing freezes a version and retires the previous active one.
export async function newTemplateVersion(_: ActionState): Promise<ActionState> {
  try {
    const user = await assertStaff("admin");
    const id = await withActor(user.id, async (tx) => {
      const [draft] = await tx`select id from contract_templates where status = 'draft' limit 1`;
      if (draft) throw new Error("A draft already exists. Edit or publish it first.");
      const [active] = await tx`select name, body from contract_templates where status = 'active' order by version desc limit 1`;
      const [{ v }] = await tx`select coalesce(max(version), 0) + 1 as v from contract_templates where name = ${active?.name ?? "Charter Agreement"}`;
      const [row] = await tx`insert into contract_templates (name, version, body, status, created_by, notes)
        values (${active?.name ?? "Charter Agreement"}, ${v}, ${active?.body ?? "# Charter Agreement\n"}, 'draft', ${user.id}, null) returning id, version`;
      await audit(tx, user.id, "template.draft_created", { type: "contract_template", id: row.id }, { new: { version: row.version } });
      return row.id as string;
    });
    revalidatePath("/desk/settings");
    return { ok: true, message: "Draft created", redirect: `/desk/settings?template=${id}#templates` };
  } catch (e) {
    return failure(e);
  }
}

export async function saveTemplateDraft(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const user = await assertStaff("admin");
    const id = str(f, "templateId");
    const body = String(f.get("body") ?? "");
    if (!id) return { ok: false, error: "Template missing." };
    if (body.trim().length < 50) return { ok: false, error: "The template body looks empty." };
    const effective = str(f, "effective_date");
    await withActor(user.id, async (tx) => {
      const [old] = await tx`select body, notes, status, effective_date from contract_templates where id = ${id} for update`;
      if (!old) throw new Error("Template not found.");
      if (old.status !== "draft") throw new Error("Only drafts can be edited. Create a new version.");
      await tx`update contract_templates set body = ${body}, notes = ${str(f, "notes")},
        effective_date = coalesce(${effective}::date, effective_date) where id = ${id}`;
      await audit(tx, user.id, "template.draft_saved", { type: "contract_template", id }, { old: { length: String(old.body).length, notes: old.notes }, new: { length: body.length, notes: str(f, "notes") } });
    });
    revalidatePath("/desk/settings");
    return { ok: true, message: "Draft saved" };
  } catch (e) {
    return failure(e);
  }
}

export async function publishTemplate(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const user = await assertStaff("admin");
    const id = str(f, "templateId");
    if (!id) return { ok: false, error: "Template missing." };
    await withActor(user.id, async (tx) => {
      const [t] = await tx`select id, name, version, status from contract_templates where id = ${id} for update`;
      if (!t || t.status !== "draft") throw new Error("Only a draft can be published.");
      const [prev] = await tx`update contract_templates set status = 'retired' where name = ${t.name} and status = 'active' returning version`;
      await tx`update contract_templates set status = 'active', effective_date = greatest(effective_date, current_date) where id = ${id}`;
      await audit(tx, user.id, "template.published", { type: "contract_template", id }, { old: { active_version: prev?.version ?? null }, new: { active_version: t.version } });
    });
    revalidatePath("/desk/settings");
    return { ok: true, message: "Published. New contracts use this version; sent contracts keep theirs." };
  } catch (e) {
    return failure(e);
  }
}

export async function discardTemplateDraft(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const user = await assertStaff("admin");
    const id = str(f, "templateId");
    if (!id) return { ok: false, error: "Template missing." };
    await withActor(user.id, async (tx) => {
      const [t] = await tx`delete from contract_templates where id = ${id} and status = 'draft'
        and not exists (select 1 from trip_contracts c where c.template_id = ${id}) returning version`;
      if (!t) throw new Error("Only an unused draft can be discarded.");
      await audit(tx, user.id, "template.draft_discarded", { type: "contract_template", id }, { old: { version: t.version } });
    });
    revalidatePath("/desk/settings");
    return { ok: true, message: "Draft discarded", redirect: "/desk/settings#templates" };
  } catch (e) {
    return failure(e);
  }
}
