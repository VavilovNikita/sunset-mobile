import { describe, expect, it, vi } from "vitest";
import { call, ScopeViolation } from "../src/errors";
import { createGuestClient, guestScope } from "../src/guest";
import { createStaffClient, staffScope } from "../src/staff";

type Seen = { method: string; url: string; auth: string | null };

function fakeFetch(status = 200, body: unknown = {}) {
  const seen: Seen[] = [];
  const fetch = vi.fn(async (request: Request) => {
    seen.push({ method: request.method, url: request.url, auth: request.headers.get("Authorization") });
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  });
  return { fetch, seen };
}

const base = "https://api.example.test/api";

describe("guest scope", () => {
  it("allows the guest web flow's endpoints only", () => {
    expect(guestScope.allows("GET", "/public/rooms/{id}/quote")).toBe(true);
    expect(guestScope.allows("POST", "/public/orders/{id}/items")).toBe(true);
    expect(guestScope.allows("GET", "/guest/bookings")).toBe(true);
    expect(guestScope.allows("POST", "/guest-auth/reset-password")).toBe(true);
    expect(guestScope.allows("POST", "/bookings")).toBe(true);
  });

  it("refuses staff routes, including the ones the backend currently lets a guest token through (audit H1)", () => {
    for (const path of ["/bookings/{id}/folio", "/bookings/{id}/pos-orders", "/menu", "/tables", "/maintenance-tasks", "/auth/me", "/shift-codes"]) {
      expect(guestScope.allows("GET", path)).toBe(false);
    }
    expect(guestScope.allows("GET", "/bookings")).toBe(false);
  });

  it("throws before any request leaves the device", async () => {
    const { fetch } = fakeFetch();
    const api = createGuestClient({ baseUrl: base, fetch, getToken: async () => "guest-token", onUnauthorized: () => {} });
    // Not expressible without a cast - GuestPaths has no such key, which is the compile-time half.
    const get = api.GET as unknown as (path: string, init?: unknown) => Promise<unknown>;
    await expect(get("/bookings/{id}/folio", { params: { path: { id: "b1" } } })).rejects.toBeInstanceOf(ScopeViolation);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends the guest token to the guest's own account routes only", async () => {
    const { fetch, seen } = fakeFetch(200, []);
    const api = createGuestClient({ baseUrl: base, fetch, getToken: async () => "guest-token", onUnauthorized: () => {} });
    await api.GET("/guest/bookings");
    await api.GET("/public/rooms");
    expect(seen[0]).toMatchObject({ url: `${base}/guest/bookings`, auth: "Bearer guest-token" });
    expect(seen[1]).toMatchObject({ url: `${base}/public/rooms`, auth: null });
  });

  it("a 401 on a token-bearing call means sign in again; a 401 elsewhere doesn't", async () => {
    const onUnauthorized = vi.fn();
    const { fetch } = fakeFetch(401, { error: "Invalid email or password" });
    const api = createGuestClient({ baseUrl: base, fetch, getToken: async () => "stale", onUnauthorized });
    await api.POST("/guest-auth/login", { body: { email: "a@b.c", password: "wrong-pass" } });
    expect(onUnauthorized).not.toHaveBeenCalled();
    await api.GET("/guest/me");
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});

describe("staff scope", () => {
  it("never calls guest-account or machine routes", () => {
    expect(staffScope.allows("GET", "/guest/me")).toBe(false);
    expect(staffScope.allows("POST", "/guest-auth/login")).toBe(false);
    expect(staffScope.allows("POST", "/integrations/siteminder/reservations")).toBe(false);
    expect(staffScope.allows("GET", "/tables")).toBe(true);
  });

  it("attaches the staff token and reports a revoked one", async () => {
    const onUnauthorized = vi.fn();
    const { fetch, seen } = fakeFetch(401, { error: "Unauthorized" });
    const api = createStaffClient({ baseUrl: `${base}/`, fetch, getToken: async () => "staff-token", onUnauthorized });
    const result = await call(api.GET("/tables"), "Could not load tables.");
    expect(seen[0]).toMatchObject({ url: `${base}/tables`, auth: "Bearer staff-token" });
    expect(result).toEqual({ ok: false, error: "Unauthorized", status: 401 });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});

describe("call()", () => {
  it("separates a dropped connection from a server rejection", async () => {
    const api = createStaffClient({
      baseUrl: base,
      fetch: async () => {
        throw new TypeError("Network request failed");
      },
      getToken: async () => null,
      onUnauthorized: () => {},
    });
    expect(await call(api.GET("/tables"), "x")).toEqual({ ok: false, error: "No connection — check the network and try again.", status: 0 });
  });

  it("surfaces the server's own validation text", async () => {
    const { fetch } = fakeFetch(400, { error: { formErrors: [], fieldErrors: { checkOut: ["checkIn must be before checkOut"] } } });
    const api = createGuestClient({ baseUrl: base, fetch, getToken: async () => null, onUnauthorized: () => {} });
    const r = await call(api.GET("/public/rooms/{id}/quote", { params: { path: { id: "r" }, query: { checkIn: "2026-01-02", checkOut: "2026-01-01" } } }), "x");
    expect(r).toEqual({ ok: false, error: "checkIn must be before checkOut", status: 400 });
  });
});
