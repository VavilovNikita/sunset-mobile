import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import { call, type ApiResult } from "@sunset/api-client";
import { createGuestClient, type GuestClient, type Schemas } from "@sunset/api-client/guest";
import { API_BASE_URL } from "./config";

// Only a guest token ever lives in this app (secure storage, never AsyncStorage). It is sent to
// /guest/** only - see @sunset/api-client/guest.
const TOKEN_KEY = "sunset.guest.token";

type Account = Schemas["GuestAccount"];

type SessionValue = {
  ready: boolean;
  configured: boolean;
  api: GuestClient | null;
  account: Account | null;
  notice: string | null;
  /** Stores a token the server just issued (login, verify, reset) and loads the account. */
  acceptToken: (token: string, account: Account) => Promise<void>;
  signIn: (email: string, password: string) => Promise<ApiResult<Account>>;
  signOut: (notice?: string) => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);

  const signOut = useCallback(async (why?: string) => {
    tokenRef.current = null;
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined);
    setAccount(null);
    setNotice(why ?? null);
  }, []);

  const api = useMemo(
    () =>
      API_BASE_URL
        ? createGuestClient({
            baseUrl: API_BASE_URL,
            getToken: async () => tokenRef.current,
            // A password change (here or on the website) bumps the account's tokenVersion and the
            // server answers 401 to every older token - sign in again, nothing else to track.
            onUnauthorized: () => void signOut("You were signed out — please sign in again."),
          })
        : null,
    [signOut],
  );

  useEffect(() => {
    if (!api) {
      setReady(true);
      return;
    }
    (async () => {
      const stored = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);
      if (stored) {
        tokenRef.current = stored;
        const me = await call(api.GET("/guest/me"), "Could not load your account.");
        if (me.ok) setAccount(me.data);
        else if (me.status !== 401) setNotice(me.error);
      }
      setReady(true);
    })();
  }, [api]);

  const acceptToken = useCallback(async (token: string, next: Account) => {
    tokenRef.current = token;
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    setAccount(next);
    setNotice(null);
  }, []);

  const signIn = useCallback(
    async (email: string, password: string): Promise<ApiResult<Account>> => {
      if (!api) return { ok: false, error: "This build has no API address configured.", status: 0 };
      const r = await call(api.POST("/guest-auth/login", { body: { email: email.trim(), password } }), "Could not sign in.");
      if (!r.ok) return r;
      await acceptToken(r.data.token, r.data.account);
      return { ok: true, data: r.data.account, status: r.status };
    },
    [api, acceptToken],
  );

  const value = useMemo<SessionValue>(
    () => ({ ready, configured: !!api, api, account, notice, acceptToken, signIn, signOut }),
    [ready, api, account, notice, acceptToken, signIn, signOut],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession outside SessionProvider");
  return value;
}

export function useApi(): GuestClient {
  const { api } = useSession();
  if (!api) throw new Error("useApi without a configured API");
  return api;
}
