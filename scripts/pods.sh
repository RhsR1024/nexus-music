#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/environment.sh
cd ios
if [ "${CI:-}" = "true" ]; then
  mkdir -p ../build/logs
  cp Podfile.lock ../build/logs/Podfile.before.lock
  bundle exec pod install
  bundle exec ruby ../scripts/verify-pod-lock.rb ../build/logs/Podfile.before.lock Podfile.lock
else
  pod install
fi
# pod install restores default Debug prebuilt pods, while hermes-engine's swap
# marker lives outside hermes-engine/ at Pods/.last_build_configuration. Clear
# stale markers so subsequent Release builds always swap Hermes to Release.
rm -f Pods/.last_build_configuration Pods/React-Core-prebuilt/.last_build_configuration Pods/ReactNativeDependencies/.last_build_configuration
