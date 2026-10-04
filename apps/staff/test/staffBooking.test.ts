import { describe, expect, it } from "vitest";
import { segmentsInRange, validateStaffBooking } from "../src/lib/staffBooking";

const ok = { guestName: "Ann Lee", guestEmail: "", guestPhone: "", channel: "WALK_IN" as const, adults: 2, children: 0 };

describe("new booking form", () => {
  it("accepts a walk-in with only a name", () => {
    expect(validateStaffBooking(ok)).toEqual({});
  });
  it("flags each bad field next to itself", () => {
    const e = validateStaffBooking({ guestName: "A", guestEmail: "nope", guestPhone: "12", channel: null, adults: 0, children: -1 });
    expect(Object.keys(e).sort()).toEqual(["adults", "channel", "children", "guestEmail", "guestName", "guestPhone"]);
  });
});

describe("calendar rows in a range", () => {
  const rows = [
    { id: "a", checkIn: "2026-10-01", checkOut: "2026-10-04" },
    { id: "b", checkIn: "2026-10-04", checkOut: "2026-10-06" },
    { id: "c", checkIn: "2026-10-20", checkOut: "2026-10-22" },
    { id: "late", checkIn: "2026-09-25", checkOut: "2026-09-30", overstayUntil: "2026-10-05" },
  ];
  it("keeps stays that occupy a night in [from, to); the departure day is free", () => {
    expect(segmentsInRange(rows, "2026-10-04", "2026-10-18").map((r) => r.id)).toEqual(["late", "b"]);
  });
  it("keeps an overstaying guest through their overstay (overstayUntil is exclusive, like checkOut)", () => {
    expect(segmentsInRange(rows, "2026-10-04", "2026-10-05").map((r) => r.id)).toEqual(["late", "b"]);
    expect(segmentsInRange(rows, "2026-10-05", "2026-10-06").map((r) => r.id)).toEqual(["b"]);
  });
});
