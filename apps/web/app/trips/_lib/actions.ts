"use server";

// Client actions for the trip workflow. Every write goes through a security
// definer RPC from migration 0019, which checks ownership and trip status.
// Staff are told afterwards; a notification failure never fails the action.
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { localToInstant, PAYMENT_METHODS, type PaymentMethod } from "@jlaero/shared";
import { createClient } from "@/lib/supabase/server";
import { bool, failure, num, str, type ActionState } from "@/lib/trips/action-state";
import { clientActed, feedbackReceived } from "@/lib/trips/workflow";
import { flushNotifications } from "@/lib/trips/notify";

// tripId arrives as a bound argument from the page, so confirm through RLS
// that the caller owns it before alerting staff about it.
async function tellStaff(tripId: string, fn: () => Promise<unknown>) {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("trips").select("id").eq("id", tripId).maybeSingle();
    if (!data) return;
    await fn();
    await flushNotifications();
  } catch (e) {
    console.error("trip notification failed", e);
  }
}

// Friendlier wording for the messages raised inside the RPCs.
function friendly(e: { message?: string } | null) {
  const m = e?.message ?? "Something went wrong.";
  if (/sign in required/i.test(m)) return "Please sign in again.";
  if (/foreign key|airports/i.test(m)) return "Pick both airports from the list.";
  return m.replace(/^.*?ERROR:\s*/, "");
}

export async function requestTrip(_prev: ActionState, f: FormData): Promise<ActionState> {
  try {
    const origin = str(f, "origin")?.toUpperCase() ?? null;
    const destination = str(f, "destination")?.toUpperCase() ?? null;
    const departureDate = str(f, "departure_date");
    const departureTime = str(f, "departure_time");
    const returnDate = str(f, "return_date");
    const returnTime = str(f, "return_time");
    const passengers = num(f, "passengers");
    const fullName = str(f, "full_name");
    if (!fullName) return { ok: false, error: "Enter your name." };
    if (!str(f, "phone")) return { ok: false, error: "Enter a phone number so your broker can reach you." };
    if (!origin || !destination) return { ok: false, error: "Pick both airports from the list." };
    if (origin === destination) return { ok: false, error: "Departure and destination must be different airports." };
    if (!departureDate) return { ok: false, error: "Choose a departure date." };
    if (!departureTime) return { ok: false, error: "Choose a departure time." };
    if (!passengers || passengers < 1 || passengers > 50) return { ok: false, error: "Enter the number of passengers." };
    if (returnTime && !returnDate) return { ok: false, error: "Add a return date for the return time." };

    const supabase = await createClient();
    const { data: ap } = await supabase.from("airports").select("icao, tz").in("icao", [origin, destination]);
    const tz = Object.fromEntries((ap ?? []).map((a: { icao: string; tz: string | null }) => [a.icao, a.tz]));
    if (!(origin in tz) || !(destination in tz)) return { ok: false, error: "Pick both airports from the list." };
    const departAt = localToInstant(departureDate, departureTime, tz[origin]);
    const returnAt = returnDate ? localToInstant(returnDate, returnTime, tz[destination]) : null;
    if (returnAt && returnAt <= departAt) return { ok: false, error: "The return must be after the departure." };

    const { data, error } = await supabase.rpc("create_trip_request", {
      p_full_name: fullName,
      p_phone: str(f, "phone"),
      p_company: str(f, "company"),
      p_origin: origin,
      p_destination: destination,
      p_departure_date: departureDate,
      p_departure_time: departureTime,
      p_depart_at: departAt.toISOString(),
      p_return_date: returnDate,
      p_return_time: returnTime,
      p_return_at: returnAt ? returnAt.toISOString() : null,
      p_passengers: passengers,
      p_aircraft_category: str(f, "aircraft_category"),
      p_aircraft_preference: str(f, "aircraft_preference"),
      p_vehicle: str(f, "vehicle") === "yes",
      p_catering: str(f, "catering") === "yes",
      p_first_time: str(f, "first_time") == null ? null : str(f, "first_time") === "yes",
      p_special_requests: str(f, "special_requests"),
    });
    if (error) return { ok: false, error: friendly(error) };
    const tripId = data as string;
    await tellStaff(tripId, () => clientActed(tripId, "requested"));
    revalidatePath("/trips");
    return { ok: true, message: "Request received.", redirect: `/trips/${tripId}` };
  } catch (e) {
    return failure(e);
  }
}

