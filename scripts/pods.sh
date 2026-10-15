#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/environment.sh
cd ios
if [ "${CI:-}" = "true" ]; then
  bundle exec pod install --deployment
else
  pod install
fi
