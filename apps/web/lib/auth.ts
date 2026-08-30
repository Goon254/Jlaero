import { redirect } from "next/navigation";
import type { AppRole } from "@jlaero/shared";
import { createClient } from "./supabase/server";

export type CurrentUser = {
  id: string;
  email: string | null;
  profile: {
    full_name: string | null;
    account_type: string;
    company_name: string | null;
    home_base: string | null;
    verification: string;
  } | null;
  roles: AppRole[];
};

// Loads the signed-in user with profile + roles, or null if signed out.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, account_type, company_name, home_base, verification")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);

  return {
    id: user.id,
    email: user.email ?? null,
    profile: profile ?? null,
    roles: (roleRows ?? []).map((r: { role: AppRole }) => r.role),
  };
}

// Use in server components/pages that require a signed-in user.
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
