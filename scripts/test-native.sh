#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/environment.sh
mkdir -p build/tests
node scripts/test-music-web-login-policy.mjs
node scripts/test-account-transfer-wire.mjs
xcrun swiftc -swift-version 5 modules/nexus-native/ios/LyricCueRanges.swift tests/native/LyricCueRangesTests.swift -o build/tests/native-lyric-cues
build/tests/native-lyric-cues
xcrun swiftc -O -swift-version 5 modules/nexus-native/ios/ScriptUtilities.swift tests/native/UtilitiesCLI.swift -lz -o build/tests/native-utilities
node scripts/test-native-utilities.mjs
xcrun swiftc -swift-version 5 modules/nexus-native/ios/ScriptUtilities.swift modules/nexus-native/ios/ScriptHTTP.swift modules/nexus-native/ios/ScriptRuntime.swift tests/native/RuntimeCLI.swift -framework JavaScriptCore -lz -o build/tests/native-runtime
node scripts/test-native-runtime.mjs
xcrun swiftc -swift-version 5 modules/nexus-native/ios/ScriptUtilities.swift modules/nexus-native/ios/ScriptHTTP.swift modules/nexus-native/ios/ScriptRuntime.swift tests/native/LifecycleTests.swift -framework JavaScriptCore -lz -o build/tests/native-lifecycle
build/tests/native-lifecycle
xcrun clang++ -std=c++20 -O2 tests/native/AudioDSPTests.cpp -o build/tests/native-dsp
build/tests/native-dsp
xcrun clang++ -std=c++20 -fobjc-arc -c modules/nexus-native/ios/NexusAudioDSP.mm -o build/tests/audio-dsp.o
xcrun swiftc -swift-version 5 -import-objc-header modules/nexus-native/ios/NexusAudioDSP.h modules/nexus-native/ios/AudioCache.swift modules/nexus-native/ios/LocalAudioFiles.swift modules/nexus-native/ios/PlaybackSleepTimer.swift modules/nexus-native/ios/NativePlaybackEngine.swift modules/nexus-native/ios/DAVHTTP.swift modules/nexus-native/ios/AudioResourceLoader.swift tests/native/PlaybackCLI.swift build/tests/audio-dsp.o -framework AVFoundation -framework MediaToolbox -framework MediaPlayer -framework ImageIO -framework UniformTypeIdentifiers -lc++ -o build/tests/native-playback
node scripts/test-native-playback.mjs
xcrun swiftc -swift-version 5 -import-objc-header modules/nexus-native/ios/NexusAudioDSP.h modules/nexus-native/ios/AudioCache.swift modules/nexus-native/ios/LocalAudioFiles.swift modules/nexus-native/ios/PlaybackSleepTimer.swift modules/nexus-native/ios/NativePlaybackEngine.swift modules/nexus-native/ios/DAVHTTP.swift modules/nexus-native/ios/AudioResourceLoader.swift tests/native/SystemMediaCLI.swift build/tests/audio-dsp.o -framework AVFoundation -framework MediaToolbox -framework MediaPlayer -framework ImageIO -framework UniformTypeIdentifiers -lc++ -o build/tests/native-system-media
build/tests/native-system-media
xcrun swiftc -swift-version 5 modules/nexus-native/ios/AudioCache.swift tests/native/AudioCacheTests.swift -o build/tests/native-cache
build/tests/native-cache

xcrun swiftc -swift-version 5 modules/nexus-native/ios/CoverCache.swift tests/native/CoverCacheTests.swift -framework ImageIO -framework CoreGraphics -framework UniformTypeIdentifiers -o build/tests/native-covers
build/tests/native-covers

xcrun swiftc -swift-version 5 modules/nexus-native/ios/CoverCache.swift tests/native/CoverGuardCLI.swift -framework AppKit -framework ImageIO -framework UniformTypeIdentifiers -o build/tests/native-cover-guard
build/tests/native-cover-guard "build/tests/cover-guard-$(date +%s)"

xcrun swiftc -swift-version 5 modules/nexus-native/ios/AmbientScene.swift modules/nexus-native/ios/AmbientTransition.swift tests/native/AmbientSceneTests.swift -framework CoreGraphics -o build/tests/native-ambient
build/tests/native-ambient

xcrun swiftc -swift-version 5 modules/nexus-native/ios/AmbientScene.swift modules/nexus-native/ios/MeshField.swift tests/native/MeshFieldTests.swift -framework CoreGraphics -o build/tests/native-mesh
build/tests/native-mesh

xcrun swiftc -swift-version 5 ios/NexusMusicUITests/BackgroundPixels.swift tests/native/BackgroundPixelTests.swift -framework CoreGraphics -framework ImageIO -o build/tests/native-background-pixels
build/tests/native-background-pixels

xcrun swiftc -swift-version 5 modules/nexus-native/ios/PlaybackSleepTimer.swift tests/native/SleepTimerTests.swift -o build/tests/native-sleep
build/tests/native-sleep

xcrun swiftc -swift-version 5 modules/nexus-native/ios/LocalAudioFiles.swift tests/native/LocalFilesCLI.swift -framework AVFoundation -framework ImageIO -framework UniformTypeIdentifiers -o build/tests/native-local-files
node scripts/test-local-files.mjs

xcrun swiftc -swift-version 5 modules/nexus-native/ios/DAVHTTP.swift tests/native/DAVHTTPCLI.swift -o build/tests/native-webdav-http
node scripts/test-webdav-http.mjs

xcrun swiftc -swift-version 5 modules/nexus-native/ios/DAVHTTP.swift tests/native/DAVBackupCLI.swift -o build/tests/native-webdav-backup
node scripts/test-webdav-backup.mjs

xcrun swiftc -swift-version 5 -import-objc-header modules/nexus-native/ios/NexusAudioDSP.h modules/nexus-native/ios/AudioCache.swift modules/nexus-native/ios/LocalAudioFiles.swift modules/nexus-native/ios/PlaybackSleepTimer.swift modules/nexus-native/ios/DAVHTTP.swift modules/nexus-native/ios/AudioResourceLoader.swift modules/nexus-native/ios/CoverCache.swift modules/nexus-native/ios/RemoteAudioMetadata.swift modules/nexus-native/ios/NativePlaybackEngine.swift tests/native/DAVMediaCLI.swift build/tests/audio-dsp.o -framework AVFoundation -framework MediaToolbox -framework MediaPlayer -framework ImageIO -framework UniformTypeIdentifiers -lc++ -o build/tests/native-webdav-media
node scripts/test-webdav-media.mjs

xcrun swiftc -swift-version 5 modules/nexus-native/ios/AudioURLProbe.swift tests/native/AudioProbeCLI.swift -o build/tests/native-audio-probe
node scripts/test-audio-probe.mjs

xcrun swiftc -swift-version 5 modules/nexus-native/ios/VisualAssets.swift tests/native/VisualAssetsCLI.swift -framework ImageIO -framework CoreGraphics -framework UniformTypeIdentifiers -o build/tests/native-visual-assets
build/tests/native-visual-assets

xcrun swiftc -swift-version 5 modules/nexus-native/ios/PublicMVPolicy.swift tests/native/PublicMVPolicyTests.swift -o build/tests/native-public-mv
build/tests/native-public-mv
