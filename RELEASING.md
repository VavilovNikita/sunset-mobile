# Releasing the apps

Builds run on Expo's EAS with the owner's own Expo (and Apple) accounts. Nothing here runs a build
or publishes anything by itself. Each app is its own EAS project: run every command below from
`apps/staff` or `apps/guest`, never from the repo root.

## Where the API address comes from

`EXPO_PUBLIC_API_BASE_URL` (and, for the guest app, `EXPO_PUBLIC_SITE_ORIGIN`) live as EAS
environment variables in the `production` environment, and every build profile reads that
environment. `eas update --environment production` reads the same variables, so a build and the
updates sent to it can't disagree about which server they talk to. A local `.env` is never used:
it is gitignored, so EAS never sees it. A build without the variable doesn't silently fall back to
anything - the app shows "Not configured".

## One-time setup (per app)

```bash
npm install -g eas-cli
eas login
cd apps/staff                      # then the same in apps/guest
eas init                           # creates the EAS project and writes its id into app.json
eas update:configure               # writes the updates URL into app.json
eas env:set production --name EXPO_PUBLIC_API_BASE_URL --value https://sunsetsamui.com/api --visibility plaintext
# guest app only:
eas env:set production --name EXPO_PUBLIC_SITE_ORIGIN --value https://sunsetsamui.com --visibility plaintext
```

Commit the `app.json` changes `eas init` and `eas update:configure` make.

## Staff app

- **Android** - `eas build -p android --profile production`. An `.apk` you install straight from
  the link EAS prints; send the same link to staff. No Play Store.
- **iPhone** - needs an Apple Developer account. `eas build -p ios --profile production`, then
  `eas submit -p ios --latest` uploads it to TestFlight. Staff install TestFlight and join by
  invitation (App Store Connect → TestFlight). A TestFlight build expires after 90 days - make a
  new build before then.

## Guest app

For real guests it has to be in the stores.

- `--profile preview` - test builds: an Android `.apk` link and an iOS build for TestFlight.
- `--profile production` - store builds (`.aab` for Google Play, iOS for the App Store), uploaded
  with `eas submit -p android|ios --latest`. Store review, listings and privacy forms are done in
  Play Console / App Store Connect.

## Updates without a new build

```bash
eas update --channel production --environment production --message "what changed"
```

Installed builds pick it up on the next launch (one restart later). This ships JavaScript only.
A new build is needed when a native module or permission changes, or when `version` in `app.json`
is bumped - builds only take updates made for their own version (`runtimeVersion.policy:
appVersion`). Build numbers are kept by EAS (`appVersionSource: remote`, `autoIncrement`).
