#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/environment.sh
mkdir -p build/logs
xcrun swiftc -swift-version 5 -framework JavaScriptCore scripts/probe-lx.swift -o build/lx-probe
python3 scripts/probe-lx.py "$@"
