import { describe, expect, it } from "vitest";
import { canEditLine, canVoidLine, isChargeableBooking, menuForOrder, orderLabel, tablelessOpenOrders, validateVoidReason } from "../src/lib/pos";
import { mergePrintJobLists, notPrintedBannerText, printerHealth, summarizeNotPrinted } from "../src/lib/printQueue";

const item = (id: string, department: "KITCHEN" | "BAR" | "SPA", isAvailable = true) =>
  ({ id, name: id, description: "", category: "c", department, price: "100.00", isAvailable, createdAt: "", durationMinutes: null }) as never;

describe("menu for an order", () => {
  const menu = [item("steak", "KITCHEN"), item("mojito", "BAR"), item("massage", "SPA"), item("gone", "KITCHEN", false)];
  it("restaurant tables never see spa treatments or unavailable items", () => {
    expect(menuForOrder(menu, "RESTAURANT").map((m) => (m as { id: string }).id)).toEqual(["steak", "mojito"]);
  });
  it("spa tables see only treatments", () => {
    expect(menuForOrder(menu, "SPA").map((m) => (m as { id: string }).id)).toEqual(["massage"]);
  });
});

describe("line rules", () => {
  it("unsent lines are edited only while OPEN; sent lines are voided, not edited", () => {
    expect(canEditLine({ status: "OPEN" }, { sentAt: null })).toBe(true);
    expect(canEditLine({ status: "SENT" }, { sentAt: null })).toBe(false);
    expect(canEditLine({ status: "OPEN" }, { sentAt: "2026-10-03T10:00:00Z" })).toBe(false);
    expect(canVoidLine({ status: "SENT" }, { sentAt: "2026-10-03T10:00:00Z" })).toBe(true);
    expect(canVoidLine({ status: "PAID" }, { sentAt: "2026-10-03T10:00:00Z" })).toBe(false);
  });
  it("a void needs a reason", () => {
    expect(validateVoidReason("  ")).not.toBeNull();
    expect(validateVoidReason("guest changed mind")).toBeNull();
  });
  it("labels an order by receipt number with the id beside it", () => {
    expect(orderLabel({ number: 1234, id: "abcdef12-3456" })).toBe("#1234 · abcdef12");
  });
  it("charges to a checked-in guest whatever the booking status, never a cancelled one", () => {
    expect(isChargeableBooking({ status: "NEW", occupancyStatus: "CHECKED_IN" })).toBe(true);
    expect(isChargeableBooking({ status: "PAID", occupancyStatus: "CHECKED_IN" })).toBe(true);
    expect(isChargeableBooking({ status: "CONFIRMED", occupancyStatus: "EXPECTED" })).toBe(false);
    expect(isChargeableBooking({ status: "CONFIRMED", occupancyStatus: "CHECKED_OUT" })).toBe(false);
    expect(isChargeableBooking({ status: "CANCELLED", occupancyStatus: "CHECKED_IN" })).toBe(false);
  });
});

describe("print status from the queue", () => {
  const job = (id: string, status: "PENDING" | "SENT" | "FAILED", createdAt: string, dismissedAt: string | null = null) =>
    ({ id, status, createdAt, dismissedAt, printerId: "p", documentType: "KITCHEN_TICKET", summary: "", attempts: 1, lastError: null, updatedAt: createdAt }) as never;

  it("counts FAILED and PENDING as not printed, ignoring dismissed ones", () => {
    const jobs = mergePrintJobLists([
      [job("a", "FAILED", "2026-10-03T10:00:00Z"), job("b", "FAILED", "2026-10-03T09:00:00Z", "2026-10-03T09:30:00Z")],
      [job("c", "PENDING", "2026-10-03T11:00:00Z"), job("a", "FAILED", "2026-10-03T10:00:00Z")],
    ]);
    expect(jobs.map((j) => (j as { id: string }).id)).toEqual(["c", "a", "b"]);
    const summary = summarizeNotPrinted(jobs);
    expect(summary).toEqual({ total: 2, retrying: 1 });
    expect(notPrintedBannerText(summary)).toContain("2 print jobs not printed (1 still retrying)");
  });

  it("printer health comes from the last send and the last failure", () => {
    const now = new Date("2026-10-03T12:00:00Z");
    expect(printerHealth({ lastSentAt: "2026-10-03T11:00:00Z", lastFailedAt: "2026-10-03T11:30:00Z" }, now).state).toBe("offline");
    expect(printerHealth({ lastSentAt: "2026-10-03T11:00:00Z", lastFailedAt: undefined }, now).state).toBe("online");
    expect(printerHealth({ lastSentAt: "2026-10-01T11:00:00Z", lastFailedAt: undefined }, now).state).toBe("quiet");
    expect(printerHealth({ lastSentAt: undefined, lastFailedAt: undefined }, now).state).toBe("unknown");
  });
});

import { floorTables, tableAction } from "../src/lib/pos";

describe("tapping a table", () => {
  const t = (openOrderIds: string[], isActive = true, zone = "RESTAURANT") => ({ openOrderIds, isActive, zone }) as never;
  it("opens nothing until the first item - a free table starts a draft", () => {
    expect(tableAction(t([]))).toEqual({ kind: "start" });
    expect(tableAction(t(["o1"]))).toEqual({ kind: "open", orderId: "o1" });
    expect(tableAction(t(["o1", "o2"]))).toEqual({ kind: "pick", orderIds: ["o1", "o2"] });
    expect(tableAction(t([], false))).toEqual({ kind: "none" });
  });
  it("leaves spa tables off the restaurant floor", () => {
    expect(floorTables([t([], true, "SPA"), t([], true, "BAR"), t([], false, "BAR"), t(["o"], false, "BAR")])).toHaveLength(2);
  });
});

describe("tablelessOpenOrders", () => {
  const o = (id: string, tableId: string | null, status: "OPEN" | "SENT" | "PAID" | "CANCELLED", createdAt: string) => ({ id, tableId, status, createdAt });
  it("keeps only open orders with no table, oldest first", () => {
    const orders = [
      o("late", null, "SENT", "2026-10-04T10:05:00Z"),
      o("table", "t1", "OPEN", "2026-10-04T09:00:00Z"),
      o("paid", null, "PAID", "2026-10-04T08:00:00Z"),
      o("cancelled", null, "CANCELLED", "2026-10-04T08:00:00Z"),
      o("early", null, "OPEN", "2026-10-04T09:30:00Z"),
    ];
    expect(tablelessOpenOrders(orders).map((x) => x.id)).toEqual(["early", "late"]);
  });
});
