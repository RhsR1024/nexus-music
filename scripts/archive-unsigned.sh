#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
source /Users/ningli/WorkSpace/Tools/env.sh
mkdir -p build/distribution build/logs
xcodebuild -workspace ios/app.xcworkspace -scheme app -configuration Release \
  -sdk iphoneos -destination 'generic/platform=iOS' \
  -derivedDataPath build/DeviceDerivedData -archivePath build/distribution/NexusMusic.xcarchive \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY='' archive
app_bundle="$PWD/build/distribution/NexusMusic.xcarchive/Products/Applications/app.app"
test -d "$app_bundle"
ipa_directory=$(mktemp -d "$PWD/build/ipa.XXXXXX")
trap 'rm -rf "$ipa_directory"' EXIT
mkdir "$ipa_directory/Payload"
/usr/bin/ditto --norsrc --noextattr "$app_bundle" "$ipa_directory/Payload/app.app"
ipa_output="$PWD/build/distribution/NexusMusic-unsigned.ipa"
if test -f "$ipa_output"; then rm "$ipa_output"; fi
cd "$ipa_directory"
/usr/bin/zip -q -r "$ipa_output" Payload
/usr/bin/shasum -a 256 "$ipa_output"
