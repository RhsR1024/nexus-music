#!/bin/bash
# Source from build scripts. CI owns its toolchain; local Tools remains optional.
nexus_repository=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
nexus_tools_env="${NEXUS_TOOLS_ENV:-$(dirname "$nexus_repository")/Tools/env.sh}"
if [ "${CI:-}" != "true" ] && [ -f "$nexus_tools_env" ]; then
  nexus_requested_developer_dir="${DEVELOPER_DIR:-}"
  source "$nexus_tools_env"
  if [ -n "$nexus_requested_developer_dir" ]; then export DEVELOPER_DIR="$nexus_requested_developer_dir"; fi
fi
export NODE_BINARY="$(command -v node)"
