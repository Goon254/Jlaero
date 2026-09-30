"use server";

import { revalidatePath } from "next/cache";
import { assertStaff } from "@/lib/trips/access";
import { failure, str, type ActionState } from "@/lib/trips/action-state";
import { audit, withActor } from "@/lib/trips/core";

// Management review of client feedback (spec s21).
export async function markFeedbackReviewed(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const user = await assertStaff("view");
    const id = str(f, "feedbackId");
    if (!id) return { ok: false, error: "Feedback missing." };
    await withActor(user.id, async (tx) => {
      const [row] = await tx`update trip_feedback set reviewed_by = ${user.id}, reviewed_at = now() where id = ${id} and reviewed_at is null returning trip_id`;
      if (row) await audit(tx, user.id, "feedback.reviewed", { type: "trip_feedback", id }, { new: { reviewed: true } });
    });
    revalidatePath("/desk/feedback");
    return { ok: true, message: "Reviewed" };
  } catch (e) {
    return failure(e);
  }
}
