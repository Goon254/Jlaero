"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assertStaff } from "@/lib/trips/access";
import { str, type ActionState } from "@/lib/trips/action-state";

// Open a notification: mark it read, then go where it points. Only the
// recipient's own rows are touched.
export async function openNotification(f: FormData) {
  const user = await assertStaff("view");
  const id = str(f, "id");
  let link = "/desk/notifications";
  if (id) {
    const [n] = await db()`update notifications set read_at = coalesce(read_at, now())
      where id = ${id} and user_id = ${user.id} returning link`;
    if (n?.link && String(n.link).startsWith("/")) link = n.link;
  }
  revalidatePath("/desk", "layout");
  redirect(link);
}

export async function markAllRead(_: ActionState): Promise<ActionState> {
  const user = await assertStaff("view");
  const rows = await db()`update notifications set read_at = now()
    where user_id = ${user.id} and channel = 'app' and read_at is null returning id`;
  revalidatePath("/desk", "layout");
  return { ok: true, message: rows.length ? `${rows.length} marked read` : "Nothing unread" };
}
