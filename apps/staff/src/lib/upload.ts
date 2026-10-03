import { extractApiError, NO_CONNECTION, type ApiResult } from "@sunset/api-client";
import type { Schemas } from "@sunset/api-client/staff";
import { API_BASE_URL } from "./config";

export type PhotoFile = { uri: string; name: string; type: string };

/**
 * POST /maintenance-tasks is multipart (roomUnitId, description, repeated `photos`). Sent with
 * React Native's own fetch + FormData file parts ({ uri, name, type }), the path RN's networking
 * layer streams from disk - the typed client builds a WHATWG Request first, which is not
 * guaranteed to carry RN file parts on every platform. The response is still the generated type.
 */
export async function createMaintenanceTask(
  input: { roomUnitId: string; description: string; photos: PhotoFile[] },
  authHeaders: Record<string, string>,
  onUnauthorized: () => void,
): Promise<ApiResult<Schemas["MaintenanceTask"]>> {
  const form = new FormData();
  form.append("roomUnitId", input.roomUnitId);
  form.append("description", input.description);
  for (const photo of input.photos) {
    // React Native's FormData accepts a file descriptor object here.
    form.append("photos", photo as unknown as Blob);
  }
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/maintenance-tasks`, { method: "POST", headers: authHeaders, body: form });
  } catch {
    return { ok: false, error: NO_CONNECTION, status: 0 };
  }
  const body: unknown = await response.json().catch(() => null);
  if (response.status === 401) onUnauthorized();
  if (!response.ok) return { ok: false, error: extractApiError(body, "Could not report the problem."), status: response.status };
  return { ok: true, data: body as Schemas["MaintenanceTask"], status: response.status };
}
