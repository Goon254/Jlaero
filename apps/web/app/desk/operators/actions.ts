"use server";

import { revalidatePath } from "next/cache";
import { AIRCRAFT_CATEGORIES } from "@jlaero/shared";
import { assertStaff } from "@/lib/trips/access";
import { bool, failure, num, str, type ActionState } from "@/lib/trips/action-state";
import { audit, withActor, type Tx } from "@/lib/trips/core";

const NETWORK = ["prospect", "approved", "preferred", "excluded", "inactive"];
const AVAILABILITY = ["available", "limited", "maintenance", "unavailable", "unknown"];
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function icaoList(v: string | null) {
  return [...new Set((v ?? "").split(/[,\s]+/).map((s) => s.trim().toUpperCase()).filter((s) => /^[A-Z0-9]{3,4}$/.test(s)))];
}

async function checkAirports(tx: Tx, codes: string[]) {
  if (!codes.length) return;
  const found = await tx`select icao from airports where icao = any(${codes})`;
  const missing = codes.filter((c) => !found.some((f: { icao: string }) => f.icao === c));
  if (missing.length) throw new Error(`Unknown airport code: ${missing.join(", ")}. Use ICAO codes like KTEB.`);
}

function operatorFields(f: FormData) {
  const status = str(f, "network_status") ?? "approved";
  if (!NETWORK.includes(status)) throw new Error("Unknown network status.");
  const email = str(f, "general_email")?.toLowerCase() ?? null;
  if (email && !EMAIL.test(email)) throw new Error("Enter a valid email.");
  const radius = num(f, "service_radius_miles");
  if (radius != null && (radius < 0 || radius > 5000)) throw new Error("Service radius must be between 0 and 5,000 miles.");
  let website = str(f, "website");
  if (website && !/^https?:\/\//i.test(website)) website = `https://${website}`;
  return {
    name: str(f, "name"),
    legal_name: str(f, "legal_name"),
    certificate_number: str(f, "certificate_number")?.toUpperCase() ?? null,
    website,
    general_email: email,
    email_domain: email ? email.split("@")[1] ?? null : null,
    phone: str(f, "phone"),
    hq_city: str(f, "hq_city"),
    hq_state: str(f, "hq_state")?.toUpperCase() ?? null,
    base_icaos: icaoList(str(f, "base_icaos")),
    areas_served: str(f, "areas_served"),
    service_radius_miles: radius == null ? null : Math.round(radius),
    network_status: status,
  };
}

// Admin only (blueprint s2): add an operator to the database.
export async function createOperator(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const user = await assertStaff("admin");
    const o = operatorFields(f);
    if (!o.name) return { ok: false, error: "Operator name is required." };
    const id = await withActor(user.id, async (tx) => {
      await checkAirports(tx, o.base_icaos);
      if (o.certificate_number) {
        const [dupe] = await tx`select id from operators where certificate_number = ${o.certificate_number}`;
        if (dupe) throw new Error("An operator with that certificate number already exists.");
      }
      const [row] = await tx`insert into operators (name, legal_name, certificate_number, website, general_email, email_domain, phone,
          hq_city, hq_state, base_icaos, areas_served, service_radius_miles, network_status, source)
        values (${o.name}, ${o.legal_name}, ${o.certificate_number}, ${o.website}, ${o.general_email}, ${o.email_domain}, ${o.phone},
          ${o.hq_city}, ${o.hq_state}, ${o.base_icaos}, ${o.areas_served}, ${o.service_radius_miles}, ${o.network_status}, 'manual')
        returning id`;
      await audit(tx, user.id, "operator.created", { type: "operator", id: row.id }, { new: o });
      return row.id as string;
    });
    revalidatePath("/desk/operators");
    return { ok: true, message: "Operator added", redirect: `/desk/operators/${id}` };
  } catch (e) {
    return failure(e);
  }
}

