import type { Schemas } from "@sunset/api-client/staff";

/**
 * The new-booking form's own checks - the same rules as the web's lib/staffBookingForm.ts and what
 * StaffBookingCreateInput accepts (name 2-120, phone 5-40, an email that at least looks like one,
 * at least one adult), so a mistake shows next to its field instead of as a server 400. Dates come
 * from steppers (check-in key + nights >= 1), so they can't be out of order.
 */
export type StaffBookingFields = {
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  channel: Schemas["BookingChannel"] | null;
  adults: number;
  children: number;
};

export type StaffBookingErrors = Partial<Record<keyof StaffBookingFields, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateStaffBooking(f: StaffBookingFields): StaffBookingErrors {
  const e: StaffBookingErrors = {};
  const name = f.guestName.trim();
  if (name.length < 2) e.guestName = "Enter the guest's name (at least 2 characters).";
  else if (name.length > 120) e.guestName = "The guest's name can be at most 120 characters.";
  const email = f.guestEmail.trim();
  if (email && !EMAIL_RE.test(email)) e.guestEmail = "Enter a valid email address, or leave it blank.";
  const phone = f.guestPhone.trim();
  if (phone && (phone.length < 5 || phone.length > 40)) e.guestPhone = "Enter a phone number of 5 to 40 characters, or leave it blank.";
  if (!f.channel) e.channel = "Choose how this booking came in.";
  if (!Number.isInteger(f.adults) || f.adults < 1) e.adults = "At least one adult is required.";
  if (!Number.isInteger(f.children) || f.children < 0) e.children = "Children must be 0 or more.";
  return e;
}

export const CHANNEL_OPTIONS: { value: Schemas["BookingChannel"]; label: string }[] = [
  { value: "WALK_IN", label: "Walk-in" },
  { value: "PHONE", label: "Phone" },
  { value: "DIRECT", label: "Direct" },
  { value: "BOOKING_COM", label: "Booking.com" },
  { value: "AGODA", label: "Agoda" },
  { value: "EXPEDIA", label: "Expedia" },
  { value: "AIRBNB", label: "Airbnb" },
  { value: "OTHER", label: "Other" },
];

/**
 * Calendar segments occupying a night in [from, toExclusive). Occupancy is checkIn <= night < end,
 * where end is checkOut - or, for a guest still checked in past it, `overstayUntil` (the server's
 * OverstayRule; also exclusive), so an overdue guest stays on the calendar.
 */
export function segmentsInRange<T extends { checkIn: string; checkOut: string; overstayUntil?: string }>(rows: T[], from: string, toExclusive: string): T[] {
  const end = (r: T) => (r.overstayUntil && r.overstayUntil > r.checkOut ? r.overstayUntil : r.checkOut);
  return rows.filter((r) => r.checkIn < toExclusive && end(r) > from).sort((a, b) => a.checkIn.localeCompare(b.checkIn));
}
