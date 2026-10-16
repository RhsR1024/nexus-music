#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/environment.sh
if test -n "${ENTRY_FILE:-}"; then echo 'Device archive requires the production entry; unset ENTRY_FILE.' >&2; exit 1; fi
mkdir -p build/distribution build/logs
node scripts/build-manifest.mjs
xcodebuild -workspace ios/app.xcworkspace -scheme app -configuration Release \
  -sdk iphoneos -destination 'generic/platform=iOS' \
  -derivedDataPath build/DeviceDerivedData -archivePath build/distribution/NexusMusic.xcarchive \
  ENTRY_FILE="$PWD/index.ts" CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY='' archive
app_bundle="$PWD/build/distribution/NexusMusic.xcarchive/Products/Applications/app.app"
test -d "$app_bundle"
node scripts/verify-archive.mjs
ipa_directory=$(mktemp -d "$PWD/build/ipa.XXXXXX")
trap 'rm -rf "$ipa_directory"' EXIT
mkdir "$ipa_directory/Payload"
/usr/bin/ditto --norsrc --noextattr "$app_bundle" "$ipa_directory/Payload/app.app"
ipa_output="$PWD/build/distribution/NexusMusic-unsigned.ipa"
if test -f "$ipa_output"; then rm "$ipa_output"; fi
cd "$ipa_directory"
/usr/bin/zip -q -r "$ipa_output" Payload
cd "$(dirname "$ipa_output")"
/usr/bin/shasum -a 256 "$(basename "$ipa_output")" > NexusMusic-unsigned.ipa.sha256
cat NexusMusic-unsigned.ipa.sha256
