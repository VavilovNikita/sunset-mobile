/** "1500", "1,500.50" -> 1500.5; null if it isn't a plain non-negative amount with at most 2 decimals. */
export function parseCashAmount(input: string): number | null {
  const trimmed = input.trim().replace(/,/g, "");
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(trimmed)) return null;
  return Number(trimmed);
}
