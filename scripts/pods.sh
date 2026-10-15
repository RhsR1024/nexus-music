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
