#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
source /Users/ningli/WorkSpace/Tools/env.sh
mkdir -p build/tests
xcrun swiftc -swift-version 5 modules/nexus-native/ios/ScriptUtilities.swift tests/native/UtilitiesCLI.swift -lz -o build/tests/native-utilities
node scripts/test-native-utilities.mjs
xcrun swiftc -swift-version 5 modules/nexus-native/ios/ScriptUtilities.swift modules/nexus-native/ios/ScriptHTTP.swift modules/nexus-native/ios/ScriptRuntime.swift tests/native/RuntimeCLI.swift -framework JavaScriptCore -lz -o build/tests/native-runtime
node scripts/test-native-runtime.mjs
xcrun swiftc -swift-version 5 modules/nexus-native/ios/ScriptUtilities.swift modules/nexus-native/ios/ScriptHTTP.swift modules/nexus-native/ios/ScriptRuntime.swift tests/native/LifecycleTests.swift -framework JavaScriptCore -lz -o build/tests/native-lifecycle
build/tests/native-lifecycle
xcrun clang++ -std=c++20 -O2 tests/native/AudioDSPTests.cpp -o build/tests/native-dsp
build/tests/native-dsp
xcrun clang++ -std=c++20 -fobjc-arc -c modules/nexus-native/ios/NexusAudioDSP.mm -o build/tests/audio-dsp.o
xcrun swiftc -swift-version 5 -import-objc-header modules/nexus-native/ios/NexusAudioDSP.h modules/nexus-native/ios/AudioCache.swift modules/nexus-native/ios/NativePlaybackEngine.swift modules/nexus-native/ios/AudioResourceLoader.swift tests/native/PlaybackCLI.swift build/tests/audio-dsp.o -framework AVFoundation -framework MediaToolbox -framework MediaPlayer -lc++ -o build/tests/native-playback
node scripts/test-native-playback.mjs
xcrun swiftc -swift-version 5 modules/nexus-native/ios/AudioCache.swift tests/native/AudioCacheTests.swift -o build/tests/native-cache
build/tests/native-cache
