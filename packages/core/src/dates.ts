// Dates of stay are date-only keys ("YYYY-MM-DD") everywhere in the API; timestamps are ISO
// instants. Same rules as sunset-beach's lib/hotelDate.ts and lib/formatDate.ts: "today" is the
// hotel's own calendar day (Asia/Bangkok), never the phone's zone or UTC, and a stay date is never
// parsed into local time (that shifts it by a day).

export const HOTEL_TIME_ZONE = "Asia/Bangkok";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The hotel's calendar date at `now`, as a YYYY-MM-DD key. */
export function hotelDateKey(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: HOTEL_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function isDateKey(value: string): boolean {
  const m = KEY.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

/** Calendar arithmetic on a date key, in UTC so no zone or DST can move it. */
export function addDays(key: string, days: number): string {
  const m = KEY.exec(key);
  if (!m) throw new Error(`Not a date key: ${key}`);
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days));
  return d.toISOString().slice(0, 10);
}

/** "3 Oct 2026" for a stay date. */
export function formatDate(key: string): string {
  const m = KEY.exec(key.slice(0, 10));
  if (!m) return key;
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

export function formatDateRange(from: string, to: string): string {
  return `${formatDate(from)} → ${formatDate(to)}`;
}

/** "3 Oct 2026, 14:05" for a timestamp, always in hotel time whatever offset it arrives with. */
export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: HOTEL_TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${Number(get("day"))} ${MONTHS[Number(get("month")) - 1]} ${get("year")}, ${get("hour")}:${get("minute")}`;
}

/** "HH:mm" from the API's "HH:mm" or "HH:mm:ss" local times. */
export function formatClock(time: string): string {
  return time.slice(0, 5);
}
