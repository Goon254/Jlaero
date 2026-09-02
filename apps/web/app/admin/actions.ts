"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";

export type AdminState = { error?: string; ok?: boolean };

// Every admin mutation goes through here: verified admin session, direct DB
// write, and an audit_logs row. Non-negotiable once money moves (ROADMAP AD6).
async function audited(
  action: string,
  targetType: string,
  targetId: string,
  meta: Record<string, unknown>,
  write: (sql: ReturnType<typeof db>) => Promise<void>
): Promise<AdminState> {
  const admin = await requireRole("admin");
  const sql = db();
  try {
    await write(sql);
    await sql`
      insert into audit_logs (actor_id, action, target_type, target_id, meta)
      values (${admin.id}, ${action}, ${targetType}, ${targetId}, ${JSON.stringify(meta)}::jsonb)
    `;
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "failed" };
  }
}

export async function reviewDocument(
  docId: string,
  decision: "verified" | "rejected",
  reason: string
): Promise<AdminState> {
  const res = await audited(
    `document.${decision}`,
    "verification_document",
    docId,
    { reason },
    async (sql) => {
      await sql`
        update verification_documents
        set status = ${decision},
            rejection_reason = ${decision === "rejected" ? reason || "Not accepted" : null},
            reviewed_at = now()
        where id = ${docId}
      `;
      // Operator becomes verified once certificate + insurance are both live.
      const [doc] = await sql`
        select user_id from verification_documents where id = ${docId}
      `;
      if (doc) {
        const [counts] = await sql`
          select
            count(*) filter (where doc_type = 'operator_certificate' and status = 'verified') as certs,
            count(*) filter (where doc_type = 'insurance' and status = 'verified') as ins
          from verification_documents where user_id = ${doc.user_id}
        `;
        const verified = Number(counts?.certs) > 0 && Number(counts?.ins) > 0;
        await sql`
          update profiles
          set verification = ${verified ? "verified" : "pending"}
          where id = ${doc.user_id}
        `;
      }
    }
  );
  revalidatePath("/admin/verifications");
  return res;
}

export async function setUserSuspended(
  userId: string,
  suspended: boolean
): Promise<AdminState> {
  const res = await audited(
    suspended ? "user.suspend" : "user.unsuspend",
    "user",
    userId,
    {},
    async (sql) => {
      await sql`
        update profiles
        set suspended_at = ${suspended ? new Date().toISOString() : null}
        where id = ${userId}
      `;
      if (suspended) {
        await sql`update aircraft set status = 'paused' where owner_id = ${userId} and status = 'active'`;
      }
    }
  );
  revalidatePath("/admin/users");
  return res;
}

export async function setListingHidden(
  aircraftId: string,
  hidden: boolean
): Promise<AdminState> {
  const res = await audited(
    hidden ? "listing.hide" : "listing.restore",
    "aircraft",
    aircraftId,
    {},
    async (sql) => {
      await sql`
        update aircraft set status = ${hidden ? "paused" : "active"}
        where id = ${aircraftId}
      `;
    }
  );
  revalidatePath("/admin/listings");
  return res;
}

export async function resolveReport(
  reportId: string,
  outcome: "actioned" | "dismissed"
): Promise<AdminState> {
  const res = await audited(
    `report.${outcome}`,
    "report",
    reportId,
    {},
    async (sql) => {
      await sql`update reports set status = ${outcome} where id = ${reportId}`;
    }
  );
  revalidatePath("/admin/listings");
  return res;
}
