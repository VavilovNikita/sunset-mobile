import { useEffect, useState } from "react";
import { Linking, Platform } from "react-native";
import * as Application from "expo-application";
import * as Updates from "expo-updates";
import { Body, Button, Card, colors } from "@sunset/ui";
import { apkUpdateAvailable, latestApkUrl, parseApkRelease, type ApkRelease } from "../lib/appRelease";

/**
 * Both ways a release reaches an installed Android build (RELEASING.md):
 * - a JavaScript update, downloaded in the background at launch from our VPS - offered as a restart;
 * - a new APK (needed when native code changed) - offered as a download link, installed by Android.
 * Neither shows in development (Expo Go, web), where there is nothing installed to update.
 */
export function AppUpdates() {
  const { isUpdatePending } = Updates.useUpdates();
  const [apk, setApk] = useState<ApkRelease | null>(null);

  useEffect(() => {
    if (Platform.OS !== "android" || __DEV__) return;
    const url = latestApkUrl();
    if (!url) return;
    let cancelled = false;
    // Secondary: a failed check just shows nothing, it never gets in the way of the home screen.
    fetch(url, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => !cancelled && setApk(parseApkRelease(json)))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const newApk = apk && apkUpdateAvailable(Application.nativeBuildVersion, apk) ? apk : null;
  if (newApk) {
    return (
      <Card accent={colors.amber}>
        <Body>{`A new version (${newApk.versionName}) is available.`}</Body>
        <Body muted>Download it, then open the file to install. Android may ask once to allow installs from the browser.</Body>
        <Button title="Download new version" onPress={() => void Linking.openURL(newApk.url)} />
      </Card>
    );
  }
  if (isUpdatePending && Updates.isEnabled) {
    return (
      <Card accent={colors.sea}>
        <Body>An update has been downloaded.</Body>
        <Button title="Restart to update" onPress={() => void Updates.reloadAsync()} />
      </Card>
    );
  }
  return null;
}

/** "0.1.0 (3)" plus the running update, for telling support which build a phone is on. */
export function versionLabel(): string {
  const build = Application.nativeApplicationVersion ? `${Application.nativeApplicationVersion} (${Application.nativeBuildVersion ?? "?"})` : "development";
  const update = Updates.isEnabled && !Updates.isEmbeddedLaunch && Updates.updateId ? ` · update ${Updates.updateId.slice(0, 8)}` : "";
  return `${build}${update}`;
}
