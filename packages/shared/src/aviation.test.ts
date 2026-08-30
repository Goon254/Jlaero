import { describe, expect, it } from "vitest";
import { estimateFlightHours, haversineNm } from "./aviation";

// Real coordinates
const JFK = { lat: 40.639447, lon: -73.779317 };
const LAX = { lat: 33.9425, lon: -118.408 };
const TEB = { lat: 40.850101, lon: -74.060799 };

describe("haversineNm", () => {
  it("JFK to LAX is about 2145 nm", () => {
    const d = haversineNm(JFK.lat, JFK.lon, LAX.lat, LAX.lon);
    expect(d).toBeGreaterThan(2100);
    expect(d).toBeLessThan(2200);
  });

  it("JFK to Teterboro is short", () => {
    const d = haversineNm(JFK.lat, JFK.lon, TEB.lat, TEB.lon);
    expect(d).toBeGreaterThan(10);
    expect(d).toBeLessThan(25);
  });

  it("zero distance to itself", () => {
    expect(haversineNm(JFK.lat, JFK.lon, JFK.lat, JFK.lon)).toBe(0);
  });
});

describe("estimateFlightHours", () => {
  it("transcontinental light jet is roughly 5.5 to 6 hours", () => {
    const d = haversineNm(JFK.lat, JFK.lon, LAX.lat, LAX.lon);
    const h = estimateFlightHours(d, "light_jet");
    expect(h).toBeGreaterThan(5.2);
    expect(h).toBeLessThan(6.2);
  });

  it("faster category means fewer hours", () => {
    const d = 2000;
    expect(estimateFlightHours(d, "ultra_long_range")).toBeLessThan(
      estimateFlightHours(d, "light_jet")
    );
  });
});
