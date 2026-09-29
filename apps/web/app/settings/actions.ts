"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { deleteAccountForUser } from "@/lib/account-deletion";

export type SettingsState = { error?: string; ok?: boolean };

const profileUpdateSchema = z.object({
  full_name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(30).optional(),
  company_name: z.string().trim().max(160).optional(),
  home_base: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3,4}$/)
    .transform((s) => s.toUpperCase())
    .optional()
    .or(z.literal("").transform(() => undefined)),
  bio: z.string().max(2000).optional(),
});

export async function updateProfile(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = profileUpdateSchema.safeParse({
    full_name: formData.get("full_name"),
    phone: formData.get("phone") || undefined,
    company_name: formData.get("company_name") || undefined,
    home_base: formData.get("home_base") || "",
    bio: formData.get("bio") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.full_name,
      phone: parsed.data.phone ?? null,
      company_name: parsed.data.company_name ?? null,
      home_base: parsed.data.home_base ?? null,
      bio: parsed.data.bio ?? null,
    })
    .eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

export async function changePassword(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const supabase = await createClient();
  const password = String(formData.get("new_password") ?? "");
  if (password.length < 8) return { error: "Password must be at least 8 characters" };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  return { ok: true };
}

export async function saveNotificationPrefs(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const prefs = {
    email_bookings: formData.get("email_bookings") === "on",
    email_messages: formData.get("email_messages") === "on",
    push_bookings: formData.get("push_bookings") === "on",
    push_messages: formData.get("push_messages") === "on",
    email_marketing: formData.get("email_marketing") === "on",
  };
  const { error } = await supabase
    .from("notification_preferences")
    .upsert({ user_id: user.id, prefs, updated_at: new Date().toISOString() });
  if (error) return { error: error.message };
  return { ok: true };
}

// Account deletion: see lib/account-deletion.ts (shared with the mobile API).
export async function deleteAccount(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (String(formData.get("confirm")) !== "DELETE") {
    return { error: 'Type DELETE to confirm' };
  }

  const result = await deleteAccountForUser(supabase, user.id);
  if (result.error) return { error: result.error };

  await supabase.auth.signOut();
  redirect("/?deleted=1");
}
