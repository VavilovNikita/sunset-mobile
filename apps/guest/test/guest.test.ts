import { describe, expect, it } from "vitest";
import { addToCart, cartCount, removeFromCart } from "../src/lib/cart";
import { orderSessionState, parseOrderQr } from "../src/lib/orderQr";
import { canOrderRoomService, validateGuestDetails, validateStay } from "../src/lib/stay";

const origins = ["https://sunsetsamui.com"];

describe("table QR codes", () => {
  it("reads the code the staff POS prints", () => {
    expect(parseOrderQr("https://sunsetsamui.com/order/abc-123?t=tok_EN", origins)).toEqual({ ok: true, qr: { orderId: "abc-123", token: "tok_EN" } });
  });
  it("refuses a code from anywhere else, so our token is never sent for it", () => {
    expect(parseOrderQr("https://evil.example/order/abc?t=x", origins).ok).toBe(false);
    expect(parseOrderQr("http://sunsetsamui.com/order/abc?t=x", origins).ok).toBe(false);
  });
  it("refuses anything that isn't an order code", () => {
    expect(parseOrderQr("hello", origins).ok).toBe(false);
    expect(parseOrderQr("https://sunsetsamui.com/order/abc", origins).ok).toBe(false);
    expect(parseOrderQr("https://sunsetsamui.com/rooms?t=x", origins).ok).toBe(false);
  });
});

describe("QR order session expiry", () => {
  it("ends for good on 404 - the order was paid, cancelled, or the code was never valid", () => {
    expect(orderSessionState({ ok: false, status: 404 })).toBe("ended");
  });
  it("survives a dropped connection, a server error, or rate limiting", () => {
    expect(orderSessionState({ ok: false, status: 0 })).toBe("unavailable");
    expect(orderSessionState({ ok: false, status: 503 })).toBe("unavailable");
    expect(orderSessionState({ ok: false, status: 429 })).toBe("unavailable");
    expect(orderSessionState({ ok: true })).toBe("active");
  });
});

describe("room service gate", () => {
  it("only while checked in", () => {
    expect(canOrderRoomService({ occupancyStatus: "CHECKED_IN", status: "CONFIRMED" })).toBe(true);
    expect(canOrderRoomService({ occupancyStatus: "EXPECTED", status: "PAID" })).toBe(false);
    expect(canOrderRoomService({ occupancyStatus: "CHECKED_OUT", status: "PAID" })).toBe(false);
  });
});

describe("cart", () => {
  it("counts items but never prices them", () => {
    let cart = addToCart([], "a");
    cart = addToCart(cart, "a");
    cart = addToCart(cart, "b");
    expect(cartCount(cart)).toBe(3);
    expect(cart.every((l) => Object.keys(l).sort().join() === "menuItemId,quantity")).toBe(true);
    expect(removeFromCart(removeFromCart(cart, "b"), "a")).toEqual([{ menuItemId: "a", quantity: 1 }]);
  });
});

describe("booking form checks", () => {
  it("dates", () => {
    expect(validateStay("2026-10-05", "2026-10-07", "2026-10-04")).toBeNull();
    expect(validateStay("2026-10-03", "2026-10-07", "2026-10-04")).not.toBeNull();
    expect(validateStay("2026-10-05", "2026-10-05", "2026-10-04")).not.toBeNull();
  });
  it("guest details", () => {
    const ok = { name: "Ann", email: "ann@example.com", phone: "+66 1", adults: 2, children: 0 };
    expect(validateGuestDetails(ok, 2)).toBeNull();
    expect(validateGuestDetails({ ...ok, children: 1 }, 2)).toContain("sleeps 2");
    expect(validateGuestDetails({ ...ok, email: "nope" }, 2)).not.toBeNull();
  });
});

import { resetTokenFrom } from "../src/lib/resetLink";

describe("pasted reset link", () => {
  it("takes the token from the emailed link or a bare token", () => {
    expect(resetTokenFrom("https://sunsetsamui.com/guest/reset-password?token=AbC_def-1234567890xyz")).toBe("AbC_def-1234567890xyz");
    expect(resetTokenFrom("AbC_def-1234567890xyz")).toBe("AbC_def-1234567890xyz");
    expect(resetTokenFrom("hello")).toBeNull();
    expect(resetTokenFrom("")).toBeNull();
  });
});
