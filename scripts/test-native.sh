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