// Broker edits operator information and network settings.
export async function updateOperator(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const user = await assertStaff("broker");
    const id = str(f, "operatorId");
    if (!id) return { ok: false, error: "Operator missing." };
    const o = operatorFields(f);
    if (!o.name) return { ok: false, error: "Operator name is required." };
    const extra = {
      search_priority: Math.max(-100, Math.min(100, Math.round(num(f, "search_priority") ?? 0))),
      api_available: bool(f, "api_available"),
      email_integration: bool(f, "email_integration"),
      website_integration: bool(f, "website_integration"),
      integration_notes: str(f, "integration_notes"),
      notes: str(f, "notes"),
    };
    const next = { ...o, ...extra };
    await withActor(user.id, async (tx) => {
      await checkAirports(tx, o.base_icaos);
      const [old] = await tx`select name, legal_name, certificate_number, website, general_email, email_domain, phone, hq_city, hq_state,
          base_icaos, areas_served, service_radius_miles, network_status, search_priority, api_available, email_integration,
          website_integration, integration_notes, notes
        from operators where id = ${id} for update`;
      if (!old) throw new Error("Operator not found.");
      if (o.certificate_number && o.certificate_number !== old.certificate_number) {
        const [dupe] = await tx`select id from operators where certificate_number = ${o.certificate_number} and id <> ${id}`;
        if (dupe) throw new Error("Another operator has that certificate number.");
      }
      // Keep an existing domain when the general email is cleared: RFQ reply
      // matching relies on it.
      const domain = next.email_domain ?? old.email_domain;
      await tx`update operators set name = ${next.name}, legal_name = ${next.legal_name}, certificate_number = ${next.certificate_number},
          website = ${next.website}, general_email = ${next.general_email}, email_domain = ${domain}, phone = ${next.phone},
          hq_city = ${next.hq_city}, hq_state = ${next.hq_state}, base_icaos = ${next.base_icaos}, areas_served = ${next.areas_served},
          service_radius_miles = ${next.service_radius_miles}, network_status = ${next.network_status}, search_priority = ${next.search_priority},
          api_available = ${next.api_available}, email_integration = ${next.email_integration}, website_integration = ${next.website_integration},
          integration_notes = ${next.integration_notes}, notes = ${next.notes}
        where id = ${id}`;
      const changedOld: Record<string, unknown> = {}, changedNew: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(next)) {
        if (JSON.stringify(old[k] ?? null) !== JSON.stringify(v ?? null)) { changedOld[k] = old[k]; changedNew[k] = v; }
      }
      if (Object.keys(changedNew).length) {
        await audit(tx, user.id, "network_status" in changedNew ? "operator.network_changed" : "operator.edited", { type: "operator", id }, { old: changedOld, new: changedNew });
      }
    });
    revalidatePath(`/desk/operators/${id}`);
    return { ok: true, message: "Saved" };
  } catch (e) {
    if (e instanceof Error && /operators_domain_idx/.test(e.message)) return { ok: false, error: "Another operator already uses that email domain." };
    return failure(e);
  }
}

export async function addContact(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const user = await assertStaff("broker");
    const operatorId = str(f, "operatorId");
    const email = str(f, "email")?.toLowerCase() ?? null;
    if (!operatorId) return { ok: false, error: "Operator missing." };
    if (!email || !EMAIL.test(email)) return { ok: false, error: "Enter a valid email." };
    const contact = { full_name: str(f, "full_name"), role: str(f, "role"), email, phone: str(f, "phone"), is_primary: bool(f, "is_primary") };
    await withActor(user.id, async (tx) => {
      const [dupe] = await tx`select operator_id from operator_contacts where lower(email) = ${email}`;
      if (dupe) throw new Error(dupe.operator_id === operatorId ? "That contact is already listed." : "That email belongs to a contact at another operator.");
      if (contact.is_primary) await tx`update operator_contacts set is_primary = false where operator_id = ${operatorId}`;
      const [row] = await tx`insert into operator_contacts (operator_id, full_name, role, email, phone, is_primary, source)
        values (${operatorId}, ${contact.full_name}, ${contact.role}, ${email}, ${contact.phone}, ${contact.is_primary}, 'manual') returning id`;
      await audit(tx, user.id, "operator.contact_added", { type: "operator_contact", id: row.id }, { new: { ...contact, operator_id: operatorId } });
    });
    revalidatePath(`/desk/operators/${operatorId}`);
    return { ok: true, message: "Contact added" };
  } catch (e) {
    return failure(e);
  }
}

export async function contactAction(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const user = await assertStaff("broker");
    const id = str(f, "contactId");
    const op = str(f, "op");
    if (!id || !op) return { ok: false, error: "Missing contact." };
    let operatorId = "";
    await withActor(user.id, async (tx) => {
      const [c] = await tx`select * from operator_contacts where id = ${id} for update`;
      if (!c) throw new Error("Contact not found.");
      operatorId = c.operator_id;
      if (op === "primary") {
        await tx`update operator_contacts set is_primary = (id = ${id}) where operator_id = ${c.operator_id}`;
        await audit(tx, user.id, "operator.contact_primary", { type: "operator_contact", id }, { old: { is_primary: c.is_primary }, new: { is_primary: true } });
      } else if (op === "remove") {
        // Keep unsubscribed contacts on file so the opt-out is never lost.
        if (c.unsubscribed_at) throw new Error("This contact unsubscribed; it stays on file so they are never emailed again.");
        await tx`update rfq_recipients set contact_id = null where contact_id = ${id}`;
        await tx`delete from operator_contacts where id = ${id}`;
        await audit(tx, user.id, "operator.contact_removed", { type: "operator_contact", id }, { old: { email: c.email, full_name: c.full_name } });
      } else throw new Error("Unknown action.");
    });
    revalidatePath(`/desk/operators/${operatorId}`);
    return { ok: true, message: op === "primary" ? "Primary contact set" : "Contact removed" };
  } catch (e) {
    return failure(e);
  }
}

