#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_PATH="${SCRIPT_DIR}/bin/server"

if [ ! -f "${BIN_PATH}" ]; then
  bash "${SCRIPT_DIR}/build.sh"
fi

cd "${SCRIPT_DIR}"
exec "${BIN_PATH}"
