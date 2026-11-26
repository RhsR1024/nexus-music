#!/bin/bash
# Source from Android build/test scripts.
# In CI, the runner owns JDK/Android SDK/Gradle.
# Locally, everything lives on the T7 Touch APFS sparsebundle (/Volumes/NexusAndroid)
# so Mac internal disk space is preserved.

if [ "${CI:-}" = "true" ]; then
  return 0 2>/dev/null || exit 0
fi

nexus_t7_mount="/Volumes/T7 Touch"
nexus_android_bundle="$nexus_t7_mount/NexusMusic/AndroidWorkspace/nexus-android-dev.sparsebundle"
nexus_android_vol="/Volumes/NexusAndroid"

if ! mount | grep -Fq " on $nexus_t7_mount "; then
  echo "ERROR: 外置盘 $nexus_t7_mount 未挂载，按磁盘安全规范停止写入，不回退到内盘。" >&2
  return 1 2>/dev/null || exit 1
fi

if [ ! -e "$nexus_android_bundle" ]; then
  echo "ERROR: 未找到外置 Android 映像 $nexus_android_bundle" >&2
  return 1 2>/dev/null || exit 1
fi

if ! mount | grep -Fq " on $nexus_android_vol "; then
  hdiutil attach -nobrowse "$nexus_android_bundle" >/dev/null
fi

if [ ! -w "$nexus_android_vol" ]; then
  echo "ERROR: $nexus_android_vol 不可写，请检查外置盘挂载状态。" >&2
  return 1 2>/dev/null || exit 1
fi

if [ -d "$nexus_android_vol/jdk17/Contents/Home" ]; then
  export JAVA_HOME="$nexus_android_vol/jdk17/Contents/Home"
fi

export ANDROID_HOME="$nexus_android_vol/sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export GRADLE_USER_HOME="$nexus_android_vol/gradle-home"
export NEXUS_ANDROID_BUILD_ROOT="$nexus_android_vol/build-root"
export NEXUS_ANDROID_ARCHIVE_DIR="$nexus_t7_mount/NexusMusic/BuildArchive/android"

mkdir -p "$GRADLE_USER_HOME" "$NEXUS_ANDROID_BUILD_ROOT" "$NEXUS_ANDROID_ARCHIVE_DIR"

export PATH="${JAVA_HOME:+$JAVA_HOME/bin:}$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
