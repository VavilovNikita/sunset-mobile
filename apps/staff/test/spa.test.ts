import { describe, expect, it } from "vitest";
import { appointmentAt, fitsOnTable, slotStarts, therapistBusy } from "../src/lib/spa";

const appt = (over: Record<string, unknown>) =>
  ({ id: "a", tableId: "t1", therapistUserId: "th1", startTime: "10:00:00", durationMinutes: 60, status: "BOOKED", ...over }) as never;

describe("spa grid", () => {
  it("slots come from the server's hours and slot size", () => {
    expect(slotStarts({ openingTime: "09:00", closingTime: "11:00", slotMinutes: 30 })).toEqual(["09:00", "09:30", "10:00", "10:30"]);
  });
  it("an appointment covers every slot of its duration; cancelled ones free the slot", () => {
    const list = [appt({}), appt({ id: "b", startTime: "12:00", status: "CANCELLED" })];
    expect(appointmentAt(list, "t1", "10:30")?.id).toBe("a");
    expect(appointmentAt(list, "t1", "11:00")).toBeUndefined();
    expect(appointmentAt(list, "t1", "12:00")).toBeUndefined();
  });
  it("previews a therapist clash and a treatment running into the next booking", () => {
    const list = [appt({})];
    expect(therapistBusy(list, "th1", "10:30", 30)?.id).toBe("a");
    expect(therapistBusy(list, "th1", "11:00", 30)).toBeUndefined();
    expect(fitsOnTable(list, "t1", "09:30", 60, "20:00")).toBe(false);
    expect(fitsOnTable(list, "t1", "09:00", 60, "20:00")).toBe(true);
    expect(fitsOnTable([], "t1", "19:30", 60, "20:00")).toBe(false);
  });
});
