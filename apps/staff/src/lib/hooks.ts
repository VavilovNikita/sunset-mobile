import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import type { ApiResult } from "@sunset/api-client";
import { createLatestGuard } from "@sunset/core";

type Loaded<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => Promise<void>;
  /** Put a write's response on screen; any poll already in flight is discarded so it can't overwrite it. */
  apply: (data: T) => void;
};

/**
 * Loads on focus and, with `pollMs`, re-polls while the screen is focused and the app is in the
 * foreground. Responses are applied only if no newer request (or write) has been issued since -
 * the stale-poll overwrite the web POS ticket suffers from (audit M12) can't happen here.
 * A failed reload keeps the last good data and shows the error beside it; it never turns into an
 * empty "nothing here" screen.
 */
export function useLoad<T>(load: () => Promise<ApiResult<T>>, deps: unknown[], options: { pollMs?: number } = {}): Loaded<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const guard = useRef(createLatestGuard()).current;
  const loadRef = useRef(load);
  loadRef.current = load;

  const reload = useCallback(async () => {
    const ticket = guard.take();
    const result = await loadRef.current();
    if (!guard.isLatest(ticket)) return;
    if (result.ok) {
      setData(result.data);
      setError(null);
    } else {
      setError(result.error);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const apply = useCallback((next: T) => {
    guard.take();
    setData(next);
    setError(null);
    setLoading(false);
  }, [guard]);

  useFocusEffect(
    useCallback(() => {
      void reload();
      if (!options.pollMs) return undefined;
      const timer = setInterval(() => {
        if (AppState.currentState === "active") void reload();
      }, options.pollMs);
      return () => clearInterval(timer);
    }, [reload, options.pollMs]),
  );

  return { data, error, loading, reload, apply };
}

/** A write: busy while in flight, its failure kept next to the control that started it. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => () => void (mounted.current = false), []);

  const run = useCallback(async <T,>(fn: () => Promise<ApiResult<T>>): Promise<ApiResult<T>> => {
    setBusy(true);
    setError(null);
    const result = await fn();
    if (mounted.current) {
      setBusy(false);
      if (!result.ok) setError(result.error);
    }
    return result;
  }, []);

  return { busy, error, setError, run };
}

/** For "the current X" reads where 404 is a real answer ("there is none"), not a failure. */
export function nullOn404<T>(result: ApiResult<T>): ApiResult<T | null> {
  return !result.ok && result.status === 404 ? { ok: true, status: 200, data: null } : result;
}
