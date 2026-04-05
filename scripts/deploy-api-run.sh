#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

"$ROOT_DIR/scripts/setup-cloudrun-secrets.sh"

WEB_PUBLIC_URL="$(normalize_origin_url "$WEB_PUBLIC_URL")"
API_PUBLIC_URL="$(normalize_api_url "$API_PUBLIC_URL")"
API_DEPLOY_URL="${API_PUBLIC_URL:-https://placeholder.invalid/}"
WEB_CORS_URL="${WEB_PUBLIC_URL:-https://placeholder.invalid}"
COOKIE_ENV_VARS=""
COOKIE_SECRET_FLAGS=""

if secret_exists "$API_COOKIES_SECRET_NAME"; then
  COOKIE_ENV_VARS=",COOKIE_PATH=/var/run/secrets/imediasave/cookies.json"
  COOKIE_SECRET_FLAGS=",/var/run/secrets/imediasave/cookies.json=${API_COOKIES_SECRET_NAME}:latest"
fi

run_gcloud run deploy "$API_SERVICE_NAME" \
  --image="$(api_image_ref)" \
  --region="$REGION" \
  --platform=managed \
  --allow-unauthenticated \
  --port=9000 \
  --cpu=2 \
  --memory=4Gi \
  --concurrency=2 \
  --timeout=900 \
  --set-env-vars="API_URL=${API_DEPLOY_URL},API_PORT=9000,CORS_WILDCARD=0,CORS_URL=${WEB_CORS_URL},API_AUTH_REQUIRED=1,API_KEY_URL=file:///var/run/secrets/imediasave/keys.json${COOKIE_ENV_VARS}" \
  --set-secrets="/var/run/secrets/imediasave/keys.json=${API_KEYS_SECRET_NAME}:latest${COOKIE_SECRET_FLAGS}"

if [[ -z "$API_PUBLIC_URL" ]]; then
  API_PUBLIC_URL="$(run_gcloud run services describe "$API_SERVICE_NAME" --region="$REGION" --format='value(status.url)')"
  API_PUBLIC_URL="$(normalize_api_url "$API_PUBLIC_URL")"
fi

echo "API service URL: ${API_PUBLIC_URL}"
