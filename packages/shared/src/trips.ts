// Brokerage trip domain shared by web and mobile.
// Spec: docs/specs/01-workflow-summary.md and 02-technical-blueprint.md.

export const TRIP_STATUSES = [
  "new_request",
  "searching",
  "quotes_received",
  "broker_review",
  "options_sent",
  "client_selected",
  "contract_sent",
  "contract_signed",
  "payment_pending",
  "payment_received",
  "operator_confirmation_pending",
  "confirmed",
  "itinerary_pending",
  "itinerary_ready",
  "within_72_hours",
  "active",
  "operational_issue",
  "replacement_search",
  "replacement_pending_client",
  "completed",
  "feedback_requested",
  "closed",
  "cancelled",
] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];

// What the broker dashboard calls each status.
export const TRIP_STATUS_LABELS: Record<TripStatus, string> = {
  new_request: "New request",
  searching: "Searching for quotes",
  quotes_received: "Quotes received",
  broker_review: "Broker review",
  options_sent: "Options sent to client",
  client_selected: "Client selected",
  contract_sent: "Contract sent",
  contract_signed: "Contract signed",
  payment_pending: "Payment pending",
  payment_received: "Payment received",
  operator_confirmation_pending: "Operator confirmation pending",
  confirmed: "Trip confirmed",
  itinerary_pending: "Itinerary received",
  itinerary_ready: "Itinerary ready",
  within_72_hours: "Within 72 hours",
  active: "Trip active",
  operational_issue: "Operational issue: replacement required",
  replacement_search: "Replacement search",
  replacement_pending_client: "Replacement options with client",
  completed: "Trip completed",
  feedback_requested: "Feedback requested",
  closed: "Closed",
  cancelled: "Cancelled",
};

// What the client sees. Internal steps collapse into a calm, simple story.
export const CLIENT_STATUS_LABELS: Record<TripStatus, string> = {
  new_request: "Request received",
  searching: "Finding aircraft",
  quotes_received: "Finding aircraft",
  broker_review: "Finding aircraft",
  options_sent: "Your options are ready",
  client_selected: "Confirming availability",
  contract_sent: "Agreement ready to sign",
  contract_signed: "Agreement signed",
  payment_pending: "Payment due",
  payment_received: "Payment received",
  operator_confirmation_pending: "Confirming with the operator",
  confirmed: "Trip confirmed",
  itinerary_pending: "Preparing your itinerary",
  itinerary_ready: "Itinerary ready",
  within_72_hours: "Departing soon",
  active: "In progress",
  operational_issue: "We are arranging a replacement aircraft",
  replacement_search: "We are arranging a replacement aircraft",
  replacement_pending_client: "Replacement options ready",
  completed: "Completed",
  feedback_requested: "Completed",
  closed: "Completed",
  cancelled: "Cancelled",
};

// Client journey: REQUEST -> CHOOSE -> SIGN -> PAY -> FLY (blueprint s38).
export const CLIENT_STAGES = ["Request", "Choose", "Sign", "Pay", "Fly"] as const;
export function clientStageIndex(status: TripStatus): number {
  switch (status) {
    case "new_request":
    case "searching":
    case "quotes_received":
    case "broker_review":
      return 0;
    case "options_sent":
    case "client_selected":
      return 1;
    case "contract_sent":
      return 2;
    case "contract_signed":
    case "payment_pending":
      return 3;
    default:
      return 4;
  }
}

// Board columns for the broker dashboard.
export const TRIP_BOARD_GROUPS: { key: string; label: string; statuses: TripStatus[] }[] = [
  { key: "intake", label: "Intake", statuses: ["new_request", "searching", "quotes_received", "broker_review"] },
  { key: "client", label: "With client", statuses: ["options_sent", "client_selected", "contract_sent", "contract_signed", "payment_pending"] },
  { key: "booking", label: "Booking", statuses: ["payment_received", "operator_confirmation_pending", "confirmed", "itinerary_pending", "itinerary_ready"] },
  { key: "flying", label: "Upcoming and active", statuses: ["within_72_hours", "active"] },
  { key: "issues", label: "Operational issues", statuses: ["operational_issue", "replacement_search", "replacement_pending_client"] },
  { key: "after", label: "After the trip", statuses: ["completed", "feedback_requested"] },
];
export const OPEN_TRIP_STATUSES: TripStatus[] = TRIP_BOARD_GROUPS.flatMap((g) => g.statuses);

