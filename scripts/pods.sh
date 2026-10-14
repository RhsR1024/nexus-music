#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
source /Users/ningli/WorkSpace/Tools/env.sh
cd ios
pod install
