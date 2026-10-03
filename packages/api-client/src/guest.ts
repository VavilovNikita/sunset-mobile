import type { components, paths } from "./schema";
import { createScopedClient, type Scope, type ScopedClientOptions } from "./transport";

// Exactly what the guest web flow uses: the public site (/public/**, including dine-in QR
// ordering), guest-account auth (/guest-auth/**), the guest's own account (/guest/**), and the
// public booking form (POST /bookings - never GET /bookings, which is a staff list).
type GuestPrefix = `/public/${string}` | `/guest/${string}` | `/guest-auth/${string}`;
export type GuestPaths = Pick<paths, Extract<keyof paths, GuestPrefix>> & {
  "/bookings": Omit<paths["/bookings"], "get"> & { get?: never };
};

const PREFIXES = ["/public/", "/guest/", "/guest-auth/"];

export const guestScope: Scope = {
  audience: "guest",
  allows: (method, path) =>
    PREFIXES.some((prefix) => path.startsWith(prefix)) || (path === "/bookings" && method.toUpperCase() === "POST"),
  // The guest token goes only to the guest's own account routes - never to public endpoints,
  // where it means nothing, and never anywhere else.
  sendsToken: (path) => path.startsWith("/guest/"),
};

export function createGuestClient(options: ScopedClientOptions) {
  return createScopedClient<GuestPaths>(guestScope, options);
}

export type GuestClient = ReturnType<typeof createGuestClient>;
export type Schemas = components["schemas"];
