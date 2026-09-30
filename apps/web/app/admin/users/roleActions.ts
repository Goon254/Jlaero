"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";

// Staff roles for the broker-assisted workflow (blueprint s2, s31). Only
// admins grant or revoke them, every change is audited, and an admin can
// never remove their own admin role (so the desk is never left without one).
const STAFF_ROLES = ["broker", "finance", "admin"] as const;
type StaffRole = (typeof STAFF_ROLES)[number];

export async function setStaffRole(userId: string, role: StaffRole, grant: boolean): Promise<{ ok?: boolean; error?: string }> {
  const admin = await requireRole("admin");
  if (!STAFF_ROLES.includes(role)) return { error: "Unknown role" };
  if (!grant && role === "admin" && userId === admin.id) return { error: "You cannot remove your own admin role" };
  const sql = db();
  try {
    await sql.begin(async (tx) => {
      const [had] = await tx`select 1 from user_roles where user_id = ${userId} and role = ${role}::app_role`;
      if (grant && !had) await tx`insert into user_roles (user_id, role) values (${userId}, ${role}::app_role)`;
      if (!grant && had) {
        if (role === "admin") {
          const [row] = await tx`select count(*)::int as n from user_roles where role = 'admin'`;
          if (Number(row?.n ?? 0) <= 1) throw new Error("At least one admin must remain");
        }
        await tx`delete from user_roles where user_id = ${userId} and role = ${role}::app_role`;
      }
      if (Boolean(had) !== grant) {
        await tx`insert into audit_logs (actor_id, action, target_type, target_id, old_value, new_value)
          values (${admin.id}, ${grant ? "role.granted" : "role.revoked"}, 'user', ${userId},
                  ${tx.json({ [role]: Boolean(had) })}, ${tx.json({ [role]: grant })})`;
      }
    });
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "failed" };
  }
}
