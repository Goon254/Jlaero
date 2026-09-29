import { db } from "@/lib/db";

// Every AI-generated artifact and every money-related decision lands here.
export async function audit(
  action: string,
  target: { type: string; id: string },
  meta: Record<string, unknown> = {},
  actorId: string | null = null
) {
  const sql = db();
  await sql`insert into audit_logs (actor_id, action, target_type, target_id, meta)
            values (${actorId}, ${action}, ${target.type}, ${target.id}, ${sql.json(meta as never)})`;
}
