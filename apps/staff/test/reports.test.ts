import { describe, expect, it } from "vitest";
import { actorLabel, monthLabel, monthOf, monthRange, percent, shiftMonth } from "../src/lib/reports";

describe("report ranges", () => {
  it("covers whole months, leap February included", () => {
    expect(monthRange({ year: 2026, month: 10 })).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(monthRange({ year: 2028, month: 2 })).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(monthRange({ year: 2026, month: 12 })).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  });
  it("steps across years", () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(monthOf("2026-10-04")).toEqual({ year: 2026, month: 10 });
    expect(monthLabel({ year: 2026, month: 10 })).toBe("October 2026");
  });
  it("words server figures without computing them", () => {
    expect(percent("71.43")).toBe("71.43%");
    expect(percent(null)).toBe("—");
    expect(actorLabel("sys@x", null)).toBe("System");
    expect(actorLabel("a@b", "MANAGER")).toBe("a@b (manager)");
  });
});