// The broker's next move per status, shown on the dashboard.
export const BROKER_NEXT_STEP: Partial<Record<TripStatus, string>> = {
  new_request: "Review the request and start the operator search",
  searching: "Collect quotes: send RFQs or enter quotes manually",
  quotes_received: "Verify quotes and approve the ones to offer",
  broker_review: "Choose up to 3 options and send them to the client",
  options_sent: "Waiting for the client to choose",
  client_selected: "Verify availability and price, then send the contract",
  contract_sent: "Waiting for the client to sign",
  contract_signed: "Payment request created",
  payment_pending: "Verify the client's payment",
  payment_received: "Pay the operator and request confirmation",
  operator_confirmation_pending: "Record the operator's confirmation number",
  confirmed: "Upload the operator itinerary",
  itinerary_pending: "Publish the branded itinerary to the client",
  itinerary_ready: "Monitor until departure",
  within_72_hours: "Final checks: crew, catering, vehicle",
  active: "Monitor the flight, then mark completed",
  operational_issue: "Urgent: search for a replacement aircraft",
  replacement_search: "Approve replacement options and send them to the client",
  replacement_pending_client: "Waiting for the client to choose a replacement",
  completed: "Feedback request sent automatically",
  feedback_requested: "Waiting for client feedback",
};

export const QUOTE_SOURCES = ["api", "email", "website", "manual", "ai_extracted"] as const;
export type QuoteSource = (typeof QUOTE_SOURCES)[number];
export const QUOTE_SOURCE_LABELS: Record<QuoteSource, string> = {
  api: "Operator API",
  email: "Email reply",
  website: "Operator website",
  manual: "Manually entered by broker",
  ai_extracted: "AI extracted",
};
export function isAutomaticSource(source: QuoteSource) {
  return source !== "manual";
}

export const QUOTE_STATUSES = [
  "pending_review", "approved", "rejected", "option_sent", "client_selected",
  "not_selected", "booked", "replaced", "withdrawn", "expired",
] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];
export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  pending_review: "Pending broker review",
  approved: "Verified",
  rejected: "Rejected",
  option_sent: "Sent to client",
  client_selected: "Client selected",
  not_selected: "Not selected",
  booked: "Booked",
  replaced: "Replaced",
  withdrawn: "Withdrawn",
  expired: "Expired",
};

export const PAYMENT_METHODS = ["credit_card", "ach", "wire", "direct_deposit"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  credit_card: "Credit card",
  ach: "ACH transfer",
  wire: "Wire transfer",
  direct_deposit: "Direct deposit",
};

export const PAYMENT_STATUSES = ["pending", "submitted", "received", "verified", "failed", "refunded", "cancelled"] as const;
export type TripPaymentStatus = (typeof PAYMENT_STATUSES)[number];
export const PAYMENT_STATUS_LABELS: Record<TripPaymentStatus, string> = {
  pending: "Pending",
  submitted: "Submitted by client",
  received: "Payment received",
  verified: "Payment verified",
  failed: "Payment failed",
  refunded: "Refunded",
  cancelled: "Cancelled",
};

export const ISSUE_KINDS = ["aog", "maintenance", "mechanical", "aircraft_unavailable", "crew", "weather", "other"] as const;
export type IssueKind = (typeof ISSUE_KINDS)[number];
export const ISSUE_KIND_LABELS: Record<IssueKind, string> = {
  aog: "AOG (aircraft on ground)",
  maintenance: "Maintenance issue",
  mechanical: "Mechanical issue",
  aircraft_unavailable: "Aircraft unavailable",
  crew: "Crew issue",
  weather: "Weather",
  other: "Other operational problem",
};

export const FEEDBACK_CATEGORIES = [
  ["booking", "Booking experience"],
  ["communication", "Communication"],
  ["aircraft", "Aircraft"],
  ["crew", "Crew"],
  ["ground", "Ground transportation"],
  ["catering", "Catering"],
  ["overall", "Overall experience"],
] as const;

export function formatTripNumber(n: string) {
  return n;
}

