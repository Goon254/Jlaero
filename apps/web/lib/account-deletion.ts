import { db } from "@/lib/db";
import type { SupabaseClient } from "@supabase/supabase-js";

// Account deletion (App Store / Play Store requirement, ROADMAP S17):
// anonymizes PII and disables login. Bookings/reviews survive anonymized so
// the counterparty's history and payment records stay intact.
// Shared by the web settings form and the mobile API route.
export async function deleteAccountForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<{ error?: string }> {
  // Block while money or trips are in flight
  const { count } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .or(`buyer_id.eq.${userId},provider_id.eq.${userId}`)
    .in("status", [
      "accepted",
      "contract_signed",
      "deposit_paid",
      "paid_in_full",
      "in_progress",
      "disputed",
    ]);
  if (count && count > 0) {
    return {
      error: "You have active bookings. Complete or cancel them before deleting your account.",
    };
  }

  const sql = db();
  await sql`
    update profiles set
      full_name = 'Deleted user',
      avatar_url = null, phone = null, company_name = null,
      bio = null, home_base = null, suspended_at = now()
    where id = ${userId}
  `;
  await sql`delete from verification_documents where user_id = ${userId}`;
  await sql`delete from notification_preferences where user_id = ${userId}`;
  await sql`delete from favorites where user_id = ${userId}`;
  // Disable login without deleting the auth row (cascades would erase the
  // counterparty's booking history)
  await sql`
    update auth.users set
      email = 'deleted+' || id || '@deleted.jlaero.invalid',
      encrypted_password = md5(random()::text),
      banned_until = '3000-01-01'
    where id = ${userId}
  `;
  return {};
}
