import type { Schemas } from "@sunset/api-client/staff";

type Appointment = Schemas["SpaAppointment"];

/** Minutes since midnight for "HH:mm" or "HH:mm:ss". */
export function toMinutes(time: string): number {
  const [h = "0", m = "0"] = time.split(":");
  return Number(h) * 60 + Number(m);
}

export function fromMinutes(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** The grid's slot start times, from the server's own opening hours and slot size (never hardcoded). */
export function slotStarts(schedule: Pick<Schemas["SpaSchedule"], "openingTime" | "closingTime" | "slotMinutes">): string[] {
  const out: string[] = [];
  const close = toMinutes(schedule.closingTime);
  for (let t = toMinutes(schedule.openingTime); t + schedule.slotMinutes <= close; t += schedule.slotMinutes) out.push(fromMinutes(t));
  return out;
}

/** An appointment that still holds its slot. COMPLETED keeps occupying it (V43), CANCELLED/NO_SHOW don't. */
export const holdsSlot = (a: Pick<Appointment, "status">) => a.status === "BOOKED" || a.status === "COMPLETED";

/** The appointment occupying `tableId` at slot `start`, if any. */
export function appointmentAt(appointments: Appointment[], tableId: string, start: string): Appointment | undefined {
  const t = toMinutes(start);
  return appointments.find(
    (a) => a.tableId === tableId && holdsSlot(a) && toMinutes(a.startTime) <= t && t < toMinutes(a.startTime) + a.durationMinutes,
  );
}

/**
 * A preview only, like sunset-beach lib/spaAvailability.ts: is this therapist already holding an
 * overlapping slot? The database's exclusion constraints still decide; a 409 is still shown.
 */
export function therapistBusy(appointments: Appointment[], therapistUserId: string, start: string, durationMinutes: number): Appointment | undefined {
  const s = toMinutes(start);
  const e = s + durationMinutes;
  return appointments.find(
    (a) => a.therapistUserId === therapistUserId && holdsSlot(a) && toMinutes(a.startTime) < e && s < toMinutes(a.startTime) + a.durationMinutes,
  );
}

/** Would a treatment of this length starting here run into the next appointment on the table, or past closing? */
export function fitsOnTable(appointments: Appointment[], tableId: string, start: string, durationMinutes: number, closingTime: string): boolean {
  const s = toMinutes(start);
  const e = s + durationMinutes;
  if (e > toMinutes(closingTime)) return false;
  return !appointments.some((a) => a.tableId === tableId && holdsSlot(a) && toMinutes(a.startTime) < e && s < toMinutes(a.startTime) + a.durationMinutes);
}
