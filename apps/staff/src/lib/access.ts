import type { Schemas } from "@sunset/api-client/staff";

export type Role = Schemas["Role"];
export type JobFunction = Schemas["JobFunction"];
export type StaffUser = Pick<Schemas["User"], "id" | "name" | "role" | "functions">;

// ADMIN > MANAGER > CASHIER > WAITER. Explicit ranks, never the enum's position: Role is generated
// from openapi.yaml and reordering it there must not silently invert a comparison (sunset CLAUDE.md).
const RANK: Record<Role, number> = { WAITER: 1, CASHIER: 2, MANAGER: 3, ADMIN: 4 };

export function hasRoleAtLeast(role: Role, minimum: Role): boolean {
  return RANK[role] >= RANK[minimum];
}

/**
 * Everything the app can show, mapped to the rule SecurityConfig enforces for the endpoint behind
 * it. The server still decides - this only hides what a role can't do (sunset-beach CLAUDE.md:
 * "Hide actions a role cannot perform"), and every action shown here has its reads allowed too.
 */
export type Capability =
  | "pos.use" // tables, orders, menu, send, add/edit unsent lines - WAITER+
  | "pos.takePayment" // POST /orders/{id}/close - CASHIER+
  | "pos.voidSentItem" // POST /orders/{id}/items/{itemId}/void - MANAGER+
  | "pos.roomChargeSearch" // GET /bookings - CASHIER+
  | "shift.manage" // /shifts/** - CASHIER+
  | "print.queue" // /print-jobs/** - WAITER+
  | "print.printers" // GET /printers (per-printer health) - MANAGER+
  | "housekeeping.view" // GET /room-units - WAITER+
  | "housekeeping.change" // PATCH /room-units/{id}/housekeeping - CASHIER+
  | "maintenance.view" // GET /maintenance-tasks - any staff
  | "maintenance.report" // POST /maintenance-tasks - any staff
  | "maintenance.changeStatus" // PATCH .../status - ENGINEER function, or MANAGER+
  | "spa.use" // /spa-appointments/** - CASHIER+
  | "roster.mine" // GET /roster/me - any staff
  | "attendance.today"; // GET /attendance/today - MANAGER+

export function can(user: StaffUser, capability: Capability): boolean {
  switch (capability) {
    case "pos.use":
    case "print.queue":
    case "housekeeping.view":
    case "maintenance.view":
    case "maintenance.report":
    case "roster.mine":
      return hasRoleAtLeast(user.role, "WAITER");
    case "pos.takePayment":
    case "pos.roomChargeSearch":
    case "shift.manage":
    case "housekeeping.change":
    case "spa.use":
      return hasRoleAtLeast(user.role, "CASHIER");
    case "pos.voidSentItem":
    case "print.printers":
    case "attendance.today":
      return hasRoleAtLeast(user.role, "MANAGER");
    case "maintenance.changeStatus":
      // A job function is its own axis, never part of the ladder: a WAITER who is also an
      // ENGINEER may close a task; a MANAGER may as an explicit fallback (SecurityConfig#engineerOrManagerPlus).
      return user.functions.includes("ENGINEER") || hasRoleAtLeast(user.role, "MANAGER");
  }
}

export type HomeEntry = { href: string; label: string; capability: Capability };

/** The home menu, in the order the floor uses it. A role never sees an entry it can't open. */
export const HOME_ENTRIES: HomeEntry[] = [
  { href: "/pos", label: "Tables & orders", capability: "pos.use" },
  { href: "/shift", label: "Cash shift", capability: "shift.manage" },
  { href: "/print", label: "Printing", capability: "print.queue" },
  { href: "/housekeeping", label: "Housekeeping", capability: "housekeeping.view" },
  { href: "/maintenance", label: "Maintenance", capability: "maintenance.view" },
  { href: "/spa", label: "Spa schedule", capability: "spa.use" },
  { href: "/roster", label: "My schedule", capability: "roster.mine" },
];

export function homeEntriesFor(user: StaffUser): HomeEntry[] {
  return HOME_ENTRIES.filter((entry) => can(user, entry.capability));
}
