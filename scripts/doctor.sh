#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

echo "Root: $ROOT_DIR"
echo "Node: $NODE_BIN"
run_node --version

echo "Bun: $BUN_BIN"
run_bun --version

echo "Turbo: $TURBO_BIN"
run_turbo --version

run_bun run check:workspace

docker --version
docker compose version
docker compose config --services
