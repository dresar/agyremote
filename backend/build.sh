#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST_SRC="/opt/data/home/agyremote/dist"
STAGE_DIR="${SCRIPT_DIR}/internal/static/dist"

rm -rf "${STAGE_DIR}"
mkdir -p "${STAGE_DIR}"
cp -rL "${DIST_SRC}/"* "${STAGE_DIR}/"

mkdir -p "${SCRIPT_DIR}/bin"
cd "${SCRIPT_DIR}"
CGO_ENABLED=0 go build -ldflags="-s -w" -trimpath -o "${SCRIPT_DIR}/bin/server" ./cmd/server
echo "Build complete: ${SCRIPT_DIR}/bin/server"
