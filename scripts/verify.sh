#!/usr/bin/env bash
# Everything that can be checked without a device or an Expo account:
#   typecheck + unit tests in every workspace, a Metro export of both apps for iOS and Android,
#   `expo prebuild` for both platforms, and a check that neither app's bundle contains the other
#   audience's client or token key. EAS builds are deliberately not run here (owner's account).
set -euo pipefail
cd "$(dirname "$0")/.."
export EXPO_OFFLINE=1 CI=1
OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT

npm run typecheck
npm test

for app in staff guest; do
  (cd "apps/$app" && EXPO_PUBLIC_API_BASE_URL=http://localhost:8080/api EXPO_PUBLIC_SITE_ORIGIN=http://localhost:3000 \
    npx expo export --platform android --platform ios --output-dir "$OUT/$app" >/dev/null)
  (cd "apps/$app" && npx expo prebuild --no-install --platform all --clean >/dev/null)
  echo "export + prebuild ok: $app"
done

# Audience boundary: a guest build must never even link staff code, and vice versa.
check_absent() {
  local app="$1" needle="$2"
  if grep -aqr --include='*.hbc' -- "$needle" "$OUT/$app"; then
    echo "BOUNDARY VIOLATION: '$needle' found in the $app bundle" >&2
    exit 1
  fi
}
for needle in createStaffClient sunset.staff.token /auth/login /orders/{id}/close /shifts/open; do check_absent guest "$needle"; done
for needle in createGuestClient sunset.guest.token /guest-auth/login /guest/orders; do check_absent staff "$needle"; done
echo "bundle boundaries ok"
