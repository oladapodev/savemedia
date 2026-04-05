#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

"$ROOT_DIR/scripts/push-images.sh"
"$ROOT_DIR/scripts/deploy-api-run.sh"
"$ROOT_DIR/scripts/deploy-web-run.sh"
"$ROOT_DIR/scripts/sync-cloudrun-urls.sh"

API_SERVICE_URL="$(normalize_api_url "$API_PUBLIC_URL")"
WEB_PUBLIC_URL="$(normalize_origin_url "$WEB_PUBLIC_URL")"

if [[ -z "$API_SERVICE_URL" ]]; then
  API_SERVICE_URL="$(run_gcloud run services describe "$API_SERVICE_NAME" --region="$REGION" --format='value(status.url)')"
  API_SERVICE_URL="$(normalize_api_url "$API_SERVICE_URL")"
fi

if [[ -z "$WEB_PUBLIC_URL" ]]; then
  WEB_PUBLIC_URL="$(run_gcloud run services describe "$WEB_SERVICE_NAME" --region="$REGION" --format='value(status.url)')"
  WEB_PUBLIC_URL="$(normalize_origin_url "$WEB_PUBLIC_URL")"
fi

echo "Deployed API: ${API_SERVICE_URL}"
echo "Deployed Web: ${WEB_PUBLIC_URL}"
