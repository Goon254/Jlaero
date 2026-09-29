"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function acceptOffer(offerId: string): Promise<{ error: string } | never> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_traveler_offer", { p_offer_id: offerId });
  if (error) return { error: error.message.replace(/^.*?: /, "") };
  redirect(`/bookings/${data}`);
}
