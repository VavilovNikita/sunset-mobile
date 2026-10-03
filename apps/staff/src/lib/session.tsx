import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState, View } from "react-native";
import * as SecureStore from "expo-secure-store";
import { call, type ApiResult } from "@sunset/api-client";
import { createStaffClient, type StaffClient } from "@sunset/api-client/staff";
import { API_BASE_URL, IDLE_LIMIT_MS } from "./config";
import type { StaffUser } from "./access";
import type { Schemas } from "@sunset/api-client/staff";

// Only a staff token ever lives in this app, only in the device's secure storage (Keychain /
// Keystore), never AsyncStorage. The guest app has its own key in its own sandbox.
const TOKEN_KEY = "sunset.staff.token";

type Status = "loading" | "signedOut" | "signedIn" | "misconfigured";

type SessionValue = {
  status: Status;
  user: Schemas["User"] | null;
  api: StaffClient | null;
  /** Why the last session ended, shown on the login screen (expired, idle, revoked). */
  notice: string | null;
  signIn: (email: string, password: string) => Promise<ApiResult<Schemas["User"]>>;
  signOut: (notice?: string) => Promise<void>;
  /** For the few requests that can't go through the typed client (an authenticated <Image>). */
  authHeaders: () => Record<string, string>;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>(API_BASE_URL ? "loading" : "misconfigured");
  const [user, setUser] = useState<Schemas["User"] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const lastActiveRef = useRef(Date.now());

  const signOut = useCallback(async (why?: string) => {
    tokenRef.current = null;
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined);
    setUser(null);
    setNotice(why ?? null);
    setStatus(API_BASE_URL ? "signedOut" : "misconfigured");
  }, []);

  const api = useMemo(() => {
    if (!API_BASE_URL) return null;
    return createStaffClient({
      baseUrl: API_BASE_URL,
      getToken: async () => tokenRef.current,
      // tokenVersion revocation is entirely server-side: any 401 on a signed-in call means the
      // token was revoked (password/role change, account disabled) or expired - sign in again.
      onUnauthorized: () => void signOut("Your session ended — please sign in again."),
    });
  }, [signOut]);

  useEffect(() => {
    if (!api) return;
    (async () => {
      const stored = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);
      if (!stored) {
        setStatus("signedOut");
        return;
      }
      tokenRef.current = stored;
      const me = await call(api.GET("/auth/me"), "Could not check your sign-in.");
      if (me.ok) {
        setUser(me.data);
        setStatus("signedIn");
      } else if (me.status === 401) {
        await signOut("Your session ended — please sign in again.");
      } else {
        // Offline at launch: keep the token, but there's no user to gate screens on yet.
        await signOut(me.status === 0 ? "No connection — sign in again when you're back online." : me.error);
      }
    })();
  }, [api, signOut]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<ApiResult<Schemas["User"]>> => {
      if (!api) return { ok: false, error: "This build has no API address configured.", status: 0 };
      const result = await call(api.POST("/auth/login", { body: { email: email.trim(), password } }), "Could not sign in.");
      if (!result.ok) return result;
      tokenRef.current = result.data.token;
      await SecureStore.setItemAsync(TOKEN_KEY, result.data.token);
      lastActiveRef.current = Date.now();
      setUser(result.data.user);
      setNotice(null);
      setStatus("signedIn");
      return { ok: true, data: result.data.user, status: result.status };
    },
    [api],
  );

  // Idle sign-out: 30 minutes without a touch, in the foreground or in the background.
  useEffect(() => {
    if (status !== "signedIn") return;
    const timer = setInterval(() => {
      if (Date.now() - lastActiveRef.current > IDLE_LIMIT_MS) void signOut("Signed out after 30 minutes without use.");
    }, 30_000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && Date.now() - lastActiveRef.current > IDLE_LIMIT_MS) {
        void signOut("Signed out after 30 minutes without use.");
      }
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [status, signOut]);

  const authHeaders = useCallback((): Record<string, string> => (tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {}), []);

  const value = useMemo<SessionValue>(
    () => ({ status, user, api, notice, signIn, signOut, authHeaders }),
    [status, user, api, notice, signIn, signOut, authHeaders],
  );

  return (
    <SessionContext.Provider value={value}>
      <View
        style={{ flex: 1 }}
        onTouchStart={() => {
          lastActiveRef.current = Date.now();
        }}
      >
        {children}
      </View>
    </SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession outside SessionProvider");
  return value;
}

/** For screens behind the signed-in layout, where both are guaranteed. */
export function useSignedIn(): { api: StaffClient; user: Schemas["User"] & StaffUser } {
  const { api, user } = useSession();
  if (!api || !user) throw new Error("useSignedIn on a signed-out screen");
  return { api, user };
}
