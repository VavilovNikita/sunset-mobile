# sunset-mobile

Native apps (Expo / React Native, TypeScript) for The Sunset Beach Resort & Spa, talking to the
`sunset` API (`github.com/VavilovNikita/sunset`). Two apps, one repo:

| | Audience | Token | Bundle id |
|---|---|---|---|
| `apps/staff` | Floor staff: POS, cash shift, printing, housekeeping, maintenance, spa, my schedule | staff JWT | `com.sunsetbeach.staff` |
| `apps/guest` | Guests: rooms + server quote + booking, account, booking history, table QR ordering, room service | guest JWT | `com.sunsetbeach.guest` |

Shared packages: `packages/api-client` (types generated from `openapi.yaml` + an audience-scoped
fetch wrapper), `packages/core` (date and money display, no network), `packages/ui` (a few RN
primitives and the palette).

## Running

You need Node 22.13 or newer (22 LTS from nodejs.org; React Native, Metro and Vitest all refuse
Node 20 - the tests fail at start with `does not provide an export named 'styleText'`), Docker (Docker Desktop is fine), Java 21, and a checkout of `sunset` next to
this one (`../sunset`, or set `SUNSET_DIR`). Then, from the repo root:

```bash
npm install            # once
npm run dev:backend    # terminal 1: local database + backend + demo data, prints the logins
npm run staff          # terminal 2: the staff app - scan the QR code with the phone
npm run guest          #   ...or the guest app
```

- **`dev:backend`** starts Postgres in Docker (`sunset-dev-db`, port 5435, localhost only), builds
  and runs the sunset backend on `:8080`, and on first run adds demo data: one account per role
  (`admin@`, `manager@`, `cashier@`, `waiter@`, plus `engineer@` and `therapist@` - all
  `@demo.local`, password `demo-pass-123`), tables, a menu, spa tables and treatments, a villa
  with three rooms, a spa booking today, and a checked-in guest with an app account
  (`guest@demo.local`, same password). `--reset` wipes the demo database, `--rebuild` rebuilds
  the backend after you pull sunset. It never touches production.
- **`staff` / `guest`** fill in the API address for you (this computer's Wi-Fi address, port 8080)
  and start Expo. The phone needs Expo Go, or a development build, on the same Wi-Fi. If the
  network blocks phone-to-computer traffic, add `-- --tunnel`. A value in `apps/<app>/.env`
  always wins over the automatic one (see `.env.example`).
- **`staff:web` / `guest:web`** open the app in this computer's browser instead - quickest way to
  look around. It's a preview, not a target: sign-in lives in memory only (a reload signs you
  out), and camera/photos need a phone.

Camera, secure storage and the image picker should be tried on a real device (Expo Go, or
`npx expo run:android|ios` / an EAS development build).

**Never point a development build at production.** There is no default API URL on purpose, and
`npm run staff|guest` refuses `sunsetsamui.com`.

## Checks

```bash
npm run check    # typecheck + unit tests in every workspace
npm run verify   # the above, plus `expo export` (iOS + Android) and `expo prebuild` for both apps,
                 # plus a check that neither bundle contains the other audience's client/token key
```

EAS builds are not configured here yet - the owner runs `eas build` with their own account.

## Updating the API types

```bash
SUNSET_SPEC=/path/to/sunset/openapi.yaml npm run sync-spec --workspace @sunset/api-client
npm run generate:api
npm run check    # the apps' typecheck shows every place the contract change matters
```

`packages/api-client/test/spec-sync.test.ts` fails if `src/schema.ts` isn't exactly what the
generator produces from the vendored spec, and (when a `sunset` checkout sits next to this repo)
if the vendored spec has drifted from sunset's.

### Against a real backend

`packages/api-client/smoke/smoke.ts` drives both clients through a whole order (first item → send →
cash close), the table-QR session until the server ends it, and the public quote. It writes data,
so it refuses anything but a local/private host and needs `SMOKE_ALLOW_WRITES=1`:

```bash
SMOKE_API_BASE_URL=http://127.0.0.1:8080/api SMOKE_EMAIL=… SMOKE_PASSWORD=… SMOKE_ALLOW_WRITES=1 \
  npm run smoke --workspace @sunset/api-client
```
