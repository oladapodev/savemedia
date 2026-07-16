#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_BIN="${NODE_BIN:-$(command -v node || true)}"
if [[ -z "$NODE_BIN" && -d "$HOME/.nvm/versions/node" ]]; then
  NODE_BIN="$(find "$HOME/.nvm/versions/node" -path '*/bin/node' -type f -print 2>/dev/null | sort -V | tail -n 1)"
fi
NODE_DIR="${NODE_DIR:-$(dirname "${NODE_BIN:-/usr/bin/node}")}"
BUN_BIN="${BUN_BIN:-$(command -v bun || true)}"
if [[ -z "$BUN_BIN" ]]; then
  BUN_BIN="$HOME/.bun/bin/bun"
fi
BUN_DIR="${BUN_DIR:-$(dirname "$BUN_BIN")}"
TURBO_BIN="${TURBO_BIN:-$ROOT_DIR/node_modules/.bin/turbo}"
GCLOUD_BIN="${GCLOUD_BIN:-$(command -v gcloud || true)}"
GH_BIN="${GH_BIN:-$(command -v gh || true)}"
PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"
REGION="${REGION:-$(gcloud config get-value run/region 2>/dev/null || true)}"
ARTIFACT_REPO="${ARTIFACT_REPO:-imediasave}"
API_IMAGE_NAME="${API_IMAGE_NAME:-api}"
WEB_IMAGE_NAME="${WEB_IMAGE_NAME:-web}"
API_SERVICE_NAME="${API_SERVICE_NAME:-imediasave-api}"
WEB_SERVICE_NAME="${WEB_SERVICE_NAME:-imediasave-web}"
API_KEYS_SECRET_NAME="${API_KEYS_SECRET_NAME:-imediasave-api-keys}"
WEB_API_KEY_SECRET_NAME="${WEB_API_KEY_SECRET_NAME:-imediasave-web-api-key}"
API_COOKIES_SECRET_NAME="${API_COOKIES_SECRET_NAME:-imediasave-api-cookies}"
API_PUBLIC_URL="${API_PUBLIC_URL:-}"
WEB_PUBLIC_URL="${WEB_PUBLIC_URL:-}"

export PATH="$BUN_DIR:$NODE_DIR:$PATH"

require_binary() {
  local path="$1"
  local name="$2"

  if [[ ! -x "$path" ]]; then
    echo "Missing $name binary at $path" >&2
    exit 1
  fi
}

run_bun() {
  require_binary "$BUN_BIN" "bun"
  "$BUN_BIN" "$@"
}

run_node() {
  require_binary "$NODE_BIN" "node"
  "$NODE_BIN" "$@"
}

run_turbo() {
  require_binary "$TURBO_BIN" "turbo"
  run_bun "$TURBO_BIN" "$@"
}

exec_turbo() {
  require_binary "$BUN_BIN" "bun"
  require_binary "$TURBO_BIN" "turbo"
  exec "$BUN_BIN" "$TURBO_BIN" "$@"
}

run_gcloud() {
  require_binary "$GCLOUD_BIN" "gcloud"
  "$GCLOUD_BIN" "$@"
}

run_gh() {
  require_binary "$GH_BIN" "gh"
  "$GH_BIN" "$@"
}

secret_exists() {
  run_gcloud secrets describe "$1" >/dev/null 2>&1
}

artifact_host() {
  echo "${REGION}-docker.pkg.dev"
}

api_image_ref() {
  echo "$(artifact_host)/${PROJECT_ID}/${ARTIFACT_REPO}/${API_IMAGE_NAME}:latest"
}

web_image_ref() {
  echo "$(artifact_host)/${PROJECT_ID}/${ARTIFACT_REPO}/${WEB_IMAGE_NAME}:latest"
}

runtime_service_account() {
  local project_number
  project_number="$(run_gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
  echo "${project_number}-compute@developer.gserviceaccount.com"
}

normalize_origin_url() {
  local value="${1:-}"
  if [[ -z "$value" ]]; then
    return 0
  fi

  printf '%s' "${value%/}"
}

normalize_api_url() {
  local value
  value="$(normalize_origin_url "${1:-}")"
  if [[ -z "$value" ]]; then
    return 0
  fi

  printf '%s/' "$value"
}
