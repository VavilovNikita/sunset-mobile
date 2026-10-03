import { describe, it } from "vitest";
import type { GuestClient } from "../src/guest";
import type { StaffClient } from "../src/staff";

// Compile-time half of the scope check: `npm run typecheck` fails if any of these become legal.
// The functions are never called.
describe("scoped path types", () => {
  it("compiles", () => {});
});

export function guestCannotNameStaffPaths(api: GuestClient) {
  // @ts-expect-error - folio is a staff route
  void api.GET("/bookings/{id}/folio", { params: { path: { id: "x" } } });
  // @ts-expect-error - GET /bookings is the staff list
  void api.GET("/bookings", {});
  // @ts-expect-error - the staff menu (the guest menu is /public/menu)
  void api.GET("/menu");
}

export function staffCannotNameGuestPaths(api: StaffClient) {
  // @ts-expect-error - guest account route
  void api.GET("/guest/me");
}
