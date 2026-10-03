// The backend explains a rejection either as ErrorMessage `{ error: "text" }` or as ValidationError
// `{ error: { formErrors, fieldErrors } }` (see openapi.yaml). Surface that text as-is - the same
// rule sunset-beach's lib/apiError.ts follows - instead of a generic "something went wrong".
export function extractApiError(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object" || !("error" in data)) return fallback;
  const err = (data as { error: unknown }).error;
  if (typeof err === "string" && err.trim()) return err;
  if (err && typeof err === "object") {
    const { formErrors, fieldErrors } = err as { formErrors?: string[]; fieldErrors?: Record<string, string[] | undefined> };
    const messages = [...(formErrors ?? []), ...Object.values(fieldErrors ?? {}).flatMap((m) => m ?? [])];
    if (messages.length > 0) return messages.join(" ");
  }
  return fallback;
}

/**
 * What every screen gets back: data, or a message it can show next to the control that failed.
 * `status: 0` is a connection failure (no response at all), never confused with a server rejection.
 */
export type ApiResult<T> = { ok: true; data: T; status: number } | { ok: false; error: string; status: number };

export const NO_CONNECTION = "No connection — check the network and try again.";

/**
 * Turns an openapi-fetch call into an ApiResult. Usage:
 *   const r = await call(api.GET("/tables"), "Could not load tables.");
 */
export async function call<T>(
  pending: Promise<{ data?: T; error?: unknown; response: Response }>,
  fallback: string,
): Promise<ApiResult<T>> {
  let result: { data?: T; error?: unknown; response: Response };
  try {
    result = await pending;
  } catch (e) {
    if (e instanceof ScopeViolation) throw e;
    return { ok: false, error: NO_CONNECTION, status: 0 };
  }
  const { data, error, response } = result;
  if (!response.ok) return { ok: false, error: extractApiError(error, fallback), status: response.status };
  return { ok: true, data: data as T, status: response.status };
}

/** Thrown (never returned) when code tries to call an endpoint outside its client's audience. A bug, not a runtime condition. */
export class ScopeViolation extends Error {
  constructor(audience: string, method: string, path: string) {
    super(`The ${audience} client may not call ${method} ${path}`);
    this.name = "ScopeViolation";
  }
}
