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

```bash
npm install                     # once, at the repo root (npm workspaces)
cp apps/staff/.env.example apps/staff/.env   # set EXPO_PUBLIC_API_BASE_URL to a LOCAL/STAGING backend
cp apps/guest/.env.example apps/guest/.env
cd apps/staff && npx expo start  # or apps/guest
```

The apps use native modules outside Expo Go's set only through Expo's own packages, but camera,
secure storage and the image picker should still be tried in a development build on a real
device (`npx expo run:android|ios`, or an EAS development build).

**Never point a development build at production.** There is no default API URL on purpose.

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
