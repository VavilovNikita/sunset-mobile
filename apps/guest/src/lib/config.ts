// Baked in at build time; no production default (see .env.example).
export const API_BASE_URL: string | null = process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "") || null;

/**
 * The public site's origin. Table QR codes printed by the staff POS encode
 * `{site origin}/order/{orderId}?t={token}`; a code from any other origin is refused rather than
 * having its token sent anywhere. Also where the site's own bundled room photos live.
 */
export const SITE_ORIGIN: string | null = process.env.EXPO_PUBLIC_SITE_ORIGIN?.trim().replace(/\/+$/, "") || null;

/**
 * Room.images mixes the site's bundled photos (`/images/...`, served by the website) and
 * staff uploads (`/uploads/...`, served by the API) - same split as sunset-beach lib/backend.ts.
 */
export function roomImageUrl(path: string | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  if (path.startsWith("/uploads/")) return API_BASE_URL ? `${API_BASE_URL}${path}` : null;
  return SITE_ORIGIN ? `${SITE_ORIGIN}${path}` : null;
}
