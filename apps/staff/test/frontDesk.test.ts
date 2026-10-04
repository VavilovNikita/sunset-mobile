import { describe, expect, it } from "vitest";
import { isPositiveAmount } from "@sunset/core";
import { overdueDaysFor, overdueLabel, parsePaymentAmount, statusActions, stayActions, validateCancelReason } from "../src/lib/frontDesk";

const booking = (o: Partial<{ status: "NEW" | "CONFIRMED" | "PAID" | "CANCELLED"; occupancyStatus: "EXPECTED" | "CHECKED_IN" | "CHECKED_OUT" | "NO_SHOW"; checkIn: string; checkOut: string; roomUnitId: string | null }> = {}) => ({
  status: "CONFIRMED" as const,
  occupancyStatus: "EXPECTED" as const,
  checkIn: "2026-10-04",
  checkOut: "2026-10-06",
  roomUnitId: "u1",
  ...o,
});

describe("stay actions (same rules as the web booking panel)", () => {
  it("offers check-in and no-show from the arrival day, not before", () => {
    expect(stayActions(booking({ checkIn: "2026-10-05" }), "2026-10-04")).toMatchObject({ checkIn: false, noShow: false });
    expect(stayActions(booking(), "2026-10-04")).toMatchObject({ checkIn: true, noShow: true, checkOut: false, lateArrival: false });
  });
  it("lets a no-show still be checked in, and flags a late arrival", () => {
    expect(stayActions(booking({ occupancyStatus: "NO_SHOW" }), "2026-10-05")).toMatchObject({ checkIn: true, noShow: false });
    expect(stayActions(booking(), "2026-10-05").lateArrival).toBe(true);
  });
  it("offers nothing for a cancelled booking except a check-out of someone in house", () => {
    expect(stayActions(booking({ status: "CANCELLED" }), "2026-10-04")).toMatchObject({ checkIn: false, noShow: false, checkOut: false });
    expect(stayActions(booking({ occupancyStatus: "CHECKED_IN" }), "2026-10-04")).toMatchObject({ checkIn: false, checkOut: true });
  });
  it("knows when a room still needs assigning", () => {
    expect(stayActions(booking({ roomUnitId: null }), "2026-10-04").needsRoom).toBe(true);
  });
});

describe("overstay", () => {
  it("counts days past checkOut only for a guest still checked in", () => {
    expect(overdueDaysFor(booking({ occupancyStatus: "CHECKED_IN", checkOut: "2026-10-04" }), "2026-10-04")).toBe(0);
    expect(overdueDaysFor(booking({ occupancyStatus: "CHECKED_IN", checkOut: "2026-10-04" }), "2026-10-06")).toBe(2);
    expect(overdueDaysFor(booking({ occupancyStatus: "CHECKED_OUT", checkOut: "2026-10-01" }), "2026-10-06")).toBe(0);
    expect(overdueLabel(1)).toBe("1 day overdue");
    expect(overdueLabel(3)).toBe("3 days overdue");
    expect(overdueLabel(0)).toBeNull();
  });
});

describe("status, cancel reason, payment amount", () => {
  it("never offers a move out of CANCELLED", () => {
    expect(statusActions("CANCELLED")).toEqual([]);
    expect(statusActions("NEW").map((a) => a.to)).toEqual(["CONFIRMED", "PAID", "CANCELLED"]);
  });
  it("requires a reason to cancel", () => {
    expect(validateCancelReason("  ")).not.toBeNull();
    expect(validateCancelReason("Guest called")).toBeNull();
  });
  it("accepts only a positive amount with up to two decimals", () => {
    expect(parsePaymentAmount("1,500.50")).toBe("1500.50");
    expect(parsePaymentAmount("0")).toBeNull();
    expect(parsePaymentAmount("12.345")).toBeNull();
    expect(parsePaymentAmount("abc")).toBeNull();
  });
  it("gates on amounts", () => {
    expect(isPositiveAmount("0.00")).toBe(false);
    expect(isPositiveAmount("450.00")).toBe(true);
    expect(isPositiveAmount(null)).toBe(false);
  });
});
