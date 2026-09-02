"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { crewProfileSchema } from "@jlaero/shared";
import { createClient } from "@/lib/supabase/server";

export type CrewState = { error?: string; ok?: boolean };

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
function list(v: FormDataEntryValue | null): string[] {
  return String(v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
}

export async function saveCrewProfile(
  _prev: CrewState,
  formData: FormData
): Promise<CrewState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = crewProfileSchema.safeParse({
    headline: str(formData.get("headline")),
    crew_kind: str(formData.get("crew_kind")) ?? "captain",
    total_hours: num(formData.get("total_hours")),
    day_rate: num(formData.get("day_rate")),
    currency: "USD",
    home_base: str(formData.get("home_base")),
    bio: str(formData.get("bio")),
    instant_book: false,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const values = {
    user_id: user.id,
    headline: parsed.data.headline ?? null,
    crew_kind: parsed.data.crew_kind,
    total_hours: parsed.data.total_hours ?? null,
    day_rate: parsed.data.day_rate ?? null,
    home_base: parsed.data.home_base ?? null,
    bio: parsed.data.bio ?? null,
    licenses: list(formData.get("licenses")),
    type_ratings: list(formData.get("type_ratings")),
    medical_class: str(formData.get("medical_class")) ?? null,
    medical_expires: str(formData.get("medical_expires")) ?? null,
  };

  const { data: existing } = await supabase
    .from("crew_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  const { error } = existing
    ? await supabase.from("crew_profiles").update(values).eq("id", existing.id)
    : await supabase.from("crew_profiles").insert({ ...values, status: "draft" });
  if (error) return { error: error.message };

  revalidatePath("/crew/me");
  return { ok: true };
}

export async function setCrewStatus(status: "active" | "paused"): Promise<CrewState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (status === "active") {
    const { data: profile } = await supabase
      .from("crew_profiles")
      .select("headline, day_rate, home_base, crew_kind")
      .eq("user_id", user.id)
      .maybeSingle();
    const missing: string[] = [];
    if (!profile?.headline) missing.push("headline");
    if (!profile?.day_rate) missing.push("day rate");
    if (!profile?.home_base) missing.push("home base");
    if (missing.length) return { error: `Add ${missing.join(", ")} before publishing.` };
  }

  const { error } = await supabase
    .from("crew_profiles")
    .update({ status })
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/crew/me");
  return { ok: true };
}

export async function addCrewBlock(
  _prev: CrewState,
  formData: FormData
): Promise<CrewState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("crew_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) return { error: "Create your crew profile first" };

  const from = str(formData.get("starts_at"));
  const to = str(formData.get("ends_at"));
  if (!from || !to) return { error: "Both dates are required" };
  const starts = new Date(`${from}T00:00:00Z`).toISOString();
  const ends = new Date(`${to}T23:59:59Z`).toISOString();
  if (ends <= starts) return { error: "End date must be after start date" };

  const { error } = await supabase.from("crew_availability").insert({
    crew_profile_id: profile.id,
    starts_at: starts,
    ends_at: ends,
    is_blocked: true,
    kind: "owner",
  });
  if (error) return { error: error.message };
  revalidatePath("/crew/me/availability");
  return { ok: true };
}

export async function removeCrewBlock(blockId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { data: profile } = await supabase
    .from("crew_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) return;
  await supabase
    .from("crew_availability")
    .delete()
    .eq("id", blockId)
    .eq("crew_profile_id", profile.id);
  revalidatePath("/crew/me/availability");
}

// Traveler hires crew: booking kind=crew, engagement period as two legs
// (start marker + end marker; see ROADMAP 3b crew semantics).
export async function requestCrewHire(
  crewProfileId: string,
  _prev: CrewState,
  formData: FormData
): Promise<CrewState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const location = str(formData.get("location"));
  const startDate = str(formData.get("start_date"));
  const endDate = str(formData.get("end_date"));
  const notes = str(formData.get("notes"));
  if (!location || !startDate || !endDate) {
    return { error: "Location and engagement dates are required" };
  }
  if (endDate < startDate) return { error: "End date must be after start" };

  const { data: crew } = await supabase
    .from("crew_profiles")
    .select("id, user_id, currency, status")
    .eq("id", crewProfileId)
    .eq("status", "active")
    .maybeSingle();
  if (!crew) return { error: "This crew profile is not available" };
  if (crew.user_id === user.id) return { error: "You cannot hire yourself" };

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .insert({
      kind: "crew",
      buyer_id: user.id,
      provider_id: crew.user_id,
      crew_profile_id: crew.id,
      currency: crew.currency,
      special_requests: notes ?? null,
    })
    .select("id")
    .single();
  if (bookingError || !booking) {
    return { error: bookingError?.message ?? "Could not create the request" };
  }

  const { error: legsError } = await supabase.from("booking_legs").insert([
    {
      booking_id: booking.id,
      position: 0,
      origin: location.toUpperCase(),
      depart_at: new Date(`${startDate}T09:00:00Z`).toISOString(),
    },
    {
      booking_id: booking.id,
      position: 1,
      origin: location.toUpperCase(),
      depart_at: new Date(`${endDate}T18:00:00Z`).toISOString(),
    },
  ]);
  if (legsError) return { error: legsError.message };

  const { data: conversation } = await supabase
    .from("conversations")
    .insert({ booking_id: booking.id })
    .select("id")
    .single();
  if (conversation) {
    await supabase
      .from("conversation_participants")
      .insert({ conversation_id: conversation.id, user_id: user.id });
    await supabase
      .from("conversation_participants")
      .insert({ conversation_id: conversation.id, user_id: crew.user_id });
  }

  redirect(`/bookings/${booking.id}`);
}
