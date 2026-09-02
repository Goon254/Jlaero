"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { saleListingSchema } from "@jlaero/shared";
import { createClient } from "@/lib/supabase/server";

export type SaleState = { error?: string; ok?: boolean };

function str(v: FormDataEntryValue | null): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s === "" ? undefined : s;
}
function num(v: FormDataEntryValue | null): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export async function createSaleDraft() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("sale_listings")
    .insert({ seller_id: user.id, title: "Untitled listing", status: "draft" })
    .select("id")
    .single();
  if (error || !data) redirect("/owner/sales?error=create");
  redirect(`/owner/sales/${data.id}/edit`);
}

export async function saveSaleListing(
  id: string,
  _prev: SaleState,
  formData: FormData
): Promise<SaleState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = saleListingSchema.safeParse({
    title: str(formData.get("title")) ?? "",
    manufacturer: str(formData.get("manufacturer")),
    model: str(formData.get("model")),
    year: num(formData.get("year")),
    price: num(formData.get("price")),
    currency: "USD",
    location: str(formData.get("location")),
    description: str(formData.get("description")),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const values = Object.fromEntries(
    Object.entries(parsed.data).map(([k, v]) => [k, v === undefined ? null : v])
  );
  const { error } = await supabase
    .from("sale_listings")
    .update(values)
    .eq("id", id)
    .eq("seller_id", user.id);
  if (error) return { error: error.message };
  revalidatePath(`/owner/sales/${id}/edit`);
  revalidatePath("/owner/sales");
  return { ok: true };
}

export async function setSaleStatus(
  id: string,
  status: "active" | "under_offer" | "sold" | "archived" | "draft"
): Promise<SaleState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (status === "active") {
    const { data: listing } = await supabase
      .from("sale_listings")
      .select("title, price")
      .eq("id", id)
      .eq("seller_id", user.id)
      .maybeSingle();
    const { count } = await supabase
      .from("sale_listing_photos")
      .select("id", { count: "exact", head: true })
      .eq("listing_id", id);
    const missing: string[] = [];
    if (!listing?.title || listing.title === "Untitled listing") missing.push("a title");
    if (!listing?.price) missing.push("a price");
    if (!count) missing.push("at least one photo");
    if (missing.length) return { error: `Add ${missing.join(", ")} before publishing.` };
  }

  const { error } = await supabase
    .from("sale_listings")
    .update({ status })
    .eq("id", id)
    .eq("seller_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/owner/sales");
  revalidatePath(`/owner/sales/${id}/edit`);
  return { ok: true };
}

// Buyer sends an inquiry: row + conversation with the seller + first message.
export async function sendInquiry(
  listingId: string,
  _prev: SaleState,
  formData: FormData
): Promise<SaleState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const message = str(formData.get("message"));
  if (!message) return { error: "Write a message to the seller" };

  const { data: listing } = await supabase
    .from("sale_listings")
    .select("id, seller_id, title")
    .eq("id", listingId)
    .eq("status", "active")
    .maybeSingle();
  if (!listing) return { error: "This listing is not available" };
  if (listing.seller_id === user.id) return { error: "This is your own listing" };

  const { error: inquiryError } = await supabase.from("sale_inquiries").insert({
    listing_id: listingId,
    from_user: user.id,
    message,
  });
  if (inquiryError) return { error: inquiryError.message };

  const { data: conversation } = await supabase
    .from("conversations")
    .insert({ created_by: user.id })
    .select("id")
    .single();
  if (!conversation) return { error: "Could not open a conversation" };

  await supabase
    .from("conversation_participants")
    .insert({ conversation_id: conversation.id, user_id: user.id });
  await supabase
    .from("conversation_participants")
    .insert({ conversation_id: conversation.id, user_id: listing.seller_id });
  await supabase.from("messages").insert({
    conversation_id: conversation.id,
    sender_id: user.id,
    body: `Inquiry about "${listing.title}": ${message}`,
  });

  redirect(`/messages/${conversation.id}`);
}
