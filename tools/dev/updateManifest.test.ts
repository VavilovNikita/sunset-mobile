import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { assertSafeRuntimeVersion, buildUpdate, contentUuid } from "./updateManifest";

const file = (path: string, ext: string, text: string) => ({ path, ext, bytes: Buffer.from(text) });
const build = (bundleText = "bundle") =>
  buildUpdate({
    baseUrl: "https://example.test/mobile/staff/updates/0.1.0/android",
    runtimeVersion: "0.1.0",
    scopeKey: "https://example.test/mobile/staff",
    expoClient: { name: "Sunset Staff" },
    bundle: file("_expo/static/js/android/entry.hbc", "hbc", bundleText),
    assets: [file("assets/abc", "png", "png-bytes"), file("assets/def", "xml", "<x/>")],
    createdAt: new Date("2026-10-04T10:00:00Z"),
  });

describe("update manifest", () => {
  it("has what expo-updates' Android loader requires, with base64url SHA-256 hashes it verifies", () => {
    const { manifest, files } = build();
    expect(manifest.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(manifest.createdAt).toBe("2026-10-04T10:00:00.000Z");
    expect(manifest.runtimeVersion).toBe("0.1.0");
    expect(manifest.extra.scopeKey).toBe("https://example.test/mobile/staff");
    expect(manifest.launchAsset.hash).toBe(createHash("sha256").update("bundle").digest("base64url"));
    expect(manifest.launchAsset.contentType).toBe("application/javascript");
    expect(manifest.assets.map((a) => a.fileExtension)).toEqual([".png", ".xml"]);
    expect(manifest.assets[1]!.contentType).toBe("application/xml");
    // expo-asset looks a downloaded asset up by Metro's hash (MD5 of the file), via this key.
    expect(manifest.assets[0]!.key).toBe(createHash("md5").update(files.find((f) => f.name.endsWith(".png"))!.bytes).digest("hex"));
    // Every URL in the manifest is a file we publish.
    for (const url of [manifest.launchAsset.url, ...manifest.assets.map((a) => a.url)]) {
      const name = url.replace("https://example.test/mobile/staff/updates/0.1.0/android/", "");
      expect(files.some((f) => f.name === name)).toBe(true);
    }
  });

  it("gives the same content the same id, and new content a new one", () => {
    expect(build().manifest.id).toBe(build().manifest.id);
    expect(build("bundle v2").manifest.id).not.toBe(build().manifest.id);
    expect(contentUuid("a")).not.toBe(contentUuid("b"));
  });

  it("only accepts runtime versions that are safe in a path", () => {
    expect(assertSafeRuntimeVersion("0.1.0")).toBe("0.1.0");
    expect(() => assertSafeRuntimeVersion("../../etc")).toThrow();
    expect(() => assertSafeRuntimeVersion("")).toThrow();
  });
});
