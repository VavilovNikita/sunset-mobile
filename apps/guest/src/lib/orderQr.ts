/**
 * Dine-in QR ordering, same contract as the web flow (sunset-beach GuestOrderQrButton /
 * GuestOrderClient): the code encodes `{site origin}/order/{orderId}?t={guestAccessToken}`, and the
 * server answers 404 for every failure - unknown order, wrong token, or an order that has left
 * OPEN/SENT (paid or cancelled) - so a guessing attempt learns nothing.
 */
export type OrderQr = { orderId: string; token: string };

export function parseOrderQr(text: string, allowedOrigins: string[]): { ok: true; qr: OrderQr } | { ok: false; reason: string } {
  let url: URL;
  try {
    url = new URL(text.trim());
  } catch {
    return { ok: false, reason: "That isn't a Sunset Beach table code." };
  }
  if (!allowedOrigins.includes(url.origin)) return { ok: false, reason: "That code isn't from The Sunset Beach." };
  const match = /^\/order\/([^/]+)\/?$/.exec(url.pathname);
  const token = url.searchParams.get("t");
  if (!match?.[1] || !token) return { ok: false, reason: "That isn't a table ordering code." };
  return { ok: true, qr: { orderId: decodeURIComponent(match[1]), token } };
}

export type OrderSessionState = "active" | "ended" | "unavailable";

/**
 * What a QR order session's latest response means. 404 = the order is closed (or the code was
 * never valid) - the session is over for good and the stored code is forgotten. Anything else
 * that fails (no signal, 5xx, 429) is temporary and keeps the session.
 */
export function orderSessionState(result: { ok: true } | { ok: false; status: number }): OrderSessionState {
  if (result.ok) return "active";
  return result.status === 404 ? "ended" : "unavailable";
}

export const ENDED_MESSAGE = "This table's order is closed. Ask a member of staff for a new code to order again.";
