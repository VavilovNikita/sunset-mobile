/**
 * Form checks for the settings screens, matching what the API's input schemas accept (MenuItemInput
 * price >= 0, TableInput capacity 1-50, UserCreateInput/ResetPasswordInput password 8-200, block
 * dates inclusive), so a mistake shows next to its field instead of as a server 400.
 */

/** A price as typed ("1,500.50") -> the number the API takes, or null. Zero is allowed (a free item). */
export function parsePrice(input: string): number | null {
  const t = input.trim().replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Number(t);
}

export function parseWhole(input: string, min: number, max: number): number | null {
  const t = input.trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n >= min && n <= max ? n : null;
}

export type MenuItemDraft = { name: string; category: string; price: string; department: "KITCHEN" | "BAR" | "SPA"; durationMinutes: string };

export function validateMenuItem(d: MenuItemDraft): Partial<Record<keyof MenuItemDraft, string>> {
  const e: Partial<Record<keyof MenuItemDraft, string>> = {};
  if (!d.name.trim()) e.name = "Enter a name.";
  if (!d.category.trim()) e.category = "Enter a category (e.g. Mains, Drinks, Massage).";
  if (parsePrice(d.price) === null) e.price = "Enter a price like 250 or 250.50.";
  if (d.department === "SPA" && parseWhole(d.durationMinutes, 1, 600) === null) e.durationMinutes = "A treatment needs its length in minutes.";
  return e;
}

export function validateTable(label: string, capacity: string): string | null {
  if (!label.trim()) return "Enter a table name.";
  if (parseWhole(capacity, 1, 50) === null) return "Seats must be 1 to 50.";
  return null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * A new user. An employee can exist without a login (sunset UserService#create) - email and
 * password come together or not at all.
 */
export function validateNewUser(name: string, email: string, password: string): string | null {
  if (!name.trim()) return "Enter a name.";
  const hasEmail = !!email.trim();
  if (hasEmail && !EMAIL_RE.test(email.trim())) return "Enter a valid email, or leave it blank for staff who don't sign in.";
  if (hasEmail !== !!password) return "A login needs both an email and a password.";
  if (password && (password.length < 8 || password.length > 200)) return "The password must be 8 to 200 characters.";
  return null;
}

export function validatePassword(password: string): string | null {
  return password.length >= 8 && password.length <= 200 ? null : "The password must be 8 to 200 characters.";
}

/** Block and rate ranges are inclusive on both ends. */
export function validateInclusiveRange(from: string, to: string): string | null {
  return from <= to ? null : "The last day can't be before the first.";
}
