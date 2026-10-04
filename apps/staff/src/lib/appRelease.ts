import { API_BASE_URL } from "./config";

/**
 * Android builds are installed from our own VPS (RELEASING.md), not a store, so nothing tells a
 * phone that a newer APK exists - the app asks. `latest.json` is written by `npm run release -- apk`.
 */
export type ApkRelease = { versionCode: number; versionName: string; url: string; publishedAt: string };

/** Same origin as the API: https://sunsetsamui.com/api -> https://sunsetsamui.com/mobile/staff/android/latest.json */
export function latestApkUrl(apiBaseUrl: string | null = API_BASE_URL): string | null {
  if (!apiBaseUrl) return null;
  try {
    return `${new URL(apiBaseUrl).origin}/mobile/staff/android/latest.json`;
  } catch {
    return null;
  }
}

export function parseApkRelease(value: unknown): ApkRelease | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.versionCode !== "number" || !Number.isInteger(v.versionCode) || typeof v.url !== "string" || typeof v.versionName !== "string") return null;
  // Only ever offer an https download - the link is opened in the browser and installed.
  if (!v.url.startsWith("https://")) return null;
  return { versionCode: v.versionCode, versionName: v.versionName, url: v.url, publishedAt: typeof v.publishedAt === "string" ? v.publishedAt : "" };
}

/** Whether the published APK is newer than this install (Android versionCodes, compared as numbers). */
export function apkUpdateAvailable(installedVersionCode: string | number | null | undefined, latest: ApkRelease | null): boolean {
  if (!latest || installedVersionCode == null || installedVersionCode === "") return false;
  const installed = Number(installedVersionCode);
  return Number.isFinite(installed) && latest.versionCode > installed;
}
