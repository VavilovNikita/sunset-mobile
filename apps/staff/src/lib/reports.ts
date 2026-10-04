import { addDays } from "@sunset/core";

export type YearMonth = { year: number; month: number };

const pad = (n: number) => String(n).padStart(2, "0");

/** First and last night (inclusive date keys) of a calendar month - the reports' from/to. */
export function monthRange({ year, month }: YearMonth): { from: string; to: string } {
  const from = `${year}-${pad(month)}-01`;
  const next = month === 12 ? `${year + 1}-01-01` : `${year}-${pad(month + 1)}-01`;
  return { from, to: addDays(next, -1) };
}

export function shiftMonth({ year, month }: YearMonth, delta: number): YearMonth {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function monthOf(dateKey: string): YearMonth {
  return { year: Number(dateKey.slice(0, 4)), month: Number(dateKey.slice(5, 7)) };
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const monthLabel = ({ year, month }: YearMonth) => `${MONTHS[month - 1]} ${year}`;

/** A server percentage string as shown ("71.43%"), or a dash when the server had nothing to divide by. */
export const percent = (value: string | null | undefined) => (value == null ? "—" : `${value}%`);

/** An audit row's actor: a null role is a system sweep, not missing data (sunset-beach CLAUDE.md). */
export const actorLabel = (email: string, role: string | null | undefined) => (role ? `${email} (${role.toLowerCase()})` : "System");