// ---------------------------------------------------------------------------
// Pricing engine (blueprint s8). Deterministic; the LLM never does the math.
// Client price = operator cost + markup + catering + vehicle + other fees.
// ---------------------------------------------------------------------------
export type PricingSettings = {
  default_markup_pct: number;
  min_markup_pct: number;
  catering_default: number;
  vehicle_default: number;
  service_fee: number;
};

export type PriceInput = {
  operatorCost: number;
  markupPct?: number | null;       // null uses the default
  cateringCost?: number | null;
  vehicleCost?: number | null;
  otherCost?: number | null;
  clientPriceOverride?: number | null; // admin-only: set the final price, markup absorbs the difference
};

export type PriceBreakdown = {
  operatorCost: number;
  markupPct: number;
  markupAmount: number;
  cateringCost: number;
  vehicleCost: number;
  otherCost: number;
  clientPrice: number;
  overridden: boolean;
  belowMinimum: boolean;
};

const cents = (n: number) => Math.round(n * 100) / 100;

export function computePrice(input: PriceInput, settings: PricingSettings): PriceBreakdown {
  const operatorCost = cents(Math.max(0, Number(input.operatorCost) || 0));
  const cateringCost = cents(Math.max(0, Number(input.cateringCost ?? 0) || 0));
  const vehicleCost = cents(Math.max(0, Number(input.vehicleCost ?? 0) || 0));
  const otherCost = cents(Math.max(0, Number(input.otherCost ?? 0) || 0));
  const services = cateringCost + vehicleCost + otherCost;

  let markupPct: number;
  let markupAmount: number;
  let overridden = false;
  if (input.clientPriceOverride != null && input.clientPriceOverride > 0) {
    overridden = true;
    markupAmount = cents(Number(input.clientPriceOverride) - operatorCost - services);
    markupPct = operatorCost > 0 ? cents((markupAmount / operatorCost) * 100) : 0;
  } else {
    markupPct = cents(input.markupPct ?? settings.default_markup_pct);
    markupAmount = cents((operatorCost * markupPct) / 100);
  }
  const clientPrice = cents(operatorCost + markupAmount + services);
  return {
    operatorCost, markupPct, markupAmount, cateringCost, vehicleCost, otherCost, clientPrice, overridden,
    belowMinimum: markupPct < settings.min_markup_pct,
  };
}

export function formatMoney(amount: number | string | null | undefined, currency = "USD") {
  if (amount == null || amount === "") return "";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: Number(amount) % 1 === 0 ? 0 : 2 }).format(Number(amount));
}

// ---------------------------------------------------------------------------
// Local airport time <-> instant. Clients enter departure time local to the
// departure airport; countdowns and the 72-hour reminder need the instant.
// ---------------------------------------------------------------------------
function tzOffsetMinutes(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return (asUtc - instant.getTime()) / 60000;
}

// "2026-10-15" + "15:30" in "America/New_York" -> Date. Unknown zone: UTC.
export function localToInstant(date: string, time: string | null | undefined, timeZone: string | null | undefined): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = (time || "12:00").split(":").map(Number);
  const guess = Date.UTC(y!, (m ?? 1) - 1, d ?? 1, hh ?? 12, mm ?? 0);
  if (!timeZone) return new Date(guess);
  try {
    const first = guess - tzOffsetMinutes(new Date(guess), timeZone) * 60000;
    // Second pass settles DST edges.
    return new Date(guess - tzOffsetMinutes(new Date(first), timeZone) * 60000);
  } catch {
    return new Date(guess);
  }
}

export function formatLocal(instant: Date | string, timeZone: string | null | undefined, opts: Intl.DateTimeFormatOptions = { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }) {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  try {
    return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: timeZone || "UTC", timeZoneName: timeZone ? undefined : "short" }).format(d);
  } catch {
    return d.toUTCString();
  }
}

// Countdown parts for the trip screen (spec s14).
export function countdown(to: Date | string, now = new Date()) {
  const ms = new Date(to).getTime() - now.getTime();
  const total = Math.max(0, ms);
  return {
    past: ms <= 0,
    hoursTotal: Math.floor(total / 3600000),
    days: Math.floor(total / 86400000),
    hours: Math.floor((total % 86400000) / 3600000),
    minutes: Math.floor((total % 3600000) / 60000),
  };
}
