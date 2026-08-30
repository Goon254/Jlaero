import { describe, expect, it } from "vitest";
import {
  BOOKING_STATUSES,
  BOOKING_TRANSITIONS,
  canTransition,
  computeFetAmounts,
  platformFee,
  refundPercent,
} from "./constants";

describe("booking state machine", () => {
  it("has a transition entry for every status", () => {
    for (const s of BOOKING_STATUSES) {
      expect(BOOKING_TRANSITIONS[s]).toBeDefined();
    }
  });

  it("terminal states have no outgoing transitions", () => {
    for (const s of ["declined", "refunded", "expired"] as const) {
      expect(Object.keys(BOOKING_TRANSITIONS[s])).toHaveLength(0);
    }
  });

  it("follows the happy path with the right actors", () => {
    expect(canTransition("requested", "quoted", "provider")).toBe(true);
    expect(canTransition("quoted", "accepted", "buyer")).toBe(true);
    expect(canTransition("accepted", "contract_signed", "buyer")).toBe(true);
    expect(canTransition("contract_signed", "deposit_paid", "platform")).toBe(true);
    expect(canTransition("deposit_paid", "paid_in_full", "platform")).toBe(true);
    expect(canTransition("paid_in_full", "in_progress", "provider")).toBe(true);
    expect(canTransition("in_progress", "completed", "provider")).toBe(true);
  });

  it("denies the wrong actor", () => {
    expect(canTransition("requested", "quoted", "buyer")).toBe(false);
    expect(canTransition("quoted", "accepted", "provider")).toBe(false);
    expect(canTransition("contract_signed", "paid_in_full", "buyer")).toBe(false);
    expect(canTransition("in_progress", "completed", "buyer")).toBe(false);
  });

  it("denies skipping states", () => {
    expect(canTransition("requested", "paid_in_full", "platform")).toBe(false);
    expect(canTransition("accepted", "deposit_paid", "platform")).toBe(false);
    expect(canTransition("quoted", "in_progress", "provider")).toBe(false);
  });

  it("only the platform refunds and only from valid states", () => {
    expect(canTransition("cancelled", "refunded", "platform")).toBe(true);
    expect(canTransition("disputed", "refunded", "platform")).toBe(true);
    expect(canTransition("cancelled", "refunded", "provider")).toBe(false);
    expect(canTransition("completed", "refunded", "platform")).toBe(false);
  });
});

describe("cancellation refunds", () => {
  it("flexible tier boundaries", () => {
    expect(refundPercent("flexible", 72)).toBe(100);
    expect(refundPercent("flexible", 48)).toBe(100);
    expect(refundPercent("flexible", 47)).toBe(50);
    expect(refundPercent("flexible", 0)).toBe(50);
  });

  it("moderate tier boundaries", () => {
    expect(refundPercent("moderate", 200)).toBe(100);
    expect(refundPercent("moderate", 168)).toBe(100);
    expect(refundPercent("moderate", 100)).toBe(50);
    expect(refundPercent("moderate", 24)).toBe(0);
  });

  it("strict tier boundaries", () => {
    expect(refundPercent("strict", 400)).toBe(100);
    expect(refundPercent("strict", 200)).toBe(50);
    expect(refundPercent("strict", 100)).toBe(0);
  });
});

describe("money math", () => {
  it("computes FET and segment fees", () => {
    const { fet, segmentFees } = computeFetAmounts(20000, 2, 4);
    expect(fet).toBe(1500); // 7.5% of 20000
    expect(segmentFees).toBe(41.6); // 2 segments x 4 pax x 5.20
  });

  it("computes the platform fee", () => {
    expect(platformFee(10000)).toBe(1000);
    expect(platformFee(99.99)).toBe(10);
  });
});
