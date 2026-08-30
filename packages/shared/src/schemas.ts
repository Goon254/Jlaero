// Zod schemas: one source of truth for validation on web, mobile, and API.
import { z } from "zod";
import {
  ACCOUNT_TYPES,
  AIRCRAFT_CATEGORIES,
  BOOKING_KINDS,
  CREW_KINDS,
} from "./constants";

const airportCode = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{3,4}$/, "Use a 3-letter IATA or 4-letter ICAO code")
  .transform((s) => s.toUpperCase());

export const profileSchema = z.object({
  full_name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(30).optional(),
  account_type: z.enum(ACCOUNT_TYPES),
  company_name: z.string().trim().max(160).optional(),
  bio: z.string().max(2000).optional(),
  home_base: airportCode.optional(),
});
export type ProfileInput = z.infer<typeof profileSchema>;

export const aircraftSchema = z.object({
  name: z.string().trim().min(1).max(120),
  manufacturer: z.string().trim().max(80).optional(),
  model: z.string().trim().max(80).optional(),
  year: z.number().int().min(1950).max(2100).optional(),
  category: z.enum(AIRCRAFT_CATEGORIES).optional(),
  seats: z.number().int().min(1).max(600).optional(),
  tail_number: z.string().trim().max(20).optional(),
  home_base: airportCode.optional(),
  description: z.string().max(5000).optional(),
  hourly_rate: z.number().nonnegative().optional(),
  currency: z.string().length(3).default("USD"),
  instant_book: z.boolean().default(false),
  daily_minimum_hours: z.number().nonnegative().max(24).optional(),
  overnight_crew_fee: z.number().nonnegative().optional(),
  positioning_included: z.boolean().default(true),
  range_nm: z.number().int().positive().max(20000).optional(),
  min_runway_ft: z.number().int().positive().max(20000).optional(),
  argus_rating: z.string().max(20).optional(),
  wyvern_rating: z.string().max(20).optional(),
  is_bao_stage: z.string().max(20).optional(),
  cancellation_tier: z.enum(["flexible", "moderate", "strict"]).default("moderate"),
});
export type AircraftInput = z.infer<typeof aircraftSchema>;

export const crewProfileSchema = z.object({
  headline: z.string().trim().max(160).optional(),
  crew_kind: z.enum(CREW_KINDS),
  total_hours: z.number().int().nonnegative().optional(),
  day_rate: z.number().nonnegative().optional(),
  currency: z.string().length(3).default("USD"),
  home_base: airportCode.optional(),
  bio: z.string().max(5000).optional(),
  instant_book: z.boolean().default(false),
});
export type CrewProfileInput = z.infer<typeof crewProfileSchema>;

export const saleListingSchema = z.object({
  title: z.string().trim().min(1).max(160),
  manufacturer: z.string().trim().max(80).optional(),
  model: z.string().trim().max(80).optional(),
  year: z.number().int().min(1950).max(2100).optional(),
  price: z.number().nonnegative().optional(),
  currency: z.string().length(3).default("USD"),
  location: z.string().trim().max(160).optional(),
  description: z.string().max(10000).optional(),
});
export type SaleListingInput = z.infer<typeof saleListingSchema>;

export const legSchema = z.object({
  origin: airportCode,
  destination: airportCode.optional(),
  depart_at: z.string().datetime().optional(),
  passengers: z.number().int().min(1).max(600).optional(),
  origin_fbo: z.string().trim().max(120).optional(),
  destination_fbo: z.string().trim().max(120).optional(),
});
export type LegInput = z.infer<typeof legSchema>;

export const bookingRequestSchema = z
  .object({
    kind: z.enum(BOOKING_KINDS),
    aircraft_id: z.string().uuid().optional(),
    crew_profile_id: z.string().uuid().optional(),
    legs: z.array(legSchema).min(1).max(10),
    pets: z.boolean().default(false),
    luggage_notes: z.string().max(1000).optional(),
    catering_notes: z.string().max(1000).optional(),
    special_requests: z.string().max(2000).optional(),
    notes: z.string().max(2000).optional(),
  })
  .refine(
    (b) => (b.kind === "charter" ? !!b.aircraft_id : !!b.crew_profile_id),
    { message: "charter needs aircraft_id; crew needs crew_profile_id" }
  )
  .refine(
    (b) => b.kind !== "charter" || b.legs.every((l) => !!l.destination),
    { message: "charter legs need a destination" }
  );
export type BookingRequestInput = z.infer<typeof bookingRequestSchema>;

export const passengerSchema = z.object({
  full_name: z.string().trim().min(1).max(160),
  date_of_birth: z.string().date().optional(),
  weight_kg: z.number().positive().max(300).optional(),
  notes: z.string().max(500).optional(),
});
export type PassengerInput = z.infer<typeof passengerSchema>;

export const messageSchema = z.object({
  conversation_id: z.string().uuid(),
  body: z.string().trim().min(1).max(4000),
});
export type MessageInput = z.infer<typeof messageSchema>;

export const reviewSchema = z.object({
  booking_id: z.string().uuid(),
  reviewee_id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
});
export type ReviewInput = z.infer<typeof reviewSchema>;
