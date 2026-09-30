import { describe, expect, it } from "vitest";
import { computePrice, localToInstant, clientStageIndex } from "./trips";

const settings = { default_markup_pct: 10, min_markup_pct: 5, catering_default: 0, vehicle_default: 0, service_fee: 0 };

describe("computePrice", () => {
  it("matches the blueprint example: 20,000 + 10% + 500 + 750 = 23,250", () => {
    const p = computePrice({ operatorCost: 20000, cateringCost: 500, vehicleCost: 750 }, settings);
    expect(p.markupAmount).toBe(2000);
    expect(p.clientPrice).toBe(23250);
    expect(p.belowMinimum).toBe(false);
  });
  it("uses a per-quote markup and flags one below the minimum", () => {
    const p = computePrice({ operatorCost: 20000, markupPct: 4 }, settings);
    expect(p.clientPrice).toBe(20800);
    expect(p.belowMinimum).toBe(true);
  });
  it("backs the markup out of an overridden client price", () => {
    const p = computePrice({ operatorCost: 20000, vehicleCost: 750, clientPriceOverride: 23000 }, settings);
    expect(p.overridden).toBe(true);
    expect(p.markupAmount).toBe(2250);
    expect(p.markupPct).toBe(11.25);
    expect(p.clientPrice).toBe(23000);
  });
});

describe("localToInstant", () => {
  it("resolves New York local time in daylight time", () => {
    expect(localToInstant("2026-10-15", "15:30", "America/New_York").toISOString()).toBe("2026-10-15T19:30:00.000Z");
  });
  it("resolves standard time after the DST change", () => {
    expect(localToInstant("2026-12-15", "15:30", "America/New_York").toISOString()).toBe("2026-12-15T20:30:00.000Z");
  });
  it("falls back to UTC with no zone", () => {
    expect(localToInstant("2026-10-15", "15:30", null).toISOString()).toBe("2026-10-15T15:30:00.000Z");
  });
});

describe("clientStageIndex", () => {
  it("maps statuses onto request, choose, sign, pay, fly", () => {
    expect(clientStageIndex("searching")).toBe(0);
    expect(clientStageIndex("options_sent")).toBe(1);
    expect(clientStageIndex("contract_sent")).toBe(2);
    expect(clientStageIndex("payment_pending")).toBe(3);
    expect(clientStageIndex("confirmed")).toBe(4);
  });
});
