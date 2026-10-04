import { describe, expect, it } from "vitest";
import { can, hasRoleAtLeast, homeEntriesFor, homeGroupsFor, type Capability, type Role, type StaffUser } from "../src/lib/access";

const user = (role: Role, functions: StaffUser["functions"] = []): StaffUser => ({ id: "u", name: "Test", role, functions });

describe("role ladder", () => {
  it("ADMIN > MANAGER > CASHIER > WAITER", () => {
    expect(hasRoleAtLeast("ADMIN", "MANAGER")).toBe(true);
    expect(hasRoleAtLeast("CASHIER", "MANAGER")).toBe(false);
    expect(hasRoleAtLeast("WAITER", "WAITER")).toBe(true);
  });
});

describe("what each role can do (mirrors SecurityConfig)", () => {
  const cases: [Capability, Role, boolean][] = [
    ["pos.use", "WAITER", true],
    ["pos.takePayment", "WAITER", false],
    ["pos.takePayment", "CASHIER", true],
    ["pos.voidSentItem", "CASHIER", false],
    ["pos.voidSentItem", "MANAGER", true],
    ["shift.manage", "WAITER", false],
    ["shift.manage", "CASHIER", true],
    ["print.printers", "CASHIER", false],
    ["print.printers", "ADMIN", true],
    ["housekeeping.view", "WAITER", true],
    ["housekeeping.change", "WAITER", false],
    ["housekeeping.change", "CASHIER", true],
    ["spa.use", "WAITER", false],
    ["spa.use", "CASHIER", true],
    ["attendance.today", "CASHIER", false],
    ["attendance.today", "MANAGER", true],
  ];
  it.each(cases)("%s for %s -> %s", (capability, role, expected) => {
    expect(can(user(role), capability)).toBe(expected);
  });
});

describe("job functions are their own axis", () => {
  it("a WAITER who is an ENGINEER can close maintenance tasks; a plain CASHIER can't", () => {
    expect(can(user("WAITER", ["ENGINEER"]), "maintenance.changeStatus")).toBe(true);
    expect(can(user("CASHIER"), "maintenance.changeStatus")).toBe(false);
  });
  it("a MANAGER can without holding the function (explicit fallback)", () => {
    expect(can(user("MANAGER"), "maintenance.changeStatus")).toBe(true);
  });
  it("a function never lifts the role: an ENGINEER WAITER still can't take payments", () => {
    expect(can(user("WAITER", ["ENGINEER", "THERAPIST"]), "pos.takePayment")).toBe(false);
    expect(can(user("WAITER", ["THERAPIST"]), "spa.use")).toBe(false);
  });
});

describe("home menu", () => {
  it("a waiter sees floor work only, no front desk", () => {
    expect(homeEntriesFor(user("WAITER")).map((e) => e.href).sort()).toEqual(["/housekeeping", "/maintenance", "/pos", "/print", "/roster"]);
  });
  it("a cashier also gets the front desk, the shift and spa", () => {
    const hrefs = homeEntriesFor(user("CASHIER")).map((e) => e.href);
    for (const h of ["/today", "/bookings", "/guests", "/night-audit", "/shift", "/spa"]) expect(hrefs).toContain(h);
  });
  it("never renders an empty group, and keeps group order", () => {
    for (const role of ["WAITER", "CASHIER", "MANAGER", "ADMIN"] as Role[]) {
      const groups = homeGroupsFor(user(role));
      expect(groups.every((g) => g.entries.length > 0)).toBe(true);
      expect(new Set(groups.map((g) => g.title)).size).toBe(groups.length);
    }
    expect(homeGroupsFor(user("WAITER")).map((g) => g.title)).toEqual(["Front desk", "Restaurant", "Staff"]);
  });
});
