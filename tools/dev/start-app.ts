/**
 * `npm run staff` / `npm run guest`: starts the Expo dev server for one app with the API address
 * filled in automatically - this computer's Wi-Fi address, port 8080 (the dev backend from
 * `npm run dev:backend`). An explicit EXPO_PUBLIC_API_BASE_URL (shell or the app's own .env)
 * always wins, so pointing at another backend still works.
 *
 * --web opens the app in this computer's browser instead (staff on :8081, guest on :8082 - the two
 * origins the dev backend allows), talking to localhost. A quick look only: nothing is remembered
 * across a reload there, and camera/photo features need a phone.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { lanAddress } from "./lan";

const app = process.argv[2];
if (app !== "staff" && app !== "guest") {
  console.error("usage: start-app.ts staff|guest [--clear] [--tunnel] [--web]");
  process.exit(2);
}
const extra = process.argv.slice(3);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const appDir = resolve(root, "apps", app);

function fromDotEnv(key: string): string | undefined {
  const file = resolve(appDir, ".env");
  if (!existsSync(file)) return undefined;
  const line = readFileSync(file, "utf8").split(/\r?\n/).find((l) => l.startsWith(`${key}=`));
  const value = line?.slice(key.length + 1).trim();
  return value || undefined;
}

const web = extra.includes("--web");
const ip = web ? "localhost" : lanAddress();
const env = { ...process.env };
for (const [key, fallback] of [
  ["EXPO_PUBLIC_API_BASE_URL", ip ? `http://${ip}:8080/api` : undefined],
  ["EXPO_PUBLIC_SITE_ORIGIN", ip ? `http://${ip}:3000` : undefined],
] as const) {
  const value = env[key] ?? fromDotEnv(key) ?? fallback;
  if (value) env[key] = value;
  const source = process.env[key] ? "shell" : fromDotEnv(key) ? `apps/${app}/.env` : "auto";
  console.log(`  ${key} = ${value ?? "(not set)"}  [${source}]`);
}
if (!env.EXPO_PUBLIC_API_BASE_URL) {
  console.error("\nCould not find this computer's Wi-Fi address. Set EXPO_PUBLIC_API_BASE_URL in apps/" + app + "/.env.");
  process.exit(1);
}
if (/sunsetsamui\.com/i.test(env.EXPO_PUBLIC_API_BASE_URL)) {
  console.error("\nRefusing to start a development build against production. Use the dev backend (npm run dev:backend).");
  process.exit(1);
}
console.log(
  web
    ? "\nOpening in the browser. Sign-in isn't remembered across a reload there.\n"
    : "\nScan the QR code below with the camera (iPhone) or Expo Go (Android). Phone and computer must be on the same Wi-Fi.\n",
);

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const args = [
  "expo",
  "start",
  ...(extra.includes("--clear") ? ["--clear"] : []),
  ...(extra.includes("--tunnel") ? ["--tunnel"] : []),
  ...(web ? ["--web", "--port", app === "staff" ? "8081" : "8082"] : []),
];
const child = spawn(npx, args, { cwd: appDir, env, stdio: "inherit", shell: process.platform === "win32" });
child.on("exit", (code) => process.exit(code ?? 0));
