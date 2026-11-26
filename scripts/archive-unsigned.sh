#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/environment.sh
if test -n "${ENTRY_FILE:-}"; then echo 'Device archive requires the production entry; unset ENTRY_FILE.' >&2; exit 1; fi
mkdir -p build/distribution build/logs

# Keep each successful IPA as an immutable-by-content stage snapshot before a
# later archive replaces the common distribution path. The hash-named snapshot
# deduplicates no-op rebuilds and leaves retention decisions to explicit cleanup.
preserve_current_distribution() {
  local ipa="build/distribution/NexusMusic-unsigned.ipa"
  test -f "$ipa" || return 0
  local sha snapshot
  sha=$(/usr/bin/shasum -a 256 "$ipa" | /usr/bin/awk '{print $1}')
  snapshot="build/distribution-history/$sha"
  if test ! -d "$snapshot"; then
    mkdir -p "$snapshot"
    /bin/cp -p "$ipa" "$snapshot/NexusMusic-unsigned.ipa"
    test -f build/distribution/NexusMusic-unsigned.ipa.sha256 && /bin/cp -p build/distribution/NexusMusic-unsigned.ipa.sha256 "$snapshot/NexusMusic-unsigned.ipa.sha256"
    test -f build/distribution/build-manifest.json && /bin/cp -p build/distribution/build-manifest.json "$snapshot/build-manifest.json"
  fi
}
preserve_current_distribution

# Pre-sync prebuilt Hermes / React-Core / ReactNativeDependencies to Release
# BEFORE xcodebuild archive starts. This avoids both the stale
# Pods/.last_build_configuration marker bug after pod install and any race
# between Xcode ProcessXCFramework and :before_compile script phases.
repo_root="$PWD"
rn_version=$(node -p "require('./node_modules/react-native/package.json').version")
pods_root="$repo_root/ios/Pods"
if [ -d "$pods_root/hermes-engine-artifacts" ]; then
  rm -f "$pods_root/.last_build_configuration" \
        "$pods_root/React-Core-prebuilt/.last_build_configuration" \
        "$pods_root/ReactNativeDependencies/.last_build_configuration"
  (
    cd "$pods_root"
    node "$repo_root/node_modules/react-native/sdks/hermes-engine/utils/replace_hermes_version.js" -c Release -r "$rn_version" -p "$pods_root"
    if [ -d "$pods_root/ReactNativeCore-artifacts" ]; then
      node "$repo_root/node_modules/react-native/scripts/replace-rncore-version.js" -c Release -r "$rn_version" -p "$pods_root"
    fi
    if [ -d "$pods_root/ReactNativeDependencies-artifacts" ]; then
      node "$repo_root/node_modules/react-native/third-party-podspecs/replace_dependencies_version.js" -c Release -r "$rn_version" -p "$pods_root"
    fi
  )
  rm -rf build/DeviceDerivedData/Build/Intermediates.noindex/ArchiveIntermediates/app/BuildProductsPath/Release-iphoneos/XCFrameworkIntermediates/hermes-engine \
         build/DeviceDerivedData/Build/Intermediates.noindex/ArchiveIntermediates/app/BuildProductsPath/Release-iphoneos/XCFrameworkIntermediates/React-Core-prebuilt \
         build/DeviceDerivedData/Build/Intermediates.noindex/ArchiveIntermediates/app/BuildProductsPath/Release-iphoneos/XCFrameworkIntermediates/ReactNativeDependencies
fi

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
