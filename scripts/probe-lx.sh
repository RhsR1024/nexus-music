#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
source /Users/ningli/WorkSpace/Tools/env.sh
mkdir -p build/logs
xcrun swiftc -swift-version 5 -framework JavaScriptCore scripts/probe-lx.swift -o build/lx-probe
python3 scripts/probe-lx.py "$@"
