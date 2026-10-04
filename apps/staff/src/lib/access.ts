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
  | "attendance.today" // GET /attendance/today - MANAGER+
  | "settings.manage" // /menu writes, /tables, /rooms, /room-units, /pricing, /printers, /attendance/**, /roster - MANAGER+
  | "settings.admin" // /users/**, /settings/** - ADMIN only
  | "reports" // GET /reports/manager|occupancy|market-segment|pos-sales-mix|forecast, GET /audit-log - MANAGER+
  | "frontdesk" // GET /bookings/**, check-in/out, folio payments, /guests/**, /property-map, /night-audit, /reports/in-house - CASHIER+

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
    case "frontdesk":
      return hasRoleAtLeast(user.role, "CASHIER");
    case "pos.voidSentItem":
    case "print.printers":
    case "attendance.today":
    case "reports":
    case "settings.manage":
      return hasRoleAtLeast(user.role, "MANAGER");
    case "settings.admin":
      return user.role === "ADMIN";
    case "maintenance.changeStatus":
      // A job function is its own axis, never part of the ladder: a WAITER who is also an
      // ENGINEER may close a task; a MANAGER may as an explicit fallback (SecurityConfig#engineerOrManagerPlus).
      return user.functions.includes("ENGINEER") || hasRoleAtLeast(user.role, "MANAGER");
  }
}

export type HomeEntry = { href: string; label: string; capability: Capability; group: string };

/** The home menu, grouped the way the web admin is. A role never sees an entry (or a group) it can't open. */
export const HOME_ENTRIES: HomeEntry[] = [
  { href: "/today", label: "Today", capability: "frontdesk", group: "Front desk" },
  { href: "/bookings", label: "Bookings", capability: "frontdesk", group: "Front desk" },
  { href: "/calendar", label: "Calendar", capability: "frontdesk", group: "Front desk" },
  { href: "/in-house", label: "In house", capability: "frontdesk", group: "Front desk" },
  { href: "/rooms-map", label: "Rooms", capability: "frontdesk", group: "Front desk" },
  { href: "/guests", label: "Guests", capability: "frontdesk", group: "Front desk" },
  { href: "/night-audit", label: "Night audit", capability: "frontdesk", group: "Front desk" },
  { href: "/housekeeping", label: "Housekeeping", capability: "housekeeping.view", group: "Front desk" },
  { href: "/maintenance", label: "Maintenance", capability: "maintenance.view", group: "Front desk" },
  { href: "/pos", label: "Tables & orders", capability: "pos.use", group: "Restaurant" },
  { href: "/shift", label: "Cash shift", capability: "shift.manage", group: "Restaurant" },
  { href: "/print", label: "Printing", capability: "print.queue", group: "Restaurant" },
  { href: "/spa", label: "Spa schedule", capability: "spa.use", group: "Spa" },
  { href: "/reports", label: "Reports", capability: "reports", group: "Reports" },
  { href: "/history", label: "History", capability: "reports", group: "Reports" },
  { href: "/roster", label: "My schedule", capability: "roster.mine", group: "Staff" },
  { href: "/settings", label: "Settings", capability: "settings.manage", group: "Setup" },
];

export function homeEntriesFor(user: StaffUser): HomeEntry[] {
  return HOME_ENTRIES.filter((entry) => can(user, entry.capability));
}

/** Entries grouped in menu order, empty groups dropped. */
export function homeGroupsFor(user: StaffUser): { title: string; entries: HomeEntry[] }[] {
  const groups: { title: string; entries: HomeEntry[] }[] = [];
  for (const entry of homeEntriesFor(user)) {
    const group = groups.find((g) => g.title === entry.group);
    if (group) group.entries.push(entry);
    else groups.push({ title: entry.group, entries: [entry] });
  }
  return groups;
}
