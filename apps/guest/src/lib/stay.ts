import type { Schemas } from "@sunset/api-client/guest";
import { isDateKey } from "@sunset/core";

type GuestBooking = Schemas["GuestBookingView"];

/** Room service is only for a guest who is checked in right now - the server re-checks this on every order. */
export function canOrderRoomService(booking: Pick<GuestBooking, "occupancyStatus" | "status">): boolean {
  return booking.occupancyStatus === "CHECKED_IN" && booking.status !== "CANCELLED";
}

export function stayLabel(booking: Pick<GuestBooking, "status" | "occupancyStatus">): string {
  if (booking.status === "CANCELLED") return "Cancelled";
  if (booking.occupancyStatus === "CHECKED_IN") return "In house";
  if (booking.occupancyStatus === "CHECKED_OUT") return "Stayed";
  if (booking.occupancyStatus === "NO_SHOW") return "Not arrived";
  if (booking.status === "NEW") return "Request received";
  return "Confirmed";
}

export const MAX_STAY_NIGHTS = 90; // the server's own cap on GET /public/rooms/{id}/quote

/** Client-side checks that only save a round trip; the server validates everything again. */
export function validateStay(checkIn: string, checkOut: string, today: string): string | null {
  if (!isDateKey(checkIn) || !isDateKey(checkOut)) return "Pick real dates.";
  if (checkIn < today) return "Check-in can't be in the past.";
  if (checkOut <= checkIn) return "Check-out must be after check-in.";
  return null;
}

export type GuestDetails = { name: string; email: string; phone: string; adults: number; children: number };

export function validateGuestDetails(d: GuestDetails, capacity: number): string | null {
  if (!d.name.trim()) return "Enter the name the booking is under.";
  if (!/^\S+@\S+\.\S+$/.test(d.email.trim())) return "Enter a valid email - we send the confirmation there.";
  if (!d.phone.trim()) return "Enter a phone number.";
  if (d.adults < 1) return "At least one adult.";
  if (d.adults + d.children > capacity) return `This room sleeps ${capacity}.`;
  return null;
}
