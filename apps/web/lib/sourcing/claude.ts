// Claude's jobs in the brokerage (blueprint s29), each with its own
// instructions: request parser (email -> trip), RFQ drafting, reply
// classification, quote normalizer (reply -> structured quote), and operator
// confirmation drafting. Pricing math is never done here (lib/trips/pricing
// is deterministic). Nothing here sends email or moves money; those steps
// stay behind a broker (blueprint s13).
// Main jobs run on Claude Opus 5 with server-side refusal fallback;
// classification on Haiku 4.5.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";

const MAIN_MODEL = "claude-opus-5";
const CLASSIFIER_MODEL = "claude-haiku-4-5";

let client: Anthropic | null = null;
function anthropic() {
  if (!client) client = new Anthropic();
  return client;
}

// One structured call. On a safety decline the API retries on a fallback
// model inside the same request ("default" routing); if the whole chain
// declines we surface that instead of returning an empty result.
async function structured<S extends z.ZodType>(opts: {
  schema: S;
  system: string;
  user: string;
  model?: string;
  maxTokens?: number;
  effort?: "low" | "medium" | "high";
  cacheSystem?: boolean;
}): Promise<{ output: z.infer<S>; model: string }> {
  const model = opts.model ?? MAIN_MODEL;
  const withFallback = model === MAIN_MODEL;
  const res = await anthropic().beta.messages.parse({
    model,
    max_tokens: opts.maxTokens ?? 8000,
    ...(withFallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    output_config: { ...(opts.effort ? { effort: opts.effort } : {}), format: betaZodOutputFormat(opts.schema) },
    system: [{ type: "text", text: opts.system, ...(opts.cacheSystem ? { cache_control: { type: "ephemeral" as const } } : {}) }],
    messages: [{ role: "user", content: opts.user }],
  });
  if (res.stop_reason === "refusal") throw new Error("The model declined this request; handle it manually.");
  if (res.parsed_output == null) throw new Error(`Model output could not be parsed (stop reason: ${res.stop_reason}).`);
  return { output: res.parsed_output as z.infer<S>, model: res.model };
}

const SYSTEM_DRAFT = `You write charter request-for-quote emails on behalf of Jlaero, a US private jet charter broker.
Write to the operator's charter sales or dispatch desk. Plain text, no markdown, no bullet symbols.
Be specific: route with ICAO codes and city names, date and local time, passenger count, return leg if any, cabin class wanted.
Ask for an all-in quote including 7.5% federal excise tax and segment fees, the aircraft type and year, quote validity, and cancellation terms.
Include the trip ID from the request in the subject line. If catering or a ground vehicle is requested, ask for those prices separately. Mention that a reply to this email reaches the desk directly. Keep it under 170 words. Sign as "Jlaero Charter Desk".
Never invent facts about the operator. Do not include a footer; one is appended automatically.`;

const DraftSchema = z.object({
  subject: z.string(),
  body: z.string(),
});

export type TripSummary = {
  tripNumber?: string;
  catering?: boolean;
  vehicle?: boolean;
  originIcao: string;
  originName: string;
  destinationIcao: string;
  destinationName: string;
  departAtLocal: string;
  returnAtLocal: string | null;
  passengers: number;
  categoryLabel: string | null;
  notes: string | null;
  distanceNm: number | null;
};

export type OperatorSummary = {
  name: string;
  contactName: string | null;
  baseHint: string | null;
  fleetHint: string | null;
};

export async function draftRfq(trip: TripSummary, operator: OperatorSummary) {
  const { output, model } = await structured({
    schema: DraftSchema,
    system: SYSTEM_DRAFT,
    cacheSystem: true,
    effort: "medium",
    maxTokens: 4000,
    user: `Operator: ${operator.name}${operator.contactName ? ` (contact: ${operator.contactName})` : ""}.
${operator.baseHint ? `Their fleet is based around ${operator.baseHint}.` : ""}
${operator.fleetHint ? `Fleet that fits: ${operator.fleetHint}.` : ""}

Trip ${trip.tripNumber ?? ""}:
- From ${trip.originIcao} (${trip.originName}) to ${trip.destinationIcao} (${trip.destinationName})${trip.distanceNm ? `, about ${trip.distanceNm} nm` : ""}
- Departure: ${trip.departAtLocal}
- Return: ${trip.returnAtLocal ?? "one way"}
- Passengers: ${trip.passengers}
- Aircraft: ${trip.categoryLabel ?? "any suitable aircraft"}
- Catering: ${trip.catering ? "requested, please price it" : "not requested"}
- Ground vehicle: ${trip.vehicle ? "requested, say if you can arrange it" : "not requested"}
- Special requests: ${trip.notes ?? "none"}

Write the subject and body.`,
  });
  return { ...output, model };
}

const ClassifySchema = z.object({
  kind: z.enum(["quote", "decline", "question", "auto_reply", "unsubscribe", "aircraft_issue", "other"]),
  reason: z.string(),
});
export type ReplyKind = z.infer<typeof ClassifySchema>["kind"];

export async function classifyReply(text: string) {
  try {
    const { output } = await structured({
      schema: ClassifySchema,
      model: CLASSIFIER_MODEL,
      maxTokens: 400,
      system:
        "Classify an operator's email reply to a charter broker. quote: contains a price or aircraft offer. decline: no availability or not interested. question: asks for more details before quoting. auto_reply: out-of-office or automatic acknowledgement. unsubscribe: asks to stop receiving emails. aircraft_issue: says a booked aircraft is now unavailable (AOG, maintenance, mechanical, crew problem). other: anything else.",
      user: text.slice(0, 6000),
    });
    return output;
  } catch {
    return { kind: "other" as const, reason: "unparsed" };
  }
}

// Quote normalizer (blueprint s12): every operator reply into one format.
const Service = z.enum(["included", "additional", "available", "not_offered", "not_mentioned"]);
export const QuoteSchema = z.object({
  quote_found: z.boolean(),
  operator_name: z.string().nullable(),
  available: z.boolean().nullable(),
  aircraft: z.array(
    z.object({
      aircraft_type: z.string().nullable(),
      tail_number: z.string().nullable(),
      year: z.number().int().nullable(),
      max_pax: z.number().int().nullable(),
    })
  ),
  price: z.object({
    all_in_total: z.number().nullable(),
    currency: z.enum(["USD", "EUR", "GBP", "OTHER"]),
    base_flight_cost: z.number().nullable(),
    fet_included: z.boolean().nullable(),
    segment_fees_included: z.boolean().nullable(),
    international_fees_included: z.boolean().nullable(),
    deicing_included: z.boolean().nullable(),
    repositioning_included: z.boolean().nullable(),
    landing_ramp_fees_included: z.boolean().nullable(),
    crew_overnight_included: z.boolean().nullable(),
    other_fees: z.array(z.object({ label: z.string(), amount: z.number().nullable(), included: z.boolean() })),
  }),
  catering: Service,
  catering_price: z.number().nullable(),
  vehicle: Service,
  vehicle_price: z.number().nullable(),
  restrictions: z.string().nullable(),
  routing: z.object({
    origin_airport: z.string().nullable(),
    destination_airport: z.string().nullable(),
    departure_datetime_local: z.string().nullable(),
    flight_time_hours: z.number().nullable(),
  }),
  validity: z.object({
    quote_expires_at: z.string().nullable(),
    quote_expires_text: z.string().nullable(),
  }),
  cancellation_terms: z.string().nullable(),
  payment_terms: z.string().nullable(),
  confidence: z.number(),
  ambiguities: z.string().nullable(),
});
export type ExtractedQuote = z.infer<typeof QuoteSchema>;

export async function extractQuote(text: string, context: { tripSummary: string; operatorName: string }) {
  const { output, model } = await structured({
    schema: QuoteSchema,
    effort: "medium",
    cacheSystem: true,
    system: `Extract the charter quote from an operator's reply to a broker. Report only what the text states; use null or "not_mentioned" when something is not said. all_in_total is the total the operator will charge for the flight as written, excluding catering or vehicle if those are quoted separately. If the reply gives an hourly rate and hours but no total, compute the total and say so in ambiguities. available is whether the aircraft is available on the requested date. restrictions covers anything that limits the quote: curfews, crew duty, pets, luggage, deposit requirements. Dates in ISO 8601. confidence is 0 to 1 for how certain you are that all_in_total and the aircraft are right.`,
    user: `Today: ${new Date().toISOString().slice(0, 10)}\nOperator: ${context.operatorName}\nOur request: ${context.tripSummary}\n\nTheir reply:\n${text.slice(0, 12000)}`,
  });
  return { quote: output, model };
}

// Request parser (blueprint s29 role 1): a client's email into trip fields,
// plus what is still missing. Airport fields stay as the client wrote them;
// the caller resolves them against the airports table.
export const TripRequestSchema = z.object({
  is_trip_request: z.boolean(),
  client_name: z.string().nullable(),
  company_name: z.string().nullable(),
  phone: z.string().nullable(),
  origin: z.string().nullable(),
  origin_icao_guess: z.string().nullable(),
  destination: z.string().nullable(),
  destination_icao_guess: z.string().nullable(),
  departure_date: z.string().nullable(),
  departure_time: z.string().nullable(),
  return_date: z.string().nullable(),
  return_time: z.string().nullable(),
  passengers: z.number().int().nullable(),
  aircraft_type: z.string().nullable(),
  aircraft_category: z.enum(["turboprop", "very_light_jet", "light_jet", "midsize_jet", "super_midsize_jet", "heavy_jet", "ultra_long_range"]).nullable(),
  vehicle_required: z.boolean().nullable(),
  catering_required: z.boolean().nullable(),
  first_time_flyer: z.boolean().nullable(),
  special_requests: z.string().nullable(),
  missing_information: z.array(z.string()),
});
export type ParsedTripRequest = z.infer<typeof TripRequestSchema>;

export async function parseTripRequest(email: { from: string; fromName: string; subject: string; text: string }) {
  const { output, model } = await structured({
    schema: TripRequestSchema,
    effort: "medium",
    cacheSystem: true,
    system: `You read emails sent to a private jet charter broker and turn trip requests into structured fields.
is_trip_request is false for anything that is not a client asking for a flight (operator replies, newsletters, spam, general questions).
Airports: keep the client's wording in origin/destination and give your best ICAO code guess (for example "Teterboro" -> KTEB, "Miami" -> KMIA, "Van Nuys" -> KVNY); null if you cannot tell.
Dates as YYYY-MM-DD, times as 24-hour HH:MM local to the departure airport. Resolve relative dates like "next Friday" from the email date. Never invent a date, time, or passenger count that is not stated.
aircraft_category only when the client names a class or a type that clearly belongs to one.
special_requests: pets, luggage, accessibility, specific aircraft or airport, catering details, anything else the broker must know.
missing_information: short phrases for what a broker still needs to quote (e.g. "departure time", "passenger count", "return date if round trip").`,
    user: `Email date: ${new Date().toISOString().slice(0, 10)}\nFrom: ${email.fromName} <${email.from}>\nSubject: ${email.subject}\n\n${email.text.slice(0, 12000)}`,
  });
  return { request: output, model };
}

const ConfirmSchema = z.object({ subject: z.string(), body: z.string() });

export async function draftConfirmation(input: {
  operatorName: string;
  tripSummary: string;
  aircraft: string;
  agreedPrice: string;
  travelerName: string;
}) {
  const { output, model } = await structured({
    schema: ConfirmSchema,
    effort: "medium",
    maxTokens: 4000,
    system:
      "You write the booking confirmation email a charter broker sends to an operator after the client has paid. Plain text, under 150 words. Restate the trip, aircraft, and agreed operator price, say payment is being sent, and ask them to confirm the aircraft with a confirmation number and send the official itinerary. Sign as Jlaero Charter Desk. No footer.",
    user: `Operator: ${input.operatorName}\nTrip: ${input.tripSummary}\nAircraft: ${input.aircraft}\nAgreed price to operator: ${input.agreedPrice}\nLead passenger: ${input.travelerName}`,
  });
  return { ...output, model };
}
