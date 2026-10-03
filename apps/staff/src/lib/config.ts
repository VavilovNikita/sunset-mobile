// Baked in at build time. No production default on purpose: a dev build pointed at nothing should
// say so, not quietly talk to the live hotel (see .env.example).
export const API_BASE_URL: string | null = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || null;

/** Same as the web /pos: a phone that changes hands signs itself out after 30 minutes untouched. */
export const IDLE_LIMIT_MS = 30 * 60 * 1000;
