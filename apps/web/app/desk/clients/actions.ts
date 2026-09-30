"use server";

import { revalidatePath } from "next/cache";
import { assertStaff } from "@/lib/trips/access";
import { failure, str, type ActionState } from "@/lib/trips/action-state";
import { audit, withActor } from "@/lib/trips/core";

const METHODS = ["email", "phone", "sms", "app"];

// Broker edits client contact details; old and new values are audited.
export async function updateClient(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const user = await assertStaff("broker");
    const id = str(f, "clientId");
    if (!id) return { ok: false, error: "Client missing." };
    const name = str(f, "full_name");
    const email = str(f, "email")?.toLowerCase() ?? null;
    if (!name) return { ok: false, error: "Name is required." };
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "Enter a valid email." };
    const method = str(f, "preferred_contact_method") ?? "email";
    if (!METHODS.includes(method)) return { ok: false, error: "Unknown contact method." };
    const ftf = str(f, "first_time_private_flyer");
    // Preferences: one "key: value" per line.
    const prefs: Record<string, string> = {};
    for (const line of (str(f, "preferences") ?? "").split("\n")) {
      const m = /^\s*([^:]+?)\s*:\s*(.+?)\s*$/.exec(line);
      if (m) prefs[m[1]!] = m[2]!;
    }
    const next = {
      full_name: name, email, phone: str(f, "phone"), company_name: str(f, "company_name"),
      preferred_contact_method: method,
      first_time_private_flyer: ftf === "yes" ? true : ftf === "no" ? false : null,
      preferences: prefs,
    };
    await withActor(user.id, async (tx) => {
      const [old] = await tx`select full_name, email, phone, company_name, preferred_contact_method, first_time_private_flyer, preferences
        from clients where id = ${id} for update`;
      if (!old) throw new Error("Client not found.");
      const [dupe] = await tx`select id from clients where lower(email) = ${email} and id <> ${id}`;
      if (dupe) throw new Error("Another client already uses that email.");
      await tx`update clients set full_name = ${next.full_name}, email = ${next.email}, phone = ${next.phone},
        company_name = ${next.company_name}, preferred_contact_method = ${next.preferred_contact_method},
        first_time_private_flyer = ${next.first_time_private_flyer}, preferences = ${tx.json(next.preferences)} where id = ${id}`;
      await audit(tx, user.id, "client.edited", { type: "client", id }, { old, new: next });
    });
    revalidatePath(`/desk/clients/${id}`);
    return { ok: true, message: "Saved" };
  } catch (e) {
    return failure(e);
  }
}

export async function addClientNote(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const user = await assertStaff("view");
    const id = str(f, "clientId");
    const body = str(f, "body");
    if (!id || !body) return { ok: false, error: "Write a note first." };
    await withActor(user.id, (tx) => tx`insert into staff_notes (target_type, target_id, author_id, body) values ('client', ${id}, ${user.id}, ${body})`);
    revalidatePath(`/desk/clients/${id}`);
    return { ok: true, message: "Note added" };
  } catch (e) {
    return failure(e);
  }
}
