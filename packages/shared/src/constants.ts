// Domain constants shared across web + mobile.

export const APP_ROLES = ["traveler", "owner", "crew", "admin"] as const;
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

export const BOOKING_STATUSES = [
  "requested",
  "quoted",
  "negotiating",
  "accepted",
  "paid",
  "in_progress",
  "completed",
  "cancelled",
  "declined",
  "refunded",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

// Allowed booking status transitions (state machine).
export const BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  requested: ["quoted", "accepted", "declined", "cancelled"],
  quoted: ["negotiating", "accepted", "declined", "cancelled"],
  negotiating: ["quoted", "accepted", "declined", "cancelled"],
  accepted: ["paid", "cancelled"],
  paid: ["in_progress", "cancelled", "refunded"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
  declined: [],
  refunded: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return BOOKING_TRANSITIONS[from]?.includes(to) ?? false;
}

// Platform commission (marketplace fee) as a fraction of the booking total.
export const PLATFORM_FEE_RATE = 0.1;

export function platformFee(amount: number, rate = PLATFORM_FEE_RATE): number {
  return Math.round(amount * rate * 100) / 100;
}
