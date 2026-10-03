/**
 * End-to-end smoke run of both scoped clients against a REAL backend (never production): staff
 * login, table + menu item + shift, an order from first item to cash close, the dine-in QR session
 * over the guest client until the server ends it, the public quote, and the guest scope refusing a
 * staff path. It WRITES data, so it only runs against localhost / a private address and only with
 * SMOKE_ALLOW_WRITES=1.
 *
 *   SMOKE_API_BASE_URL=http://127.0.0.1:8080/api SMOKE_EMAIL=… SMOKE_PASSWORD=… SMOKE_ALLOW_WRITES=1 npm run smoke
 */
import { call, ScopeViolation } from "../src/errors";
import { createGuestClient } from "../src/guest";
import { createStaffClient } from "../src/staff";

const base = process.env.SMOKE_API_BASE_URL ?? "";
const host = (() => {
  try {
    return new URL(base).hostname;
  } catch {
    return "";
  }
})();
if (!/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) || process.env.SMOKE_ALLOW_WRITES !== "1") {
  console.error("Refusing: SMOKE_API_BASE_URL must be a local/private address and SMOKE_ALLOW_WRITES=1 must be set.");
  process.exit(2);
}

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok || detail === undefined ? "" : ` -> ${JSON.stringify(detail)}`}`);
  if (!ok) failures += 1;
}
function must<T>(name: string, r: { ok: true; data: T } | { ok: false; error: string; status: number }): T {
  check(name, r.ok, r.ok ? undefined : r);
  if (!r.ok) throw new Error(`${name} failed`);
  return r.data;
}

async function main() {
  let staffToken: string | null = null;
  let unauthorized = 0;
  const staff = createStaffClient({ baseUrl: base, getToken: async () => staffToken, onUnauthorized: () => void (unauthorized += 1) });
  const guest = createGuestClient({ baseUrl: base, getToken: async () => null, onUnauthorized: () => undefined });
  const tag = Date.now().toString(36);

  const login = must("staff login", await call(staff.POST("/auth/login", { body: { email: process.env.SMOKE_EMAIL ?? "", password: process.env.SMOKE_PASSWORD ?? "" } }), "login"));
  staffToken = login.token;
  const me = must("GET /auth/me", await call(staff.GET("/auth/me"), "me"));
  check("me is the logged-in user", me.id === login.user.id);

  const table = must("create table", await call(staff.POST("/tables", { body: { zone: "RESTAURANT", label: `S${tag}`, capacity: 2 } }), "table"));
  const item = must(
    "create menu item",
    await call(staff.POST("/menu", { body: { name: `Smoke soda ${tag}`, description: "", category: "Drinks", department: "BAR", price: 45.5, isAvailable: true } }), "menu"),
  );
  const shift = must("open shift", await call(staff.POST("/shifts/open", { body: { openingCashFloat: 1000 } }), "shift"));

  const order = must("create order with first item", await call(staff.POST("/orders", { body: { tableId: table.id, items: [{ menuItemId: item.id, quantity: 2 }] } }), "order"));
  check("server computed the total", order.total === "91.00", order.total);
  check("new order carries a QR token", typeof order.guestAccessToken === "string");

  // Dine-in QR over the guest client - exactly what the guest app does after scanning.
  const token = order.guestAccessToken ?? "";
  const view = must("guest reads the order by QR token", await call(guest.GET("/public/orders/{id}", { params: { path: { id: order.id }, query: { token } } }), "view"));
  check("guest view total is the server's", view.total === "91.00", view.total);
  const added = must(
    "guest adds an item by QR token",
    await call(guest.POST("/public/orders/{id}/items", { params: { path: { id: order.id }, query: { token } }, body: [{ menuItemId: item.id, quantity: 1 }] }), "add"),
  );
  check("total after the guest's add", added.total === "136.50", added.total);
  const wrong = await call(guest.GET("/public/orders/{id}", { params: { path: { id: order.id }, query: { token: "wrong" } } }), "x");
  check("a wrong token is a plain 404", !wrong.ok && wrong.status === 404, wrong);

  const sent = must("send to kitchen", await call(staff.PATCH("/orders/{id}", { params: { path: { id: order.id } }, body: { status: "SENT" } }), "send"));
  check("order is SENT", sent.status === "SENT");
  const closed = must("close with cash", await call(staff.POST("/orders/{id}/close", { params: { path: { id: order.id } }, body: { method: "CASH", amountTendered: "200.00" } }), "close"));
  check("order is PAID", closed.status === "PAID");

  const after = await call(guest.GET("/public/orders/{id}", { params: { path: { id: order.id }, query: { token } } }), "x");
  check("QR session ends once the order is paid (404)", !after.ok && after.status === 404, after);

  must("restaurant map", await call(staff.GET("/restaurant-map"), "map"));
  must("print queue (FAILED)", await call(staff.GET("/print-jobs", { params: { query: { status: "FAILED" } } }), "jobs"));
  must("room units", await call(staff.GET("/room-units"), "units"));
  must("spa schedule", await call(staff.GET("/spa-appointments", { params: { query: { date: "2096-01-01" } } }), "spa"));
  must("my roster", await call(staff.GET("/roster/me", { params: { query: { year: 2096, month: 1 } } }), "roster"));
  must("close shift", await call(staff.POST("/shifts/{id}/close", { params: { path: { id: shift.id } }, body: { closingCashCounted: 1136.5 } }), "close shift"));

  const room = must("create room", await call(staff.POST("/rooms", { body: { name: `Smoke room ${tag}`, description: "Smoke-test room", capacity: 2, basePrice: 1500 } }), "room"));
  must("create room unit", await call(staff.POST("/room-units", { body: { roomId: room.id, label: `SU${tag}` } }), "unit"));
  const quote = must(
    "guest quote",
    await call(guest.GET("/public/rooms/{id}/quote", { params: { path: { id: room.id }, query: { checkIn: "2096-05-01", checkOut: "2096-05-03" } } }), "quote"),
  );
  check("quote is the server's figure", quote.totalPrice === "3000.00" && quote.nights === 2 && quote.available, quote);

  let refused = false;
  try {
    await (guest.GET as unknown as (p: string, i: unknown) => Promise<unknown>)("/bookings/{id}/folio", { params: { path: { id: "x" } } });
  } catch (e) {
    refused = e instanceof ScopeViolation;
  }
  check("guest client refuses a staff route before sending", refused);
  check("no unexpected 401s", unauthorized === 0, unauthorized);

  console.log(failures === 0 ? "\nSMOKE OK" : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
