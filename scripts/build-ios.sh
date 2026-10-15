#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/environment.sh
xcodebuild -workspace ios/app.xcworkspace -scheme app \
  -configuration Release -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath build/DerivedData CODE_SIGNING_ALLOWED=NO build
