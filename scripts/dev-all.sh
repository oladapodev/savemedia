#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

cd "$ROOT_DIR"

web_pid=""
mobile_pid=""

cleanup() {
  trap - EXIT INT TERM
  [[ -n "$web_pid" ]] && kill "$web_pid" >/dev/null 2>&1 || true
  [[ -n "$mobile_pid" ]] && kill "$mobile_pid" >/dev/null 2>&1 || true
  [[ -n "$web_pid" ]] && wait "$web_pid" >/dev/null 2>&1 || true
  [[ -n "$mobile_pid" ]] && wait "$mobile_pid" >/dev/null 2>&1 || true
  docker compose stop api >/dev/null 2>&1 || true
}

trap cleanup EXIT INT TERM

docker compose up -d api
"$ROOT_DIR/scripts/dev-web.sh" &
web_pid=$!
"$ROOT_DIR/scripts/dev-mobile.sh" &
mobile_pid=$!

wait -n "$web_pid" "$mobile_pid"
