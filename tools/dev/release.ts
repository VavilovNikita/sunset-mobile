/**
 * Android releases from our own VPS - no Play Store, no Expo update servers.
 *
 *   npm run release -- update staff        JavaScript update: installed builds of this version pick it
 *                                           up on their next launch.
 *   npm run release -- bump staff [--native] before an EAS build: versionCode + 1 (and, with --native,
 *                                           a new app version - required when a native module or
 *                                           permission changed, see RELEASING.md).
 *   npm run release -- apk staff <file.apk | https://…apk>
 *                                           publish a new installable APK; the app offers it to every
 *                                           older install.
 *
 * Add --out <dir> to write the files locally instead of uploading. Uploading uses the ssh/scp that
 * ship with Windows 10+, macOS and Linux: SUNSET_VPS=user@host (key-based login), optional
 * SUNSET_MOBILE_ROOT (default /var/www/sunset-mobile, served by deploy/nginx-mobile.conf).
 */
import { spawnSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { assertSafeRuntimeVersion, buildUpdate, type ApkRelease, type ExportedFile } from "./updateManifest";

// The production addresses every published build and update talks to - the same values the EAS
// build environment holds (RELEASING.md). A release never reads apps/*/.env.
const SITE_ORIGIN = "https://sunsetsamui.com";
const API_BASE_URL = `${SITE_ORIGIN}/api`;
const PUBLIC_BASE = `${SITE_ORIGIN}/mobile`;

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const [command, app, ...rest] = process.argv.slice(2);
const flags = new Set(rest.filter((a) => a.startsWith("--")));
const outIndex = rest.indexOf("--out");
const outDir = outIndex >= 0 ? rest[outIndex + 1] : undefined;
const positional = rest.filter((a, i) => !a.startsWith("--") && rest[i - 1] !== "--out");

function fail(message: string): never {
  console.error(`\n${message}`);
  process.exit(1);
}

if (app !== "staff" && app !== "guest") fail("usage: npm run release -- <update|bump|apk> <staff|guest> [...]  (see tools/dev/release.ts)");
const appDir = join(root, "apps", app);
const appJsonPath = join(appDir, "app.json");

type AppJson = { expo: { version: string; android?: { versionCode?: number }; runtimeVersion?: unknown } };
const readAppJson = () => JSON.parse(readFileSync(appJsonPath, "utf8")) as AppJson;

function runtimeVersionOf(appJson: AppJson): string {
  const policy = (appJson.expo.runtimeVersion as { policy?: string } | undefined)?.policy;
  if (policy !== "appVersion") fail(`apps/${app}/app.json must use runtimeVersion { "policy": "appVersion" } - this script relies on it.`);
  return assertSafeRuntimeVersion(appJson.expo.version);
}

function run(cmd: string, args: string[], opts: { cwd?: string; env?: NodeJS.ProcessEnv; capture?: boolean } = {}) {
  const r = spawnSync(cmd, args, {
    cwd: opts.cwd,
    env: opts.env ?? process.env,
    encoding: "utf8",
    stdio: opts.capture ? ["ignore", "pipe", "inherit"] : "inherit",
    shell: process.platform === "win32",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.status !== 0) fail(`${cmd} ${args.join(" ")} failed (exit ${r.status ?? r.signal}).`);
  return r.stdout ?? "";
}

/** Writes `files` under a local dir, then either leaves them there (--out) or copies them to the VPS. */
function publish(remoteSubdir: string, files: { name: string; bytes: Buffer }[], last: { name: string; bytes: Buffer }) {
  const local = outDir ? resolve(outDir, remoteSubdir) : mkdtempSync(join(tmpdir(), "sunset-release-"));
  for (const f of [...files, last]) {
    mkdirSync(dirname(join(local, f.name)), { recursive: true });
    writeFileSync(join(local, f.name), f.bytes);
  }
  if (outDir) {
    console.log(`\nWrote ${files.length + 1} file(s) to ${local} (nothing uploaded).`);
    return;
  }
  const host = process.env.SUNSET_VPS;
  if (!host) fail("Set SUNSET_VPS=user@host (ssh key login) to upload, or pass --out <dir> to only write the files.");
  const remoteRoot = (process.env.SUNSET_MOBILE_ROOT ?? "/var/www/sunset-mobile").replace(/\/$/, "");
  const remote = `${remoteRoot}/${remoteSubdir}`;
  const dirs = [...new Set(files.map((f) => dirname(f.name)).filter((d) => d !== "."))];
  run("ssh", [host, `mkdir -p ${[remote, ...dirs.map((d) => `${remote}/${d}`)].map((d) => `'${d}'`).join(" ")}`]);
  // Everything the pointer file refers to goes up first, the pointer (manifest / latest.json) last,
  // so a phone checking mid-upload never sees a manifest whose files aren't there yet.
  for (const dir of dirs) run("scp", ["-q", "-r", join(local, dir), `${host}:${remote}/`]);
  for (const f of files.filter((f) => dirname(f.name) === ".")) run("scp", ["-q", join(local, f.name), `${host}:${remote}/${f.name}`]);
  run("scp", ["-q", join(local, last.name), `${host}:${remote}/${last.name}`]);
  rmSync(local, { recursive: true, force: true });
  console.log(`\nUploaded to ${host}:${remote}`);
}

async function releaseUpdate() {
  const runtimeVersion = runtimeVersionOf(readAppJson());
  const env = { ...process.env, EXPO_PUBLIC_API_BASE_URL: API_BASE_URL, EXPO_PUBLIC_SITE_ORIGIN: SITE_ORIGIN, EXPO_NO_DOTENV: "1" };
  const exportDir = mkdtempSync(join(tmpdir(), `sunset-${app}-export-`));
  console.log(`• exporting ${app} for Android (runtime ${runtimeVersion}, API ${API_BASE_URL})`);
  run("npx", ["expo", "export", "--platform", "android", "--output-dir", exportDir], { cwd: appDir, env });
  const expoClient = JSON.parse(run("npx", ["expo", "config", "--type", "public", "--json"], { cwd: appDir, env, capture: true })) as Record<string, unknown>;

  const metadata = JSON.parse(readFileSync(join(exportDir, "metadata.json"), "utf8")) as {
    fileMetadata: { android?: { bundle: string; assets: { path: string; ext: string }[] } };
  };
  const android = metadata.fileMetadata.android;
  if (!android) fail("The export has no Android bundle.");
  const read = (path: string, ext: string): ExportedFile => ({ path, ext, bytes: readFileSync(join(exportDir, path)) });
  const baseUrl = `${PUBLIC_BASE}/${app}/updates/${runtimeVersion}/android`;
  const { manifest, files } = buildUpdate({
    baseUrl,
    runtimeVersion,
    scopeKey: `${PUBLIC_BASE}/${app}`,
    expoClient,
    bundle: read(android.bundle, "hbc"),
    assets: android.assets.map((a) => read(a.path, a.ext)),
    createdAt: new Date(),
  });
  rmSync(exportDir, { recursive: true, force: true });
  publish(`${app}/updates/${runtimeVersion}/android`, files, { name: "manifest.json", bytes: Buffer.from(JSON.stringify(manifest)) });
  console.log(`Update ${manifest.id} published for ${app} ${runtimeVersion}. Phones on this version get it on their next launch.`);
}

function bump() {
  const appJson = readAppJson();
  const android = (appJson.expo.android ??= {});
  android.versionCode = (android.versionCode ?? 0) + 1;
  if (flags.has("--native")) {
    const [major, minor] = appJson.expo.version.split(".").map(Number);
    appJson.expo.version = `${major}.${(minor ?? 0) + 1}.0`;
  }
  writeFileSync(appJsonPath, `${JSON.stringify(appJson, null, 2)}\n`);
  console.log(`apps/${app}: version ${appJson.expo.version}, versionCode ${android.versionCode}. Commit this, then build (RELEASING.md).`);
}

async function releaseApk() {
  const source = positional[0];
  if (!source) fail("Pass the APK: npm run release -- apk staff <file.apk | https://…apk>");
  const appJson = readAppJson();
  const versionCode = appJson.expo.android?.versionCode;
  if (!versionCode) fail(`apps/${app}/app.json has no android.versionCode - run "npm run release -- bump ${app}" before building.`);
  let bytes: Buffer;
  if (/^https:\/\//.test(source)) {
    console.log("• downloading the APK");
    const res = await fetch(source);
    if (!res.ok || !res.body) fail(`Download failed: HTTP ${res.status}`);
    const tmp = join(mkdtempSync(join(tmpdir(), "sunset-apk-")), "app.apk");
    await pipeline(Readable.fromWeb(res.body as never), createWriteStream(tmp));
    bytes = readFileSync(tmp);
  } else {
    if (!existsSync(source)) fail(`No file at ${source}`);
    bytes = readFileSync(source);
  }
  if (bytes.subarray(0, 2).toString("latin1") !== "PK") fail("That is not an APK (expected a zip file).");
  const name = `sunset-${app}-${appJson.expo.version}-${versionCode}.apk`;
  const latest: ApkRelease = { versionCode, versionName: appJson.expo.version, url: `${PUBLIC_BASE}/${app}/android/${name}`, publishedAt: new Date().toISOString() };
  console.log(`\nPublishing ${name}. It must be the build made from this app.json (versionCode ${versionCode}) - the app compares this number with its own.`);
  publish(`${app}/android`, [{ name, bytes }], { name: "latest.json", bytes: Buffer.from(JSON.stringify(latest, null, 2)) });
  console.log(`Install link for new phones: ${latest.url}`);
}

if (command === "update") await releaseUpdate();
else if (command === "bump") bump();
else if (command === "apk") await releaseApk();
else fail("Commands: update, bump, apk (see tools/dev/release.ts).");
