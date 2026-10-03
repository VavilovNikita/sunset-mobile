import { describe, expectTypeOf, it } from "vitest";
import type { components } from "../src/schema";

type S = components["schemas"];

// Spot checks on the nullability the apps rely on. These come straight from the spec - if the
// spec changes, regeneration changes them, and the apps' typecheck tells us where.
describe("generated nullability", () => {
  it("a room-service order has no opener", () => {
    expectTypeOf<S["Order"]["openedByUserId"]>().toEqualTypeOf<string | null>();
  });
  it("a legacy order has no QR token", () => {
    expectTypeOf<S["Order"]["guestAccessToken"]>().toEqualTypeOf<string | null>();
  });
  it("money is a decimal string, never a number", () => {
    expectTypeOf<S["Order"]["total"]>().toEqualTypeOf<string>();
    expectTypeOf<S["BookingScheduleQuote"]["totalPrice"]>().toEqualTypeOf<string>();
  });
  it("a quote's reason is null when it is available", () => {
    expectTypeOf<S["BookingScheduleQuote"]["reason"]>().toEqualTypeOf<string | null>();
  });
});
