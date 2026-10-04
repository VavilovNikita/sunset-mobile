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
# guest app only - NEVER in apps/staff, it would replace the VPS update URL with Expo's:
eas update:configure               # writes the EAS Update URL into app.json
eas env:set production --name EXPO_PUBLIC_API_BASE_URL --value https://sunsetsamui.com/api --visibility plaintext
# guest app only:
eas env:set production --name EXPO_PUBLIC_SITE_ORIGIN --value https://sunsetsamui.com --visibility plaintext
```

Commit the `app.json` changes these commands make. In `apps/staff`, check afterwards that
`expo.updates.url` is still `https://sunsetsamui.com/mobile/staff/updates/manifest`.

## Staff app - Android, from our own VPS

No Play Store and no Expo update servers: the APK and every update are files on the VPS
(`deploy/nginx-mobile.conf`, served from `/var/www/sunset-mobile`). EAS is used only to compile the
APK. Uploads go over ssh: set `SUNSET_VPS=user@host` (key login) on the machine you release from.

**One-time, on the VPS:** install `deploy/nginx-mobile.conf` as its header describes.

**A new installable version** (first install, or after a native change):

```bash
npm run release -- bump staff            # versionCode + 1; add --native after a native change
git commit -am "staff: version bump" && git push
cd apps/staff && eas build -p android --profile production   # prints a link to the .apk
cd ../.. && npm run release -- apk staff <that link or the downloaded .apk>
```

The script prints the install link (`https://sunsetsamui.com/mobile/staff/android/...apk`) - open
it on a phone to install. Phones that already have the app see "A new version is available" on the
home screen and download it from there.

**A code update** (screens, logic - most changes):

```bash
npm run release -- update staff
```

Installed phones of the same app version download it in the background at launch and offer
"Restart to update" (or take it on the next start). Native changes - a new Expo module, a
permission, an Expo SDK upgrade - can't ship this way: bump with `--native`, build, publish the APK.
The app version is the update channel (`runtimeVersion.policy: appVersion`), so a phone never gets
JavaScript built for different native code.

**iPhone** stays on TestFlight: `eas build -p ios --profile production`, then
`eas submit -p ios --latest` (Apple Developer account needed). The VPS update endpoint answers iOS
with "no update".

### When a phone doesn't pick up an update

The bottom of the home screen says `Version 0.1.0 (1)` while it runs the APK's own code and adds
`· update <id>` once an update is running. If a published update never shows up, read what
expo-updates itself says (Android SDK's adb, phone or emulator connected):

```
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb logcat -c
& $adb logcat -s dev.expo.updates:*
```

then reopen the app. `Failed to download asset from URL …` names the file; one failed file
discards the whole update. Check that URL with `curl.exe -sI`. The first release hit both of
these, in this order:
- 403 from nginx: a directory uploaded without read permission for www-data (`release.ts` now
  runs `chmod -R a+rX` after every upload).
- 403 with `cf-cache-status: HIT`: Cloudflare kept a cached error after the server was fixed.
  Purge those URLs (Cloudflare → Caching → Configuration → Purge Cache). `nginx-mobile.conf` now
  sends errors as `404 no-store`, so this shouldn't recur.

## Guest app

For real guests it has to be in the stores.

- `--profile preview` - test builds: an Android `.apk` link and an iOS build for TestFlight.
- `--profile production` - store builds (`.aab` for Google Play, iOS for the App Store), uploaded
  with `eas submit -p android|ios --latest`. Store review, listings and privacy forms are done in
  Play Console / App Store Connect.

## Guest app updates without a new build

The guest app still uses EAS Update:

```bash
eas update --channel production --environment production --message "what changed"
```

Installed builds pick it up on the next launch (one restart later). This ships JavaScript only.
A new build is needed when a native module or permission changes, or when `version` in `app.json`
is bumped - builds only take updates made for their own version (`runtimeVersion.policy:
appVersion`). Guest build numbers are kept by EAS (`appVersionSource: remote`); the staff app keeps its own in
`app.json` (`npm run release -- bump`), because the published `latest.json` has to name the same
number the APK was built with.
