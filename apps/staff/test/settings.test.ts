import { describe, expect, it } from "vitest";
import { parsePrice, parseWhole, validateInclusiveRange, validateMenuItem, validateNewUser, validatePassword, validateTable } from "../src/lib/settings";

describe("settings forms", () => {
  it("parses prices the API accepts, zero included", () => {
    expect(parsePrice("1,500.50")).toBe(1500.5);
    expect(parsePrice("0")).toBe(0);
    expect(parsePrice("-1")).toBeNull();
    expect(parsePrice("1.234")).toBeNull();
    expect(parseWhole("12", 1, 50)).toBe(12);
    expect(parseWhole("51", 1, 50)).toBeNull();
  });
  it("needs a duration only for spa items", () => {
    const base = { name: "Pad Thai", category: "Mains", price: "220", department: "KITCHEN" as const, durationMinutes: "" };
    expect(validateMenuItem(base)).toEqual({});
    expect(Object.keys(validateMenuItem({ ...base, department: "SPA" }))).toEqual(["durationMinutes"]);
    expect(validateMenuItem({ ...base, department: "SPA", durationMinutes: "60" })).toEqual({});
  });
  it("checks a table", () => {
    expect(validateTable("7", "4")).toBeNull();
    expect(validateTable("", "4")).not.toBeNull();
    expect(validateTable("7", "0")).not.toBeNull();
  });
  it("lets an employee exist without a login, but a login needs both halves", () => {
    expect(validateNewUser("Noi", "", "")).toBeNull();
    expect(validateNewUser("Noi", "noi@x.com", "")).not.toBeNull();
    expect(validateNewUser("Noi", "", "password1")).not.toBeNull();
    expect(validateNewUser("Noi", "noi@x.com", "short")).not.toBeNull();
    expect(validateNewUser("Noi", "noi@x.com", "long-enough")).toBeNull();
    expect(validatePassword("1234567")).not.toBeNull();
  });
  it("treats ranges as inclusive", () => {
    expect(validateInclusiveRange("2026-10-04", "2026-10-04")).toBeNull();
    expect(validateInclusiveRange("2026-10-05", "2026-10-04")).not.toBeNull();
  });
});
