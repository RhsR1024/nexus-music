#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 NODE_OPTIONS= PYTHONPATH=
source scripts/android-env.sh

variant="${1:-Debug}"
shift || true
case "$variant" in
  Debug|debug)
    gradle_task="assembleDebug"
    apk_dir="debug"
    ;;
  Release|release)
    gradle_task="assembleRelease"
    apk_dir="release"
    ;;
  *)
    echo "Usage: $0 [Debug|Release] [extra gradle args...]" >&2
    exit 2
    ;;
esac

link_external_dir() {
  local local_path="$1"
  local external_path="$2"
  mkdir -p "$external_path"
  if [ -L "$local_path" ]; then
    return 0
  fi
  if [ -d "$local_path" ]; then
    rm -rf "$local_path"
  fi
  mkdir -p "$(dirname "$local_path")"
  ln -s "$external_path" "$local_path"
}

if [ "${CI:-}" != "true" ]; then
  cat > android/local.properties <<EOF
sdk.dir=$ANDROID_HOME
EOF
  # Redirect heavy intermediate build outputs to the T7 Touch APFS sparsebundle
  # so Mac internal storage stays untouched.
  link_external_dir "android/.gradle" "$NEXUS_ANDROID_BUILD_ROOT/dot-gradle"
  link_external_dir "android/build" "$NEXUS_ANDROID_BUILD_ROOT/root-build"
  link_external_dir "android/app/build" "$NEXUS_ANDROID_BUILD_ROOT/app-build"
  link_external_dir "modules/nexus-native/android/build" "$NEXUS_ANDROID_BUILD_ROOT/nexus-native-build"
  link_external_dir "modules/nexus-native/android/.cxx" "$NEXUS_ANDROID_BUILD_ROOT/nexus-native-cxx"
fi

pushd android >/dev/null
if [ ! -f app/debug.keystore ]; then
  keytool -genkeypair -keystore app/debug.keystore -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Debug,O=Android,C=US"
fi
chmod +x gradlew
./gradlew :nexus-native:testDebugUnitTest ":app:${gradle_task}" --no-daemon "$@"
popd >/dev/null

apk_path=$(find -L "android/app/build/outputs/apk/${apk_dir}" -maxdepth 2 -name "*.apk" | head -n 1 || true)
if [ -n "$apk_path" ] && [ -f "$apk_path" ]; then
  sha=$(git rev-parse --short HEAD 2>/dev/null || echo "local")
  stamp=$(date +%Y%m%d-%H%M%S)
  if [ "${CI:-}" != "true" ] && [ -n "${NEXUS_ANDROID_ARCHIVE_DIR:-}" ] && [ -d "$NEXUS_ANDROID_ARCHIVE_DIR" ]; then
    archive_file="$NEXUS_ANDROID_ARCHIVE_DIR/nexus-music-${apk_dir}-${stamp}-${sha}.apk"
    cp "$apk_path" "$archive_file"
    shasum -a 256 "$archive_file"
    echo "Archived APK to T7 Touch: $archive_file"
  fi
fi
