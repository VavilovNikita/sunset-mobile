/**
 * `npm run dev:backend` - a throwaway local backend for trying the apps on a phone, never production.
 *
 *   1. Postgres in Docker (`sunset-dev-db`, port 5435 on 127.0.0.1 only, data in volume
 *      `sunset-dev-db-data`), loaded from sunset's committed baseline on first start.
 *   2. The sunset backend from a sibling checkout (SUNSET_DIR, default ../sunset), built once,
 *      listening on all interfaces at :8080 so a phone on the same Wi-Fi can reach it.
 *   3. Demo data, once: staff of every role, tables, a menu, spa tables and treatments, a room type
 *      with units, and a checked-in guest with an account - see the logins printed at the end.
 *
 * Flags: --rebuild (rebuild the backend jar), --reset (wipe the demo database first).
 * Ctrl+C stops the backend; the database container keeps running (docker rm -f sunset-dev-db to remove).
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import { call } from "@sunset/api-client/errors";
import { createStaffClient } from "@sunset/api-client/staff";
import { lanAddress } from "./lan";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const sunsetDir = resolve(process.env.SUNSET_DIR ?? resolve(root, "../sunset"));
const args = new Set(process.argv.slice(2));

const DB = "sunset-dev-db";
const VOLUME = "sunset-dev-db-data";
const DB_PORT = 5435;
const API_PORT = Number(process.env.DEV_API_PORT ?? 8080);
const LOCAL_API = `http://127.0.0.1:${API_PORT}/api`;

export const DEMO_PASSWORD = "demo-pass-123";
export const DEMO_STAFF = [
  { email: "admin@demo.local", name: "Ada Admin", role: "ADMIN" as const, functions: [] as ("ENGINEER" | "HOUSEKEEPER" | "THERAPIST")[] },
  { email: "manager@demo.local", name: "Max Manager", role: "MANAGER" as const, functions: [] },
  { email: "cashier@demo.local", name: "Cara Cashier", role: "CASHIER" as const, functions: [] },
  { email: "waiter@demo.local", name: "Walt Waiter", role: "WAITER" as const, functions: [] },
  { email: "engineer@demo.local", name: "Eli Engineer", role: "WAITER" as const, functions: ["ENGINEER" as const] },
  { email: "therapist@demo.local", name: "Tia Therapist", role: "WAITER" as const, functions: ["THERAPIST" as const] },
];
export const DEMO_GUEST = { email: "guest@demo.local", name: "Gina Guest" };

function run(cmd: string, argv: string[], opts: { input?: string; cwd?: string; quiet?: boolean } = {}) {
  const r = spawnSync(cmd, argv, { cwd: opts.cwd, input: opts.input, encoding: "utf8", shell: process.platform === "win32", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0 && !opts.quiet) {
    throw new Error(`${cmd} ${argv.join(" ")} failed:\n${r.stderr || r.stdout}`);
  }
  return r;
}

function psql(sql: string, quiet = false) {
  return run("docker", ["exec", "-i", DB, "psql", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1", "-U", "sunsetbeach", "-d", "sunsetbeach"], { input: sql, quiet }).stdout.trim();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function startDatabase() {
  if (run("docker", ["version"], { quiet: true }).status !== 0) throw new Error("Docker isn't running. Start Docker Desktop (or the docker daemon) and try again.");
  if (args.has("--reset")) {
    console.log("• wiping the demo database");
    run("docker", ["rm", "-f", DB], { quiet: true });
    run("docker", ["volume", "rm", VOLUME], { quiet: true });
  }
  const state = run("docker", ["inspect", "-f", "{{.State.Running}}", DB], { quiet: true });
  if (state.status !== 0) {
    console.log("• creating the demo database container");
    run("docker", [
      "run", "-d", "--name", DB,
      "-e", "POSTGRES_USER=sunsetbeach", "-e", "POSTGRES_PASSWORD=sunsetbeach", "-e", "POSTGRES_DB=sunsetbeach",
      // 127.0.0.1 only: the database is never reachable from the network, only the API is.
      "-p", `127.0.0.1:${DB_PORT}:5432`, "-v", `${VOLUME}:/var/lib/postgresql/data`, "postgres:16-alpine",
    ]);
  } else if (state.stdout.trim() !== "true") {
    run("docker", ["start", DB]);
  }
  for (let i = 0; i < 60; i++) {
    if (run("docker", ["exec", DB, "pg_isready", "-U", "sunsetbeach", "-q"], { quiet: true }).status === 0) break;
    await sleep(1000);
  }
  // The schema can't be built from migrations alone (see sunset's CLAUDE.md), so a fresh database
  // starts from the same committed baseline sunset's own tests use; Flyway applies the rest.
  if (psql(`SELECT to_regclass('public."User"') IS NOT NULL;`) !== "t") {
    console.log("• loading sunset's schema baseline");
    psql(readFileSync(resolve(sunsetDir, "src/test/resources/test-db-baseline.sql"), "utf8"));
  }
}

function backendJar(): string | null {
  const target = resolve(sunsetDir, "target");
  if (!existsSync(target)) return null;
  const jar = readdirSync(target).find((f) => /^sunset-.*\.jar$/.test(f) && !f.endsWith("-plain.jar"));
  return jar ? resolve(target, jar) : null;
}

async function startBackend(): Promise<ChildProcess> {
  if (!existsSync(resolve(sunsetDir, "pom.xml"))) {
    throw new Error(`No sunset checkout at ${sunsetDir}. Clone github.com/VavilovNikita/sunset next to this repo, or set SUNSET_DIR.`);
  }
  if (args.has("--rebuild") || !backendJar()) {
    console.log("• building the backend (first time takes a few minutes)");
    const mvnw = process.platform === "win32" ? "mvnw.cmd" : "./mvnw";
    run(process.platform === "win32" ? mvnw : "sh", process.platform === "win32" ? ["-q", "-DskipTests", "package"] : [mvnw, "-q", "-DskipTests", "package"], { cwd: sunsetDir });
  }
  const jar = backendJar();
  if (!jar) throw new Error("The backend build produced no jar.");

  const log = resolve(here, ".backend.log");
  console.log(`• starting the backend on :${API_PORT} (log: tools/dev/.backend.log)`);
  const child = spawn("java", ["-jar", jar, `--server.port=${API_PORT}`, "--server.address=0.0.0.0"], {
    env: {
      ...process.env,
      DATABASE_URL: `jdbc:postgresql://127.0.0.1:${DB_PORT}/sunsetbeach`,
      DATABASE_USER: "sunsetbeach",
      DATABASE_PASSWORD: "sunsetbeach",
      // Dev-only secrets; tokens issued here are worthless anywhere else.
      JWT_SECRET: "dev-only-jwt-secret-not-for-production-use!!",
      GUEST_JWT_SECRET: "dev-only-guest-jwt-secret-not-for-production!",
      RESEND_API_KEY: "",
      NEXTAUTH_URL: `http://${lanAddress() ?? "localhost"}:3000`,
      // Native apps send no Origin; this only lets the web preview (`expo start --web`) call in.
      CORS_ALLOWED_ORIGINS: "http://localhost:8081,http://localhost:8082,http://127.0.0.1:8081,http://127.0.0.1:8082",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const out = createWriteStream(log);
  child.stdout?.pipe(out);
  child.stderr?.pipe(out);
  child.on("exit", (code) => {
    if (code !== null && code !== 0) console.error(`\nThe backend stopped (exit ${code}) - see tools/dev/.backend.log`);
  });

  for (let i = 0; i < 120; i++) {
    if (child.exitCode !== null) throw new Error("The backend exited during startup - see tools/dev/.backend.log");
    try {
      const res = await fetch(`${LOCAL_API}/actuator/health`);
      if (res.ok) return child;
    } catch {
      // not up yet
    }
    await sleep(1000);
  }
  throw new Error("The backend didn't become healthy in 2 minutes - see tools/dev/.backend.log");
}

/** Staff log in through the API like the app does; the very first admin has to be inserted directly. */
async function seed() {
  const adminHash = bcrypt.hashSync(DEMO_PASSWORD, 12);
  const alreadySeeded = psql(`SELECT count(*) FROM "User" WHERE email = 'admin@demo.local';`) !== "0";
  if (alreadySeeded) {
    console.log("• demo data already present (use --reset to start over)");
    return;
  }
  console.log("• adding demo data");
  psql(`INSERT INTO "User" (id, email, "passwordHash", role, name, "isActive", "tokenVersion")
        VALUES ('demo-admin', 'admin@demo.local', '${adminHash}', 'ADMIN', 'Ada Admin', true, 0);`);

  let token: string | null = null;
  const api = createStaffClient({ baseUrl: LOCAL_API, getToken: async () => token, onUnauthorized: () => undefined });
  const must = async <T>(label: string, p: Promise<{ ok: true; data: T } | { ok: false; error: string }>): Promise<T> => {
    const r = await p;
    if (!r.ok) throw new Error(`seed: ${label}: ${r.error}`);
    return r.data;
  };
  token = (await must("login", call(api.POST("/auth/login", { body: { email: "admin@demo.local", password: DEMO_PASSWORD } }), "login"))).token;

  const users: Record<string, string> = { "admin@demo.local": "demo-admin" };
  for (const s of DEMO_STAFF.slice(1)) {
    const u = await must(`user ${s.email}`, call(api.POST("/users", { body: { name: s.name, email: s.email, password: DEMO_PASSWORD, role: s.role } }), "user"));
    users[s.email] = u.id;
    if (s.functions.length) {
      await must(`functions ${s.email}`, call(api.PATCH("/users/{id}/functions", { params: { path: { id: u.id } }, body: { functions: s.functions } }), "functions"));
    }
  }

  for (const [zone, labels] of [["RESTAURANT", ["1", "2", "3", "4", "5", "6"]], ["BAR", ["B1", "B2"]], ["POOL", ["P1"]], ["SPA", ["Spa 1", "Spa 2"]]] as const) {
    for (const label of labels) {
      await must(`table ${label}`, call(api.POST("/tables", { body: { zone, label, capacity: zone === "SPA" ? 1 : 4 } }), "table"));
    }
  }

  const menu: [string, string, "KITCHEN" | "BAR" | "SPA", number, number?][] = [
    ["Pad Thai", "Mains", "KITCHEN", 220],
    ["Green curry", "Mains", "KITCHEN", 260],
    ["Som tam", "Starters", "KITCHEN", 150],
    ["Mango sticky rice", "Desserts", "KITCHEN", 140],
    ["Chang beer", "Drinks", "BAR", 110],
    ["Mojito", "Cocktails", "BAR", 250],
    ["Fresh coconut", "Drinks", "BAR", 90],
    ["Thai massage 60 min", "Massage", "SPA", 900, 60],
    ["Aroma oil massage 90 min", "Massage", "SPA", 1400, 90],
  ];
  for (const [name, category, department, price, durationMinutes] of menu) {
    await must(`menu ${name}`, call(api.POST("/menu", { body: { name, description: "", category, department, price, isAvailable: true, durationMinutes } }), "menu"));
  }

  const room = await must("room", call(api.POST("/rooms", { body: { name: "Garden Villa", description: "Demo villa for local testing", capacity: 3, basePrice: 3500 } }), "room"));
  const units = [];
  for (const label of ["101", "102", "103"]) {
    units.push(await must(`unit ${label}`, call(api.POST("/room-units", { body: { roomId: room.id, label } }), "unit")));
  }

  // A guest account plus a checked-in stay under the same email, so room service works at once.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
  const plus = (days: number) => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };
  const booking = await must(
    "booking",
    call(
      api.POST("/bookings/staff", {
        body: { roomId: room.id, roomUnitId: units[0]!.id, guestName: DEMO_GUEST.name, guestEmail: DEMO_GUEST.email, guestPhone: "+66 80 000 0000", checkIn: today, checkOut: plus(3), channel: "DIRECT", adults: 2 },
      }),
      "booking",
    ),
  );
  // Confirmed before arrival, as at the front desk - the POS only charges a CONFIRMED/PAID stay.
  await must("confirm", call(api.PATCH("/bookings/{id}", { params: { path: { id: booking.id } }, body: { status: "CONFIRMED" } }), "confirm"));
  await must("check-in", call(api.POST("/bookings/{id}/check-in", { params: { path: { id: booking.id } } }), "check-in"));
  const guestHash = bcrypt.hashSync(DEMO_PASSWORD, 12);
  psql(`INSERT INTO "GuestAccount" (id, email, "passwordHash", name, "emailVerifiedAt", "unsubscribeToken")
        VALUES ('demo-guest', '${DEMO_GUEST.email}', '${guestHash}', '${DEMO_GUEST.name}', now(), gen_random_uuid()::text);`);
  psql(`UPDATE "GuestAccount" SET "guestId" = (SELECT "guestId" FROM "Booking" WHERE id = '${booking.id}') WHERE id = 'demo-guest';`, true);

  // A spa appointment today so the grid isn't empty.
  const spa = await must("spa schedule", call(api.GET("/spa-appointments", { params: { query: { date: today } } }), "spa"));
  const treatments = (await must("menu", call(api.GET("/menu"), "menu"))).filter((m) => m.department === "SPA");
  if (spa.tables[0] && treatments[0]) {
    await must(
      "spa appointment",
      call(
        api.POST("/spa-appointments", {
          body: { bookingId: booking.id, tableId: spa.tables[0].id, therapistUserId: users["therapist@demo.local"]!, treatmentMenuItemId: treatments[0].id, date: today, startTime: "14:00" },
        }),
        "spa",
      ),
    );
  }
}

async function main() {
  await startDatabase();
  const backend = await startBackend();
  await seed();

  const ip = lanAddress();
  console.log(`
Dev backend is up.
  API for the phone:  http://${ip ?? "<this computer's Wi-Fi IP>"}:${API_PORT}/api
  API on this machine: ${LOCAL_API}

Logins (password for all: ${DEMO_PASSWORD})
  Staff app:  ${DEMO_STAFF.map((s) => `${s.email} (${s.role}${s.functions.length ? `, ${s.functions.join("/")}` : ""})`).join("\n              ")}
  Guest app:  ${DEMO_GUEST.email} - checked in, so room service works

Now, in another terminal:  npm run staff   or   npm run guest
Ctrl+C here stops the backend.`);

  const stop = () => {
    backend.kill("SIGTERM");
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  await new Promise(() => undefined);
}

main().catch((e) => {
  console.error(`\n${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
