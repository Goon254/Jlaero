// Domain constants shared across web + mobile.

export const APP_ROLES = ["traveler", "owner", "crew", "admin", "broker", "finance"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const ACCOUNT_TYPES = ["individual", "business"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const AIRCRAFT_CATEGORIES = [
  "turboprop",
  "very_light_jet",
  "light_jet",
  "midsize_jet",
  "super_midsize_jet",
  "heavy_jet",
  "ultra_long_range",
  "airliner",
  "helicopter",
] as const;
export type AircraftCategory = (typeof AIRCRAFT_CATEGORIES)[number];

export const AIRCRAFT_CATEGORY_LABELS: Record<AircraftCategory, string> = {
  turboprop: "Turboprop",
  very_light_jet: "Very Light Jet",
  light_jet: "Light Jet",
  midsize_jet: "Midsize Jet",
  super_midsize_jet: "Super Midsize Jet",
  heavy_jet: "Heavy Jet",
  ultra_long_range: "Ultra Long Range",
  airliner: "Airliner",
  helicopter: "Helicopter",
};

export const CREW_KINDS = [
  "captain",
  "first_officer",
  "flight_attendant",
  "engineer",
  "other",
] as const;
export type CrewKind = (typeof CREW_KINDS)[number];

export const LISTING_STATUSES = ["draft", "active", "paused", "archived"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const SALE_STATUSES = ["draft", "active", "under_offer", "sold", "archived"] as const;
export type SaleStatus = (typeof SALE_STATUSES)[number];

export const BOOKING_KINDS = ["charter", "crew"] as const;
export type BookingKind = (typeof BOOKING_KINDS)[number];

// ---------------------------------------------------------------------------
// Booking state machine v2 with actor permissions
// ---------------------------------------------------------------------------
export const BOOKING_STATUSES = [
  "requested",
  "quoted",
  "negotiating",
  "accepted",
  "contract_signed",
  "deposit_paid",
  "paid_in_full",
  "in_progress",
  "completed",
  "cancelled",
  "declined",
  "refunded",
  "expired",
  "disputed",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export type BookingActor = "buyer" | "provider" | "platform";

// For each from-state: the to-states allowed, and WHO may perform each.
// "platform" = server-side processes (webhooks, expiry jobs, admin).
export const BOOKING_TRANSITIONS: Record<
  BookingStatus,
  Partial<Record<BookingStatus, BookingActor[]>>
> = {
  requested: {
    quoted: ["provider"],
    declined: ["provider"],
    cancelled: ["buyer"],
    expired: ["platform"],
  },
  quoted: {
    negotiating: ["buyer", "provider"],
    accepted: ["buyer"],
    declined: ["provider"],
    cancelled: ["buyer", "provider"],
    expired: ["platform"],
  },
  negotiating: {
    quoted: ["buyer", "provider"],
    accepted: ["buyer"],
    declined: ["provider"],
    cancelled: ["buyer", "provider"],
    expired: ["platform"],
  },
  accepted: {
    contract_signed: ["buyer"],
    cancelled: ["buyer", "provider"],
    expired: ["platform"],
  },
  contract_signed: {
    deposit_paid: ["platform"],
    paid_in_full: ["platform"],
    cancelled: ["buyer", "provider"],
  },
  deposit_paid: {
    paid_in_full: ["platform"],
    cancelled: ["buyer", "provider"],
    disputed: ["buyer"],
  },
  paid_in_full: {
    in_progress: ["provider", "platform"],
    cancelled: ["buyer", "provider"],
    refunded: ["platform"],
    disputed: ["buyer"],
  },
  in_progress: {
    completed: ["provider", "platform"],
    disputed: ["buyer"],
  },
  completed: {
    disputed: ["buyer"],
  },
  cancelled: {
    refunded: ["platform"],
  },
  disputed: {
    refunded: ["platform"],
    completed: ["platform"],
  },
  declined: {},
  refunded: {},
  expired: {},
};

export function canTransition(
  from: BookingStatus,
  to: BookingStatus,
  actor?: BookingActor
): boolean {
  const actors = BOOKING_TRANSITIONS[from]?.[to];
  if (!actors) return false;
  return actor ? actors.includes(actor) : true;
}

export const CANCEL_ACTORS = ["buyer", "provider", "platform"] as const;
export const CANCEL_REASONS = ["standard", "weather", "mechanical", "other"] as const;
export type CancelReason = (typeof CANCEL_REASONS)[number];

// ---------------------------------------------------------------------------
// Cancellation policy tiers (percentages are defaults pending owner sign-off)
// ---------------------------------------------------------------------------
export const CANCELLATION_TIERS = ["flexible", "moderate", "strict"] as const;
export type CancellationTier = (typeof CANCELLATION_TIERS)[number];

type RefundStep = { minHoursBefore: number; refundPct: number };

export const CANCELLATION_SCHEDULES: Record<CancellationTier, RefundStep[]> = {
  flexible: [
    { minHoursBefore: 48, refundPct: 100 },
    { minHoursBefore: 0, refundPct: 50 },
  ],
  moderate: [
    { minHoursBefore: 168, refundPct: 100 },
    { minHoursBefore: 48, refundPct: 50 },
    { minHoursBefore: 0, refundPct: 0 },
  ],
  strict: [
    { minHoursBefore: 336, refundPct: 100 },
    { minHoursBefore: 168, refundPct: 50 },
    { minHoursBefore: 0, refundPct: 0 },
  ],
};

// Buyer-initiated standard cancellation. Provider, weather, or mechanical
// cancellations always refund 100% (enforced by the booking engine).
export function refundPercent(tier: CancellationTier, hoursBeforeDeparture: number): number {
  for (const step of CANCELLATION_SCHEDULES[tier]) {
    if (hoursBeforeDeparture >= step.minHoursBefore) return step.refundPct;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Quotes and taxes
// ---------------------------------------------------------------------------
export const QUOTE_LINE_KINDS = [
  "flight_time",
  "positioning",
  "daily_minimum",
  "landing_fees",
  "crew_overnight",
  "catering",
  "fuel_surcharge",
  "discount",
  "tax_fet",
  "tax_segment",
  "other",
] as const;
export type QuoteLineKind = (typeof QUOTE_LINE_KINDS)[number];

// US Federal Excise Tax on domestic air transportation.
// Verify both values against current IRS figures each year.
export const FET_RATE = 0.075;
export const SEGMENT_FEE_USD = 5.2; // per passenger, per segment (domestic)

export function computeFetAmounts(
  taxableSubtotal: number,
  segments: number,
  passengers: number
): { fet: number; segmentFees: number } {
  const fet = Math.round(taxableSubtotal * FET_RATE * 100) / 100;
  const segmentFees =
    Math.round(segments * passengers * SEGMENT_FEE_USD * 100) / 100;
  return { fet, segmentFees };
}

// ---------------------------------------------------------------------------
// Safety ratings (self-declared at listing, verified during operator review)
// ---------------------------------------------------------------------------
export const ARGUS_RATINGS = ["Gold", "Gold+", "Platinum"] as const;
export const WYVERN_RATINGS = ["Registered", "Wingman", "Certified"] as const;
export const IS_BAO_STAGES = ["Stage 1", "Stage 2", "Stage 3"] as const;

// ---------------------------------------------------------------------------
// Platform fee
// ---------------------------------------------------------------------------
export const PLATFORM_FEE_RATE = 0.1;

export function platformFee(amount: number, rate = PLATFORM_FEE_RATE): number {
  return Math.round(amount * rate * 100) / 100;
}
