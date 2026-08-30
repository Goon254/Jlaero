"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { aircraftSchema } from "@jlaero/shared";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error?: string; ok?: boolean };

async function ownedAircraft(supabase: Awaited<ReturnType<typeof createClient>>, id: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("aircraft")
    .select("id, owner_id, status, hourly_rate, home_base, category, seats")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();
  return data;
}

// Creates an empty draft and sends the owner to the edit form (resumable).
export async function createDraft() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("aircraft")
    .insert({ owner_id: user.id, name: "Untitled aircraft", status: "draft" })
    .select("id")
    .single();
  if (error || !data) redirect("/owner/aircraft?error=create");
  redirect(`/owner/aircraft/${data.id}/edit`);
}

function num(v: FormDataEntryValue | null): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
function str(v: FormDataEntryValue | null): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s === "" ? undefined : s;
}

export async function saveAircraft(
  id: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = aircraftSchema.safeParse({
    name: str(formData.get("name")) ?? "",
    manufacturer: str(formData.get("manufacturer")),
    model: str(formData.get("model")),
    year: num(formData.get("year")),
    category: str(formData.get("category")),
    seats: num(formData.get("seats")),
    tail_number: str(formData.get("tail_number")),
    home_base: str(formData.get("home_base")),
    description: str(formData.get("description")),
    hourly_rate: num(formData.get("hourly_rate")),
    currency: str(formData.get("currency")) ?? "USD",
    instant_book: formData.get("instant_book") === "on",
    daily_minimum_hours: num(formData.get("daily_minimum_hours")),
    overnight_crew_fee: num(formData.get("overnight_crew_fee")),
    positioning_included: formData.get("positioning_included") === "on",
    range_nm: num(formData.get("range_nm")),
    min_runway_ft: num(formData.get("min_runway_ft")),
    argus_rating: str(formData.get("argus_rating")),
    wyvern_rating: str(formData.get("wyvern_rating")),
    is_bao_stage: str(formData.get("is_bao_stage")),
    cancellation_tier: str(formData.get("cancellation_tier")) ?? "moderate",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const aircraft = await ownedAircraft(supabase, id);
  if (!aircraft) return { error: "Not found" };

  const values = Object.fromEntries(
    Object.entries(parsed.data).map(([k, v]) => [k, v === undefined ? null : v])
  );
  const { error } = await supabase.from("aircraft").update(values).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/owner/aircraft/${id}/edit`);
  revalidatePath("/owner/aircraft");
  return { ok: true };
}

// Publish requires the fields a buyer needs to see.
export async function setStatus(
  id: string,
  status: "active" | "paused" | "archived" | "draft"
): Promise<ActionState> {
  const supabase = await createClient();
  const aircraft = await ownedAircraft(supabase, id);
  if (!aircraft) return { error: "Not found" };

  if (status === "active") {
    const missing: string[] = [];
    if (!aircraft.hourly_rate) missing.push("hourly rate");
    if (!aircraft.home_base) missing.push("home base");
    if (!aircraft.category) missing.push("category");
    if (!aircraft.seats) missing.push("seats");
    const { count } = await supabase
      .from("aircraft_photos")
      .select("id", { count: "exact", head: true })
      .eq("aircraft_id", id);
    if (!count) missing.push("at least one photo");
    if (missing.length) {
      return { error: `Add ${missing.join(", ")} before publishing.` };
    }
  }

  const { error } = await supabase.from("aircraft").update({ status }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/owner/aircraft");
  revalidatePath(`/owner/aircraft/${id}/edit`);
  return { ok: true };
}

export async function deletePhoto(id: string, photoId: string): Promise<void> {
  const supabase = await createClient();
  const aircraft = await ownedAircraft(supabase, id);
  if (!aircraft) return;

  const { data: photo } = await supabase
    .from("aircraft_photos")
    .select("file_path")
    .eq("id", photoId)
    .maybeSingle();
  await supabase.from("aircraft_photos").delete().eq("id", photoId);
  if (photo?.file_path) {
    await supabase.storage.from("aircraft-photos").remove([photo.file_path]);
  }
  revalidatePath(`/owner/aircraft/${id}/edit`);
}

export async function movePhoto(
  id: string,
  photoId: string,
  direction: "up" | "down"
): Promise<void> {
  const supabase = await createClient();
  const aircraft = await ownedAircraft(supabase, id);
  if (!aircraft) return;

  const { data: photos } = await supabase
    .from("aircraft_photos")
    .select("id, position")
    .eq("aircraft_id", id)
    .order("position");
  if (!photos) return;

  const idx = photos.findIndex((p) => p.id === photoId);
  const swap = direction === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swap < 0 || swap >= photos.length) return;

  const a = photos[idx]!;
  const b = photos[swap]!;
  await supabase.from("aircraft_photos").update({ position: b.position }).eq("id", a.id);
  await supabase.from("aircraft_photos").update({ position: a.position }).eq("id", b.id);
  revalidatePath(`/owner/aircraft/${id}/edit`);
}

export async function addBlock(
  id: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient();
  const aircraft = await ownedAircraft(supabase, id);
  if (!aircraft) return { error: "Not found" };

  const from = str(formData.get("starts_at"));
  const to = str(formData.get("ends_at"));
  const kind = str(formData.get("kind")) === "maintenance" ? "maintenance" : "owner";
  if (!from || !to) return { error: "Both dates are required" };
  const starts = new Date(`${from}T00:00:00Z`).toISOString();
  const ends = new Date(`${to}T23:59:59Z`).toISOString();
  if (ends <= starts) return { error: "End date must be after start date" };

  const { error } = await supabase.from("aircraft_availability").insert({
    aircraft_id: id,
    starts_at: starts,
    ends_at: ends,
    is_blocked: true,
    kind,
  });
  if (error) return { error: error.message };
  revalidatePath(`/owner/aircraft/${id}/availability`);
  return { ok: true };
}

export async function removeBlock(id: string, blockId: string): Promise<void> {
  const supabase = await createClient();
  const aircraft = await ownedAircraft(supabase, id);
  if (!aircraft) return;
  await supabase
    .from("aircraft_availability")
    .delete()
    .eq("id", blockId)
    .eq("aircraft_id", id);
  revalidatePath(`/owner/aircraft/${id}/availability`);
}