function aircraftFields(f: FormData) {
  const type = str(f, "aircraft_type");
  if (!type) throw new Error("Aircraft type is required, e.g. Gulfstream G450.");
  const category = str(f, "category");
  if (category && !(AIRCRAFT_CATEGORIES as readonly string[]).includes(category)) throw new Error("Unknown category.");
  const availability = str(f, "availability_status") ?? "unknown";
  if (!AVAILABILITY.includes(availability)) throw new Error("Unknown availability.");
  const pax = num(f, "passenger_capacity");
  if (pax != null && (pax < 1 || pax > 100)) throw new Error("Passenger capacity must be 1 to 100.");
  const year = num(f, "year_mfr");
  if (year != null && (year < 1950 || year > new Date().getFullYear() + 1)) throw new Error("Check the year of manufacture.");
  const base = str(f, "home_base_icao")?.toUpperCase() ?? null;
  return {
    aircraft_type: type,
    manufacturer: str(f, "manufacturer"),
    model: str(f, "model"),
    category,
    tail_number: str(f, "tail_number")?.toUpperCase() ?? null,
    year_mfr: year == null ? null : Math.round(year),
    passenger_capacity: pax == null ? null : Math.round(pax),
    range_nm: num(f, "range_nm") == null ? null : Math.round(num(f, "range_nm")!),
    home_base_icao: base,
    availability_status: availability,
    special_features: (str(f, "special_features") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    notes: str(f, "notes"),
  };
}

export async function saveAircraft(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const user = await assertStaff("broker");
    const operatorId = str(f, "operatorId");
    const aircraftId = str(f, "aircraftId");
    if (!operatorId) return { ok: false, error: "Operator missing." };
    const a = aircraftFields(f);
    await withActor(user.id, async (tx) => {
      if (a.home_base_icao) await checkAirports(tx, [a.home_base_icao]);
      if (a.tail_number) {
        const [dupe] = await tx`select id from operator_aircraft where upper(tail_number) = ${a.tail_number} and id <> ${aircraftId ?? "00000000-0000-0000-0000-000000000000"}`;
        if (dupe) throw new Error("That tail number is already on file.");
      }
      if (aircraftId) {
        const [old] = await tx`select * from operator_aircraft where id = ${aircraftId} and operator_id = ${operatorId} for update`;
        if (!old) throw new Error("Aircraft not found.");
        await tx`update operator_aircraft set aircraft_type = ${a.aircraft_type}, manufacturer = ${a.manufacturer}, model = ${a.model},
            category = ${a.category}, tail_number = ${a.tail_number}, year_mfr = ${a.year_mfr}, passenger_capacity = ${a.passenger_capacity},
            range_nm = ${a.range_nm}, home_base_icao = ${a.home_base_icao}, availability_status = ${a.availability_status},
            special_features = ${a.special_features}, notes = ${a.notes}
          where id = ${aircraftId}`;
        const o: Record<string, unknown> = {};
        for (const k of Object.keys(a)) o[k] = old[k];
        await audit(tx, user.id, "operator.aircraft_edited", { type: "operator_aircraft", id: aircraftId }, { old: o, new: a });
      } else {
        const [row] = await tx`insert into operator_aircraft (operator_id, aircraft_type, manufacturer, model, category, tail_number, year_mfr,
            passenger_capacity, range_nm, home_base_icao, availability_status, special_features, notes)
          values (${operatorId}, ${a.aircraft_type}, ${a.manufacturer}, ${a.model}, ${a.category}, ${a.tail_number}, ${a.year_mfr},
            ${a.passenger_capacity}, ${a.range_nm}, ${a.home_base_icao}, ${a.availability_status}, ${a.special_features}, ${a.notes})
          returning id`;
        await audit(tx, user.id, "operator.aircraft_added", { type: "operator_aircraft", id: row.id }, { new: { ...a, operator_id: operatorId } });
      }
    });
    revalidatePath(`/desk/operators/${operatorId}`);
    return { ok: true, message: aircraftId ? "Aircraft saved" : "Aircraft added", ...(aircraftId ? {} : { redirect: `/desk/operators/${operatorId}#aircraft` }) };
  } catch (e) {
    return failure(e);
  }
}

export async function removeAircraft(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const user = await assertStaff("broker");
    const id = str(f, "aircraftId");
    if (!id) return { ok: false, error: "Aircraft missing." };
    let operatorId = "";
    await withActor(user.id, async (tx) => {
      const [old] = await tx`delete from operator_aircraft where id = ${id} returning *`;
      if (!old) throw new Error("Aircraft not found.");
      operatorId = old.operator_id;
      await audit(tx, user.id, "operator.aircraft_removed", { type: "operator_aircraft", id }, { old: { aircraft_type: old.aircraft_type, tail_number: old.tail_number } });
    });
    revalidatePath(`/desk/operators/${operatorId}`);
    return { ok: true, message: "Aircraft removed" };
  } catch (e) {
    return failure(e);
  }
}

export async function addOperatorNote(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const user = await assertStaff("view");
    const id = str(f, "operatorId");
    const body = str(f, "body");
    if (!id || !body) return { ok: false, error: "Write a note first." };
    await withActor(user.id, (tx) => tx`insert into staff_notes (target_type, target_id, author_id, body) values ('operator', ${id}, ${user.id}, ${body})`);
    revalidatePath(`/desk/operators/${id}`);
    return { ok: true, message: "Note added" };
  } catch (e) {
    return failure(e);
  }
}
