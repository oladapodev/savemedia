#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

upsert_secret() {
  local name="$1"
  local file_path="$2"

  if secret_exists "$name"; then
    run_gcloud secrets versions add "$name" --data-file="$file_path" >/dev/null
  else
    run_gcloud secrets create "$name" \
      --replication-policy=automatic \
      --data-file="$file_path" >/dev/null
  fi
}

API_KEY_VALUE="${API_KEY_VALUE:-}"

if [[ -z "$API_KEY_VALUE" ]]; then
  API_KEY_VALUE="$(run_node -e 'console.log(require("node:crypto").randomUUID())')"
fi

cat >"$WORK_DIR/api-keys.json" <<EOF
{
  "${API_KEY_VALUE}": {
    "name": "imediasave-web",
    "limit": "unlimited",
    "allowedServices": "all"
  }
}
EOF

printf '%s' "$API_KEY_VALUE" >"$WORK_DIR/web-api-key.txt"

upsert_secret "$API_KEYS_SECRET_NAME" "$WORK_DIR/api-keys.json"
upsert_secret "$WEB_API_KEY_SECRET_NAME" "$WORK_DIR/web-api-key.txt"

if [[ -n "${IMEDIASAVE_COOKIES_JSON:-}" ]]; then
  printf '%s' "$IMEDIASAVE_COOKIES_JSON" >"$WORK_DIR/cookies.json"
  upsert_secret "$API_COOKIES_SECRET_NAME" "$WORK_DIR/cookies.json"
fi

RUNTIME_SA="$(runtime_service_account)"

run_gcloud secrets add-iam-policy-binding "$API_KEYS_SECRET_NAME" \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/secretmanager.secretAccessor" >/dev/null

run_gcloud secrets add-iam-policy-binding "$WEB_API_KEY_SECRET_NAME" \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/secretmanager.secretAccessor" >/dev/null

if secret_exists "$API_COOKIES_SECRET_NAME"; then
  run_gcloud secrets add-iam-policy-binding "$API_COOKIES_SECRET_NAME" \
    --member="serviceAccount:${RUNTIME_SA}" \
    --role="roles/secretmanager.secretAccessor" >/dev/null
fi

echo "Configured secrets:"
echo "  API keys secret: ${API_KEYS_SECRET_NAME}"
echo "  Web API key secret: ${WEB_API_KEY_SECRET_NAME}"
if secret_exists "$API_COOKIES_SECRET_NAME"; then
  echo "  API cookies secret: ${API_COOKIES_SECRET_NAME}"
fi
echo "  Runtime service account: ${RUNTIME_SA}"
