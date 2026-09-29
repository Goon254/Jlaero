// Claude does three jobs in the sourcing loop: draft the RFQ email per
// operator, classify each inbound reply, and extract a structured quote.
// Drafting and extraction run on Claude Opus 5; classification on Haiku 4.5.
// Nothing here sends email or moves money; those steps stay behind a human.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import * as z from "zod/v4";

const MAIN_MODEL = "claude-opus-5";
const CLASSIFIER_MODEL = "claude-haiku-4-5";

let client: Anthropic | null = null;
function anthropic() {
  if (!client) client = new Anthropic();
  return client;
}

const SYSTEM_DRAFT = `You write charter request-for-quote emails on behalf of Jlaero, a US private jet charter broker.
Write to the operator's charter sales or dispatch desk. Plain text, no markdown, no bullet symbols.
Be specific: route with ICAO codes and city names, date and local time, passenger count, return leg if any, cabin class wanted.
Ask for an all-in quote including 7.5% federal excise tax and segment fees, the aircraft type and year, quote validity, and cancellation terms.
Mention that a reply to this email reaches the desk directly. Keep it under 170 words. Sign as "Jlaero Charter Desk".
Never invent facts about the operator. Do not include a footer; one is appended automatically.`;

const DraftSchema = z.object({
  subject: z.string(),
  body: z.string(),
});

export type TripSummary = {
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
  const res = await anthropic().messages.parse({
    model: MAIN_MODEL,
    max_tokens: 4000,
    output_config: { effort: "medium", format: zodOutputFormat(DraftSchema) },
    system: [{ type: "text", text: SYSTEM_DRAFT, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: `Operator: ${operator.name}${operator.contactName ? ` (contact: ${operator.contactName})` : ""}.
${operator.baseHint ? `Their fleet is registered around ${operator.baseHint}.` : ""}
${operator.fleetHint ? `Fleet on their certificate that fits: ${operator.fleetHint}.` : ""}

Trip:
- From ${trip.originIcao} (${trip.originName}) to ${trip.destinationIcao} (${trip.destinationName})${trip.distanceNm ? `, about ${trip.distanceNm} nm` : ""}
- Departure: ${trip.departAtLocal}
- Return: ${trip.returnAtLocal ?? "one way"}
- Passengers: ${trip.passengers}
- Cabin: ${trip.categoryLabel ?? "any suitable aircraft"}
- Traveler notes: ${trip.notes ?? "none"}

Write the subject and body.`,
      },
    ],
  });
  const out = res.parsed_output;
  if (!out) throw new Error("RFQ draft could not be parsed");
  return { ...out, model: MAIN_MODEL };
}

const ClassifySchema = z.object({
  kind: z.enum(["quote", "decline", "question", "auto_reply", "unsubscribe", "other"]),
  reason: z.string(),
});
export type ReplyKind = z.infer<typeof ClassifySchema>["kind"];

export async function classifyReply(text: string) {
  const res = await anthropic().messages.parse({
    model: CLASSIFIER_MODEL,
    max_tokens: 400,
    output_config: { format: zodOutputFormat(ClassifySchema) },
    system:
      "Classify an operator's email reply to a charter request-for-quote. quote: contains a price or aircraft offer. decline: no availability or not interested. question: asks for more details before quoting. auto_reply: out-of-office or automatic acknowledgement. unsubscribe: asks to stop receiving emails. other: anything else.",
    messages: [{ role: "user", content: text.slice(0, 6000) }],
  });
  return res.parsed_output ?? { kind: "other" as const, reason: "unparsed" };
}

export const QuoteSchema = z.object({
  quote_found: z.boolean(),
  operator_name: z.string().nullable(),
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
    catering_included: z.boolean().nullable(),
    repositioning_included: z.boolean().nullable(),
    landing_ramp_fees_included: z.boolean().nullable(),
    crew_overnight_included: z.boolean().nullable(),
    other_fees: z.array(z.object({ label: z.string(), amount: z.number().nullable(), included: z.boolean() })),
  }),
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
  const res = await anthropic().messages.parse({
    model: MAIN_MODEL,
    max_tokens: 8000,
    output_config: { effort: "medium", format: zodOutputFormat(QuoteSchema) },
    system: [
      {
        type: "text",
        text: `Extract the charter quote from an operator's email reply. Report only what the email states; use null when a field is not mentioned. all_in_total is the total the operator will charge for the whole trip as written. If the email gives an hourly rate and hours but no total, compute the total and note it in ambiguities. Dates in ISO 8601. confidence is 0 to 1 for how certain you are that all_in_total and the aircraft are right. Today is ${new Date().toISOString().slice(0, 10)}.`,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Operator: ${context.operatorName}\nOur request: ${context.tripSummary}\n\nTheir reply:\n${text.slice(0, 12000)}`,
      },
    ],
  });
  const out = res.parsed_output;
  if (!out) throw new Error("Quote extraction could not be parsed");
  return { quote: out, model: MAIN_MODEL };
}

const ConfirmSchema = z.object({ subject: z.string(), body: z.string() });

export async function draftConfirmation(input: {
  operatorName: string;
  tripSummary: string;
  aircraft: string;
  agreedPrice: string;
  travelerName: string;
}) {
  const res = await anthropic().messages.parse({
    model: MAIN_MODEL,
    max_tokens: 4000,
    output_config: { effort: "medium", format: zodOutputFormat(ConfirmSchema) },
    system:
      "You write the booking confirmation email a charter broker sends to an operator after the traveler accepts. Plain text, under 150 words. Restate the trip, aircraft, and agreed operator price, ask them to confirm the aircraft is held and to send the charter agreement and passenger requirements. Sign as Jlaero Charter Desk. No footer.",
    messages: [
      {
        role: "user",
        content: `Operator: ${input.operatorName}\nTrip: ${input.tripSummary}\nAircraft: ${input.aircraft}\nAgreed price to operator: ${input.agreedPrice}\nLead passenger: ${input.travelerName}`,
      },
    ],
  });
  const out = res.parsed_output;
  if (!out) throw new Error("Confirmation draft could not be parsed");
  return { ...out, model: MAIN_MODEL };
}
