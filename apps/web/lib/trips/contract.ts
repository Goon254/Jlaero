// Contract generation (spec s9, blueprint s17). Fills the active template
// with trip data and freezes the result: the rendered text and its SHA-256
// are stored, and the client signs that exact text.
import { createHash } from "node:crypto";
import { AIRCRAFT_CATEGORY_LABELS, formatLocal, formatMoney, type AircraftCategory } from "@jlaero/shared";
import { getSettings, WorkflowError, type Tx } from "./core";

export function sha256(text: string) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function fillTemplate(body: string, vars: Record<string, string>) {
  return body.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, key: string) => vars[key] ?? "");
}

export async function renderContract(tx: Tx, tripId: string, quoteId: string) {
  const [row] = await tx`
    select t.*, c.full_name as client_name, c.company_name as client_company, c.email as client_email,
           o.name as o_name, o.municipality as o_city, o.tz as o_tz,
           d.name as d_name, d.municipality as d_city, d.tz as d_tz
    from trips t join clients c on c.id = t.client_id
    join airports o on o.icao = t.origin_icao join airports d on d.icao = t.destination_icao
    where t.id = ${tripId}`;
  const [q] = await tx`select q.*, op.name as operator_name, op.legal_name as operator_legal_name, op.certificate_number
    from trip_quotes q join operators op on op.id = q.operator_id where q.id = ${quoteId}`;
  const [tpl] = await tx`select * from contract_templates where status = 'active' order by version desc limit 1`;
  if (!row || !q) throw new WorkflowError("Trip or quote not found.");
  if (!tpl) throw new WorkflowError("No active contract template. An admin must publish one in Settings.");
  const settings = await getSettings(tx);
  const [{ n }] = await tx`select count(*)::int as n from trip_contracts where trip_id = ${tripId}`;
  const contractNumber = `${row.trip_number}-C${Number(n) + 1}`;

  const money = (v: unknown) => formatMoney(Number(v), q.currency);
  const place = (icao: string, name: string, city: string | null) => `${city ? `${city}, ` : ""}${name} (${icao})`;
  const services: string[] = [];
  if (row.catering_required) services.push(`- Catering: ${Number(q.catering_cost) > 0 ? money(q.catering_cost) : "included or arranged by the operator"}`);
  if (row.vehicle_required) services.push(`- Ground vehicle service: ${Number(q.vehicle_cost) > 0 ? money(q.vehicle_cost) : "arranged by the Broker"}`);
  if (Number(q.other_cost) > 0) services.push(`- ${q.other_cost_label || "Other approved fees"}: ${money(q.other_cost)}`);

  const priceRows: string[] = [];
  if (Number(q.catering_cost) > 0) priceRows.push(`| Catering | ${money(q.catering_cost)} |`);
  if (Number(q.vehicle_cost) > 0) priceRows.push(`| Ground vehicle | ${money(q.vehicle_cost)} |`);
  if (Number(q.other_cost) > 0) priceRows.push(`| ${q.other_cost_label || "Other approved fees"} | ${money(q.other_cost)} |`);

  const aircraft = [q.aircraft_type, q.aircraft_category ? AIRCRAFT_CATEGORY_LABELS[q.aircraft_category as AircraftCategory] : null,
    q.tail_number ? `tail ${q.tail_number}` : null, q.passenger_capacity ? `up to ${q.passenger_capacity} passengers` : null]
    .filter(Boolean).join(", ");

  const vars: Record<string, string> = {
    contract_number: contractNumber,
    trip_number: row.trip_number,
    issued_date: formatLocal(new Date(), row.o_tz, { year: "numeric", month: "long", day: "numeric" }),
    company_name: settings.company.name,
    company_legal_name: settings.company.legal_name || settings.company.name,
    company_address: settings.company.address,
    client_name: row.client_name,
    client_email: row.client_email,
    client_company_clause: row.client_company ? ` of **${row.client_company}**` : "",
    route: `${place(row.origin_icao, row.o_name, row.o_city)} to ${place(row.destination_icao, row.d_name, row.d_city)}`,
    departure: formatLocal(row.depart_at, row.o_tz, { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }),
    return: row.return_at ? formatLocal(row.return_at, row.d_tz, { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }) : "One way",
    passengers: String(row.passengers),
    aircraft,
    operator_name: q.operator_legal_name || q.operator_name,
    services: services.length ? services.join("\n") : "No additional services requested.",
    charter_price: money(Number(q.operator_cost) + Number(q.markup_amount)),
    service_price_rows: priceRows.length ? priceRows.join("\n") + "\n" : "",
    total_price: money(q.client_price),
    payment_terms: settings.payment_instructions.terms || "Payment in full is due before the operator can confirm the aircraft.",
    cancellation_policy: settings.cancellation_policy.body || "As agreed with the Broker.",
    special_requests: row.special_requests || "None.",
  };
  const rendered = fillTemplate(tpl.body, vars).trim() + "\n";
  return { rendered, sha: sha256(rendered), contractNumber, template: tpl, quote: q, trip: row };
}
