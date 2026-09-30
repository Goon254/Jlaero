"use server";

// Broker creates a trip for a client (phone, walk-in, or an email request the
// AI could not complete). Same record as an app request (spec s3).
import { localToInstant } from "@jlaero/shared";
import { db } from "@/lib/db";
import { assertStaff } from "@/lib/trips/access";
import { bool, failure, num, str, type ActionState } from "@/lib/trips/action-state";
import { audit, getSettings, withActor } from "@/lib/trips/core";
import { flushNotifications, notifyClient } from "@/lib/trips/notify";

export async function createTripAction(_p: ActionState, f: FormData): Promise<ActionState> {
  try {
    const user = await assertStaff("broker");
    const email = str(f, "email")?.toLowerCase();
    const name = str(f, "full_name");
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Enter the client's email.");
    if (!name) throw new Error("Enter the client's name.");
    const origin = str(f, "origin")?.toUpperCase();
    const destination = str(f, "destination")?.toUpperCase();
    const departureDate = str(f, "departure_date");
    const pax = num(f, "passengers");
    if (!origin || !destination || !departureDate || !pax) throw new Error("Origin, destination, departure date and passengers are required.");
    if (origin === destination) throw new Error("Origin and destination must differ.");
    const airports = await db()`select icao, tz from airports where icao = any(${[origin, destination]})`;
    const o = airports.find((a) => a.icao === origin);
    const d = airports.find((a) => a.icao === destination);
    if (!o || !d) throw new Error("Use ICAO airport codes that exist, e.g. KTEB or KMIA.");
    const departAt = localToInstant(departureDate, str(f, "departure_time"), o.tz);
    const returnDate = str(f, "return_date");
    const returnAt = returnDate ? localToInstant(returnDate, str(f, "return_time"), d.tz) : null;
    if (returnAt && returnAt <= departAt) throw new Error("Return must be after departure.");
    const settings = await getSettings();
    const source = str(f, "source") ?? "broker";
    const messageId = str(f, "message_id");

    const tripId = await withActor(user.id, async (tx) => {
      const [client] = await tx`insert into clients (full_name, email, phone, company_name, first_time_private_flyer)
        values (${name}, ${email}, ${str(f, "phone")}, ${str(f, "company_name")}, ${f.get("first_time") === "yes" ? true : f.get("first_time") === "no" ? false : null})
        on conflict (lower(email)) do update set phone = coalesce(excluded.phone, clients.phone), company_name = coalesce(excluded.company_name, clients.company_name)
        returning id`;
      const [trip] = await tx`insert into trips (client_id, broker_id, source, origin_icao, destination_icao, departure_date, departure_time, depart_at,
          return_date, return_time, return_at, passengers, aircraft_category, aircraft_preference, vehicle_required, catering_required,
          first_time_flyer, special_requests, search_radius_miles, source_email_id, created_by)
        values (${client.id}, ${user.id}, ${source}, ${origin}, ${destination}, ${departureDate}, ${str(f, "departure_time")}, ${departAt},
          ${returnDate}, ${returnDate ? str(f, "return_time") : null}, ${returnAt}, ${pax}, ${str(f, "aircraft_category")}, ${str(f, "aircraft_preference")},
          ${bool(f, "vehicle_required")}, ${bool(f, "catering_required")}, ${f.get("first_time") === "yes" ? true : f.get("first_time") === "no" ? false : null},
          ${str(f, "special_requests")}, ${settings.search.radius_miles}, ${messageId}, ${user.id})
        returning id, trip_number`;
      await audit(tx, user.id, "trip.created", { type: "trip", id: trip.id }, { new: { source, origin, destination, departure_date: departureDate, passengers: pax } });
      if (bool(f, "notify_client")) {
        await notifyClient(tx, trip.id, "NEW_TRIP_REQUEST", {
          title: `We received your trip request ${trip.trip_number}`,
          message: `Thank you. Your request from ${origin} to ${destination} on ${departureDate} for ${pax} passenger${pax === 1 ? "" : "s"} is with our charter desk. We will send you aircraft options shortly.`,
          link: `/trips/${trip.id}`,
        });
      }
      return trip.id as string;
    });
    try { await flushNotifications(); } catch (e) { console.error(e); }
    return { ok: true, message: "Trip created", redirect: `/desk/trips/${tripId}` };
  } catch (e) {
    return failure(e);
  }
}
