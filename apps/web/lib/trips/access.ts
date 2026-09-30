import { redirect } from "next/navigation";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";

// Staff permissions (blueprint s2, s31).
//   broker  : trips, quotes, contracts, itineraries, operators
//   finance : payment verification, operator payments
//   admin   : all of it, plus settings, markup overrides, templates, users
export type StaffUser = CurrentUser & {
  isAdmin: boolean;
  isBroker: boolean;
  isFinance: boolean;
};

export type Capability = "view" | "broker" | "finance" | "admin";

export function staffCaps(user: CurrentUser): StaffUser {
  const isAdmin = user.roles.includes("admin");
  return {
    ...user,
    isAdmin,
    isBroker: isAdmin || user.roles.includes("broker"),
    isFinance: isAdmin || user.roles.includes("finance"),
  };
}

export function can(user: StaffUser, cap: Capability) {
  if (cap === "admin") return user.isAdmin;
  if (cap === "broker") return user.isBroker;
  if (cap === "finance") return user.isFinance;
  return user.isAdmin || user.isBroker || user.isFinance;
}

// Pages: redirect when the user lacks the capability.
export async function requireStaff(cap: Capability = "view"): Promise<StaffUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/desk");
  const staff = staffCaps(user);
  if (!can(staff, cap)) redirect(can(staff, "view") ? "/desk" : "/");
  return staff;
}

// Server actions: throw instead of redirecting so the form shows the error.
export async function assertStaff(cap: Capability): Promise<StaffUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Please sign in again.");
  const staff = staffCaps(user);
  if (!can(staff, cap)) {
    const need = cap === "admin" ? "an admin" : cap === "finance" ? "finance or admin" : "a broker or admin";
    throw new Error(`This action needs ${need} permissions.`);
  }
  return staff;
}
