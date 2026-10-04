import { describe, expect, it } from "vitest";
import { apkUpdateAvailable, latestApkUrl, parseApkRelease } from "../src/lib/appRelease";

const release = { versionCode: 5, versionName: "0.2.0", url: "https://sunsetsamui.com/mobile/staff/android/a.apk", publishedAt: "2026-10-04T10:00:00Z" };

describe("app release check", () => {
  it("finds latest.json next to the API", () => {
    expect(latestApkUrl("https://sunsetsamui.com/api")).toBe("https://sunsetsamui.com/mobile/staff/android/latest.json");
    expect(latestApkUrl("not a url")).toBeNull();
  });

  it("offers only a newer build", () => {
    expect(apkUpdateAvailable("4", release)).toBe(true);
    expect(apkUpdateAvailable(5, release)).toBe(false);
    expect(apkUpdateAvailable("6", release)).toBe(false);
  });

  it("offers nothing when the installed version is unknown (Expo Go, web) or there is no release", () => {
    expect(apkUpdateAvailable(null, release)).toBe(false);
    expect(apkUpdateAvailable("", release)).toBe(false);
    expect(apkUpdateAvailable("4", null)).toBe(false);
  });

  it("rejects a malformed or non-https latest.json", () => {
    expect(parseApkRelease(release)).toEqual(release);
    expect(parseApkRelease({ ...release, url: "http://evil/a.apk" })).toBeNull();
    expect(parseApkRelease({ ...release, versionCode: "5" })).toBeNull();
    expect(parseApkRelease(null)).toBeNull();
  });
});
