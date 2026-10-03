import type { components, paths } from "./schema";
import { createScopedClient, type Scope, type ScopedClientOptions } from "./transport";

// Guest-account routes, guest-account auth, and the SiteMinder machine endpoint are not for staff:
// a staff token is never sent to them, and the staff app never links code that calls them.
type ExcludedPrefix = `/guest/${string}` | `/guest-auth/${string}` | `/integrations/${string}`;
export type StaffPaths = Omit<paths, Extract<keyof paths, ExcludedPrefix>>;

const EXCLUDED = ["/guest/", "/guest-auth/", "/integrations/"];

export const staffScope: Scope = {
  audience: "staff",
  allows: (_method, path) => !EXCLUDED.some((prefix) => path.startsWith(prefix)),
  sendsToken: () => true,
};

export function createStaffClient(options: ScopedClientOptions) {
  return createScopedClient<StaffPaths>(staffScope, options);
}

export type StaffClient = ReturnType<typeof createStaffClient>;
export type Schemas = components["schemas"];
