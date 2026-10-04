/**
 * Builds an Expo Updates (protocol 1) manifest from `expo export` output, so installed Android
 * builds can take JavaScript updates from our own VPS instead of Expo's servers. Pure: no file or
 * network access here - release.ts does the reading and uploading. The format is what
 * expo-updates' own Android loader parses (ExpoUpdatesUpdate.kt / ExpoUpdatesManifest.kt):
 * id (a UUID), createdAt, runtimeVersion, launchAsset and assets, each with a url and a
 * base64url-encoded SHA-256 `hash` that the client checks before using the file.
 */
import { createHash } from "node:crypto";

export type ExportedFile = { path: string; ext: string; bytes: Buffer };

export type PublishedFile = { name: string; bytes: Buffer };

export type UpdateManifest = {
  id: string;
  createdAt: string;
  runtimeVersion: string;
  launchAsset: { hash: string; key: string; contentType: string; fileExtension: string; url: string };
  assets: { hash: string; key: string; contentType: string; fileExtension: string; url: string }[];
  metadata: Record<string, never>;
  extra: { scopeKey: string; expoClient: Record<string, unknown> };
};

const CONTENT_TYPES: Record<string, string> = {
  hbc: "application/javascript",
  js: "application/javascript",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  ttf: "font/ttf",
  otf: "font/otf",
  json: "application/json",
  xml: "application/xml",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
};

export const base64UrlSha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("base64url");
const hexSha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const hexMd5 = (bytes: Buffer) => createHash("md5").update(bytes).digest("hex");

/** A UUID derived from the content, so publishing the same build twice gives the same update id. */
export function contentUuid(seed: string): string {
  const h = createHash("sha256").update(seed).digest("hex");
  const variant = ((parseInt(h[16]!, 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/**
 * Runtime versions end up in a URL path and an nginx `map`; only allow what that map accepts.
 */
export function assertSafeRuntimeVersion(runtimeVersion: string): string {
  if (!/^[0-9A-Za-z._-]{1,64}$/.test(runtimeVersion)) throw new Error(`Unsupported runtime version "${runtimeVersion}" - use letters, digits, dot, dash, underscore.`);
  return runtimeVersion;
}

export function buildUpdate(opts: {
  /** e.g. https://sunsetsamui.com/mobile/staff/updates/0.1.0/android - where the files will be served from. */
  baseUrl: string;
  runtimeVersion: string;
  scopeKey: string;
  expoClient: Record<string, unknown>;
  bundle: ExportedFile;
  assets: ExportedFile[];
  createdAt: Date;
}): { manifest: UpdateManifest; files: PublishedFile[] } {
  assertSafeRuntimeVersion(opts.runtimeVersion);
  const files: PublishedFile[] = [];
  // Files are named by their own content hash, so a later update never overwrites a file an older
  // manifest still points at, and the server can cache them forever.
  const describe = (file: ExportedFile) => {
    // The client checks the hash, not the type; an unlisted extension still loads as raw bytes.
    const contentType = CONTENT_TYPES[file.ext.toLowerCase()] ?? "application/octet-stream";
    const name = `assets/${hexSha256(file.bytes)}.${file.ext}`;
    files.push({ name, bytes: file.bytes });
    // `key` must be Metro's asset hash (MD5 of the file): expo-asset finds a downloaded image or font
    // by that hash in expo-updates' localAssets map, so any other key leaves every asset unresolved.
    return { hash: base64UrlSha256(file.bytes), key: hexMd5(file.bytes), contentType, fileExtension: `.${file.ext}`, url: `${opts.baseUrl}/${name}` };
  };
  const launchAsset = describe(opts.bundle);
  const assets = opts.assets.map(describe);
  const id = contentUuid([opts.runtimeVersion, launchAsset.hash, ...assets.map((a) => a.hash)].join("|"));
  return {
    manifest: {
      id,
      createdAt: opts.createdAt.toISOString(),
      runtimeVersion: opts.runtimeVersion,
      launchAsset,
      assets,
      metadata: {},
      extra: { scopeKey: opts.scopeKey, expoClient: opts.expoClient },
    },
    files,
  };
}

/** latest.json next to the APKs - read by the staff app (apps/staff/src/lib/appRelease.ts). */
export type ApkRelease = { versionCode: number; versionName: string; url: string; publishedAt: string };

