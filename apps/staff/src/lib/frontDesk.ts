import type { Schemas } from "@sunset/api-client/staff";

type Booking = Schemas["Booking"];
type BookingStatus = Schemas["BookingStatus"];
type Occupancy = Schemas["OccupancyStatus"];

export const STATUS_LABELS: Record<BookingStatus, string> = { NEW: "New", CONFIRMED: "Confirmed", PAID: "Paid", CANCELLED: "Cancelled" };
export const OCCUPANCY_LABELS: Record<Occupancy, string> = { EXPECTED: "Expected", CHECKED_IN: "In house", CHECKED_OUT: "Checked out", NO_SHOW: "No-show" };

/** Same wording as the web and the night audit ("N days overdue"); the server decides who is overdue. */
export function overdueLabel(overdueDays: number | null | undefined): string | null {
  if (!overdueDays || overdueDays <= 0) return null;
  return overdueDays === 1 ? "1 day overdue" : `${overdueDays} days overdue`;
}

/**
 * For a screen that has a Booking but no server-flagged row: still checked in after checkOut, by the
 * hotel's today. Mirrors sunset-beach lib/overstay.ts#overdueDaysFor - the departure day itself is
 * "due out", not overdue.
 */
export function overdueDaysFor(booking: Pick<Booking, "occupancyStatus" | "status" | "checkOut">, todayKey: string): number {
  if (booking.occupancyStatus !== "CHECKED_IN" || booking.status === "CANCELLED") return 0;
  const checkOut = Date.parse(`${booking.checkOut}T00:00:00Z`);
  const today = Date.parse(`${todayKey}T00:00:00Z`);
  if (Number.isNaN(checkOut) || Number.isNaN(today) || checkOut >= today) return 0;
  return Math.round((today - checkOut) / 86_400_000);
}

export type StayActions = { checkIn: boolean; noShow: boolean; checkOut: boolean; needsRoom: boolean; lateArrival: boolean };

/**
 * Which occupancy actions a booking offers - the web's BookingOccupancyPanel rules, so the two can't
 * disagree: a guest a day late, one who never came, and one past checkOut all have a path.
 */
export function stayActions(booking: Pick<Booking, "status" | "occupancyStatus" | "checkIn" | "roomUnitId">, todayKey: string): StayActions {
  const cancelled = booking.status === "CANCELLED";
  const arrivalDue = booking.checkIn <= todayKey;
  const occ = booking.occupancyStatus;
  return {
    checkIn: !cancelled && arrivalDue && (occ === "EXPECTED" || occ === "NO_SHOW"),
    noShow: !cancelled && arrivalDue && occ === "EXPECTED",
    checkOut: occ === "CHECKED_IN",
    needsRoom: booking.roomUnitId === null,
    lateArrival: !cancelled && occ === "EXPECTED" && booking.checkIn < todayKey,
  };
}

export type StatusAction = { to: BookingStatus; label: string };

/** Status moves offered on the booking card. The server still validates every transition. */
export function statusActions(status: BookingStatus): StatusAction[] {
  switch (status) {
    case "NEW":
      return [
        { to: "CONFIRMED", label: "Confirm" },
        { to: "PAID", label: "Mark paid" },
        { to: "CANCELLED", label: "Cancel booking" },
      ];
    case "CONFIRMED":
      return [
        { to: "PAID", label: "Mark paid" },
        { to: "CANCELLED", label: "Cancel booking" },
      ];
    case "PAID":
      return [
        { to: "CONFIRMED", label: "Undo paid" },
        { to: "CANCELLED", label: "Cancel booking" },
      ];
    case "CANCELLED":
      return [];
  }
}

export const CANCEL_REASON_MIN = 3;
/** The API leaves the reason optional for system paths; staff screens require one (same as the web). */
export function validateCancelReason(reason: string): string | null {
  return reason.trim().length >= CANCEL_REASON_MIN ? null : `Say why it is being cancelled (at least ${CANCEL_REASON_MIN} characters).`;
}

/** A folio payment amount as typed: a positive decimal with at most two places. The server checks the ceiling. */
export function parsePaymentAmount(input: string): string | null {
  const t = input.trim().replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Number(t) > 0 ? t : null;
}
