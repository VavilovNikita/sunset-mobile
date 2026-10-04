// Money is always a server-computed decimal string ("1500.00"). This module only *displays* such
// strings - it never adds, multiplies or totals anything (see sunset's CLAUDE.md "Money": the
// server computes every amount). The single deliberate exception is cashChange below.

const DECIMAL = /^-?\d+(\.\d{1,2})?$/;

/** "1500.00" -> "฿1,500.00". Anything that isn't a decimal string is shown as-is, not guessed at. */
export function formatBaht(amount: string | null | undefined): string {
  if (amount == null) return "—";
  const trimmed = amount.trim();
  if (!DECIMAL.test(trimmed)) return trimmed;
  const negative = trimmed.startsWith("-");
  const [whole = "0", fraction = ""] = trimmed.replace("-", "").split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}฿${grouped}.${fraction.padEnd(2, "0")}`;
}

function toSatang(input: string): number | null {
  const trimmed = input.trim().replace(/,/g, "");
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(trimmed)) return null;
  const [whole = "0", fraction = ""] = trimmed.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

function fromSatang(satang: number): string {
  return `${Math.floor(satang / 100)}.${String(satang % 100).padStart(2, "0")}`;
}

export type CashChange =
  | { ok: true; tendered: string; change: string }
  | { ok: false; reason: "invalid" | "insufficient"; short?: string };

/**
 * The one client-computed figure (same exception as sunset-beach's lib/cashTender.ts): notes in
 * the cashier's hand minus the server's Order.total, shown before closing. Integer satang, no
 * floats. The close sends only `amountTendered`; the server re-checks it and charges exactly the total.
 */
export function cashChange(orderTotal: string, tenderedInput: string): CashChange {
  const total = toSatang(orderTotal);
  const tendered = toSatang(tenderedInput);
  if (total === null || tendered === null) return { ok: false, reason: "invalid" };
  if (tendered < total) return { ok: false, reason: "insufficient", short: fromSatang(total - tendered) };
  return { ok: true, tendered: fromSatang(tendered), change: fromSatang(tendered - total) };
}

/**
 * Whether a server amount is above zero - for gating a badge or a warning on what is owed ("gate on
 * amounts, not counts", sunset-beach CLAUDE.md). A comparison only; never used to compute a figure.
 */
export function isPositiveAmount(amount: string | null | undefined): boolean {
  if (!amount) return false;
  const n = Number(amount);
  return Number.isFinite(n) && n > 0;
}