export async function selectOption(tripId: string, quoteId: string, _prev: ActionState): Promise<ActionState> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("select_trip_option", { p_quote_id: quoteId });
    if (error) return { ok: false, error: friendly(error) };
    await tellStaff(tripId, () => clientActed(tripId, "selected"));
    revalidatePath(`/trips/${tripId}`);
    return { ok: true, message: "Selection sent to your broker." };
  } catch (e) {
    return failure(e);
  }
}

export async function signContract(tripId: string, contractId: string, sha: string, _prev: ActionState, f: FormData): Promise<ActionState> {
  try {
    const name = str(f, "signer_name");
    if (!name || name.length < 3) return { ok: false, error: "Type your full legal name to sign." };
    if (!bool(f, "consent")) return { ok: false, error: "Please confirm you agree to sign electronically." };
    const h = await headers();
    const ip = (h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "").split(",")[0]?.trim() || null;
    const supabase = await createClient();
    const { error } = await supabase.rpc("sign_trip_contract", {
      p_contract_id: contractId,
      p_signer_name: name,
      p_body_sha256: sha,
      p_ip: ip,
      p_user_agent: h.get("user-agent") ?? "",
    });
    if (error) return { ok: false, error: friendly(error) };
    await tellStaff(tripId, () => clientActed(tripId, "signed"));
    revalidatePath(`/trips/${tripId}`);
    return { ok: true, message: "Agreement signed.", redirect: `/trips/${tripId}/pay` };
  } catch (e) {
    return failure(e);
  }
}

export async function submitPayment(tripId: string, input: { paymentId: string; method: string; reference: string | null; note: string | null; proofPath: string | null }): Promise<ActionState> {
  try {
    if (!(PAYMENT_METHODS as readonly string[]).includes(input.method)) return { ok: false, error: "Choose how you paid." };
    const supabase = await createClient();
    const { error } = await supabase.rpc("submit_trip_payment", {
      p_payment_id: input.paymentId,
      p_method: input.method as PaymentMethod,
      p_reference: input.reference,
      p_note: input.note,
      p_proof_path: input.proofPath,
    });
    if (error) return { ok: false, error: friendly(error) };
    await tellStaff(tripId, () => clientActed(tripId, "paid"));
    revalidatePath(`/trips/${tripId}`);
    revalidatePath(`/trips/${tripId}/pay`);
    return { ok: true, message: "Thank you. Your broker will verify the payment and confirm your trip." };
  } catch (e) {
    return failure(e);
  }
}

export async function submitFeedback(tripId: string, _prev: ActionState, f: FormData): Promise<ActionState> {
  try {
    const rating = num(f, "rating");
    if (!rating || rating < 1 || rating > 5) return { ok: false, error: "Choose a rating from 1 to 5 stars." };
    const categories: Record<string, number> = {};
    for (const [k, v] of f.entries()) {
      if (k.startsWith("cat_") && typeof v === "string" && v) {
        const n = Number(v);
        if (n >= 1 && n <= 5) categories[k.slice(4)] = n;
      }
    }
    const supabase = await createClient();
    const { error } = await supabase.rpc("submit_trip_feedback", {
      p_trip_id: tripId,
      p_rating: rating,
      p_comments: str(f, "comments"),
      p_categories: categories,
    });
    if (error) return { ok: false, error: friendly(error) };
    await tellStaff(tripId, () => feedbackReceived(tripId));
    revalidatePath(`/trips/${tripId}`);
    return { ok: true, message: "Thank you for your feedback." };
  } catch (e) {
    return failure(e);
  }
}
