import createClient, { type Client, type Middleware } from "openapi-fetch";
import { ScopeViolation } from "./errors";

export type TokenSource = {
  /** Reads the stored token (secure storage on device). Null when signed out. */
  getToken: () => Promise<string | null>;
  /**
   * Called when the server rejects the token with 401. That is the whole client side of the
   * backend's tokenVersion revocation (password change, role change, disabled account, "sign out
   * everywhere"): the server re-checks the token on every request, so a 401 means "sign in again"
   * and there is nothing to track locally.
   */
  onUnauthorized: () => void;
};

export type ScopedClientOptions = TokenSource & {
  baseUrl: string;
  fetch?: (input: Request) => Promise<Response>;
};

export type Scope = {
  audience: string;
  /** May this audience call METHOD schemaPath at all? Checked before every request. */
  allows: (method: string, schemaPath: string) => boolean;
  /** Should the stored token be sent on this request? */
  sendsToken: (schemaPath: string) => boolean;
};

/**
 * One openapi-fetch client bound to one audience. The scope check runs on every request and
 * throws ScopeViolation, so a staff-only path can never be called from the guest app even if the
 * backend would currently let it through (see audit finding H1) - the type of `Paths` already
 * forbids it at compile time; this is the runtime belt to that.
 */
export function createScopedClient<Paths extends {}>(scope: Scope, options: ScopedClientOptions): Client<Paths> {
  const client = createClient<Paths>({ baseUrl: options.baseUrl.replace(/\/+$/, ""), fetch: options.fetch });
  const sentToken = new Set<string>();
  const middleware: Middleware = {
    async onRequest({ request, schemaPath, id }) {
      if (!scope.allows(request.method, schemaPath)) {
        throw new ScopeViolation(scope.audience, request.method, schemaPath);
      }
      if (!scope.sendsToken(schemaPath)) return undefined;
      const token = await options.getToken();
      if (!token) return undefined;
      sentToken.add(id);
      request.headers.set("Authorization", `Bearer ${token}`);
      return request;
    },
    onResponse({ response, id }) {
      const hadToken = sentToken.delete(id);
      if (response.status === 401 && hadToken) options.onUnauthorized();
      return undefined;
    },
    onError({ id }) {
      sentToken.delete(id);
      return undefined;
    },
  };
  client.use(middleware);
  return client;
}
