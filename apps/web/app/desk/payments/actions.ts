"use server";

import { revalidatePath } from "next/cache";
import { assertStaff } from "@/lib/trips/access";
import { failure, str, type ActionState } from "@/lib/trips/action-state";
import { setPaymentStatus } from "@/lib/trips/workflow";

const TARGETS = ["received", "verified", "failed", "refunded"] as const;
type Target = (typeof TARGETS)[number];

// Finance-only: every client payment status change goes through the workflow
// so the trip status, audit log and client notification stay in step.
export async function updatePayment(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const user = await assertStaff("finance");
    const id = str(f, "paymentId");
    const to = str(f, "to") as Target | null;
    if (!id || !to || !TARGETS.includes(to)) return { ok: false, error: "Unknown payment action." };
    const note = str(f, "note");
    if (to === "failed" && !note) return { ok: false, error: "Give the client a reason the payment failed." };
    await setPaymentStatus(id, to, user.id, note);
    revalidatePath("/desk/payments");
    const tripId = str(f, "tripId");
    if (tripId) revalidatePath(`/desk/trips/${tripId}`);
    const labels: Record<Target, string> = { received: "Marked received", verified: "Payment verified", failed: "Marked failed", refunded: "Marked refunded" };
    return { ok: true, message: labels[to] };
  } catch (e) {
    return failure(e);
  }
}
