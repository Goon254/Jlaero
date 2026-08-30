// Flight-time and distance helpers used for instant pricing and feasibility.
import type { AircraftCategory } from "./constants";

const EARTH_RADIUS_NM = 3440.065;

export function haversineNm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_NM * Math.asin(Math.sqrt(a));
}

// Typical block cruise speeds in knots per category. Used only for ESTIMATES
// (instant-book pricing, search feasibility); real quotes come from operators.
export const CRUISE_SPEEDS_KTS: Record<AircraftCategory, number> = {
  turboprop: 280,
  very_light_jet: 340,
  light_jet: 400,
  midsize_jet: 430,
  super_midsize_jet: 460,
  heavy_jet: 470,
  ultra_long_range: 480,
  airliner: 460,
  helicopter: 130,
};

// Fixed allowance for taxi, climb, and descent per leg.
export const TAXI_CLIMB_BUFFER_HOURS = 0.3;

export function estimateFlightHours(
  distanceNm: number,
  category: AircraftCategory
): number {
  const speed = CRUISE_SPEEDS_KTS[category];
  const hours = distanceNm / speed + TAXI_CLIMB_BUFFER_HOURS;
  return Math.round(hours * 100) / 100;
}
