// Shared, audience-neutral pieces only. Import the client for your audience from
// "@sunset/api-client/staff" or "@sunset/api-client/guest" - never both in one app.
export * from "./errors";
export type { TokenSource, ScopedClientOptions } from "./transport";
export type { components } from "./schema";
