#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

cd "$ROOT_DIR"
export COBALT_API_URL="${COBALT_API_URL:-http://localhost:9000}"
export COBALT_API_KEY="${COBALT_API_KEY:-}"
export PUBLIC_APP_URL="${PUBLIC_APP_URL:-http://localhost:3000}"

exec_turbo run dev --filter=@imediasave/web
