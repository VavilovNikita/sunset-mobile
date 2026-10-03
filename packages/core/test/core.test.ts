import { describe, expect, it } from "vitest";
import { addDays, cashChange, createLatestGuard, formatBaht, formatDate, formatTimestamp, hotelDateKey, isDateKey } from "../src";

describe("hotel dates", () => {
  it("today is Bangkok's day, not UTC's (00:00-06:59 Bangkok is still yesterday in UTC)", () => {
    expect(hotelDateKey(new Date("2026-10-03T18:30:00Z"))).toBe("2026-10-04");
    expect(hotelDateKey(new Date("2026-10-03T16:59:00Z"))).toBe("2026-10-03");
  });
  it("adds days across month and year ends without any zone involved", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
  });
  it("rejects impossible dates the API would 400 on", () => {
    expect(isDateKey("2026-02-30")).toBe(false);
    expect(isDateKey("2026-02-28")).toBe(true);
  });
  it("formats stay dates and timestamps the way the admin does", () => {
    expect(formatDate("2026-10-03")).toBe("3 Oct 2026");
    expect(formatTimestamp("2026-10-03T07:05:00Z")).toBe("3 Oct 2026, 14:05");
    expect(formatTimestamp("2026-10-03T14:05:00+07:00")).toBe("3 Oct 2026, 14:05");
  });
});

describe("money display", () => {
  it("only formats the server's decimal string", () => {
    expect(formatBaht("1500.00")).toBe("฿1,500.00");
    expect(formatBaht("1234567.5")).toBe("฿1,234,567.50");
    expect(formatBaht(null)).toBe("—");
    expect(formatBaht("n/a")).toBe("n/a");
  });
});

describe("cash change", () => {
  it("is exact in satang", () => {
    expect(cashChange("123.45", "200")).toEqual({ ok: true, tendered: "200.00", change: "76.55" });
    expect(cashChange("0.30", "0.10")).toEqual({ ok: false, reason: "insufficient", short: "0.20" });
    expect(cashChange("100.00", "abc")).toEqual({ ok: false, reason: "invalid" });
  });
});

describe("latest guard", () => {
  it("drops a response whose request was overtaken", () => {
    const guard = createLatestGuard();
    const poll = guard.take();
    const write = guard.take();
    expect(guard.isLatest(poll)).toBe(false);
    expect(guard.isLatest(write)).toBe(true);
  });
});
