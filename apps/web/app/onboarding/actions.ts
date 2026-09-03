"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { ACCOUNT_TYPES } from "@jlaero/shared";
import { createClient } from "@/lib/supabase/server";

const onboardingSchema = z.object({
  full_name: z.string().trim().min(1, "Name is required").max(120),
  account_type: z.enum(ACCOUNT_TYPES),
  company_name: z.string().trim().max(160).optional(),
  home_base: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3,4}$/, "Use a 3–4 letter airport code")
    .transform((s) => s.toUpperCase())
    .optional()
    .or(z.literal("").transform(() => undefined)),
  account_kind: z.enum(["traveler", "operator"]),
});

export type OnboardingState = { error?: string };

export async function completeOnboarding(
  _prev: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  const parsed = onboardingSchema.safeParse({
    full_name: formData.get("full_name"),
    account_type: formData.get("account_type"),
    company_name: formData.get("company_name") || undefined,
    home_base: formData.get("home_base") || "",
    account_kind: formData.get("account_kind"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { full_name, account_type, company_name, home_base, account_kind } =
    parsed.data;

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ full_name, account_type, company_name: company_name ?? null, home_base: home_base ?? null })
    .eq("id", user.id);
  if (profileError) return { error: profileError.message };

  // Two account kinds (per product direction): every account is a traveler;
  // operators additionally get the owner role.
  if (account_kind === "operator") {
    const { error: rolesError } = await supabase
      .from("user_roles")
      .upsert([{ user_id: user.id, role: "owner" }], {
        onConflict: "user_id,role",
        ignoreDuplicates: true,
      });
    if (rolesError) return { error: rolesError.message };
  }

  redirect("/dashboard");
}
