import type { Schemas } from "@sunset/api-client/staff";

type MenuItem = Schemas["MenuItem"];
type Zone = Schemas["Zone"];
type Order = Schemas["Order"];
type Booking = Schemas["Booking"];

/** Same rule as sunset-beach lib/posMenu.ts: a restaurant/bar table never sees spa treatments, a spa table only sees them. */
export function menuForOrder(menu: MenuItem[], tableZone: Zone | null): MenuItem[] {
  const available = menu.filter((m) => m.isAvailable);
  if (tableZone === "SPA") return available.filter((m) => m.department === "SPA");
  if (tableZone !== null) return available.filter((m) => m.department !== "SPA");
  return available;
}

export function menuCategories(menu: MenuItem[]): string[] {
  return [...new Set(menu.map((m) => m.category))].sort((a, b) => a.localeCompare(b));
}

/** A room charge needs a live booking - same as sunset-beach lib/pos/roomCharge.ts. */
export function isChargeableBooking(booking: Pick<Booking, "status">): boolean {
  return booking.status === "CONFIRMED" || booking.status === "PAID";
}

export const isOpenForItems = (order: Pick<Order, "status">) => order.status === "OPEN" || order.status === "SENT";
/** Unsent lines can be changed or removed only while the order itself is OPEN (sunset CLAUDE.md "A sent line is voided, never edited"). */
export const canEditLine = (order: Pick<Order, "status">, line: Pick<Schemas["OrderItem"], "sentAt">) =>
  order.status === "OPEN" && line.sentAt === null;
export const canVoidLine = (order: Pick<Order, "status">, line: Pick<Schemas["OrderItem"], "sentAt">) =>
  isOpenForItems(order) && line.sentAt !== null;
export const isTerminal = (order: Pick<Order, "status">) => order.status === "PAID" || order.status === "CANCELLED";

/** Show an order by its receipt number with the id prefix beside it, never a bare id slice (sunset-beach lib/posOrders.ts). */
export function orderLabel(order: Pick<Order, "number" | "id">): string {
  return `#${order.number} · ${order.id.slice(0, 8)}`;
}

export const VOID_REASON_MIN = 3;
export function validateVoidReason(reason: string): string | null {
  const trimmed = reason.trim();
  if (trimmed.length < VOID_REASON_MIN) return "Say why this item is being voided.";
  if (trimmed.length > 500) return "Keep the reason under 500 characters.";
  return null;
}

type MapTable = Schemas["RestaurantMapTable"];

/** Same as sunset-beach lib/restaurantMapDisplay.ts, so the map and the list can't disagree. */
export type TableAction = { kind: "open"; orderId: string } | { kind: "pick"; orderIds: string[] } | { kind: "start" } | { kind: "none" };

export function tableAction(table: Pick<MapTable, "openOrderIds" | "isActive">): TableAction {
  const [first] = table.openOrderIds;
  if (table.openOrderIds.length > 1) return { kind: "pick", orderIds: table.openOrderIds };
  if (first) return { kind: "open", orderId: first };
  if (!table.isActive) return { kind: "none" };
  return { kind: "start" };
}

export function tableStateLabel(table: Pick<MapTable, "openOrderIds" | "isActive">): string {
  if (!table.isActive) return table.openOrderIds.length > 0 ? "Inactive — has an open order" : "Inactive";
  if (table.openOrderIds.length > 1) return `${table.openOrderIds.length} open orders`;
  if (table.openOrderIds.length === 1) return "Open order";
  return "Free";
}

/** The restaurant floor: every table except the spa's (those live on the spa schedule). */
export function floorTables(tables: MapTable[]): MapTable[] {
  return tables.filter((t) => t.zone !== "SPA" && (t.isActive || t.openOrderIds.length > 0));
}
