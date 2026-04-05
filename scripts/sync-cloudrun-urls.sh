#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

API_PUBLIC_URL="$(normalize_api_url "$API_PUBLIC_URL")"
WEB_PUBLIC_URL="$(normalize_origin_url "$WEB_PUBLIC_URL")"

if [[ -n "$API_PUBLIC_URL" && -n "$WEB_PUBLIC_URL" ]]; then
  echo "Configured public URLs detected; skipping post-deploy Cloud Run env sync."
  echo "API service URL: ${API_PUBLIC_URL}"
  echo "Web service URL: ${WEB_PUBLIC_URL}"
  exit 0
fi

if [[ -z "$API_PUBLIC_URL" ]]; then
  API_PUBLIC_URL="$(run_gcloud run services describe "$API_SERVICE_NAME" --region="$REGION" --format='value(status.url)')"
  API_PUBLIC_URL="$(normalize_api_url "$API_PUBLIC_URL")"
fi

if [[ -z "$WEB_PUBLIC_URL" ]]; then
  WEB_PUBLIC_URL="$(run_gcloud run services describe "$WEB_SERVICE_NAME" --region="$REGION" --format='value(status.url)')"
  WEB_PUBLIC_URL="$(normalize_origin_url "$WEB_PUBLIC_URL")"
fi

run_gcloud run services update "$API_SERVICE_NAME" \
  --region="$REGION" \
  --update-env-vars="API_URL=${API_PUBLIC_URL},CORS_URL=${WEB_PUBLIC_URL}" >/dev/null

run_gcloud run services update "$WEB_SERVICE_NAME" \
  --region="$REGION" \
  --update-env-vars="PUBLIC_APP_URL=${WEB_PUBLIC_URL},COBALT_API_URL=${API_PUBLIC_URL%/}" >/dev/null

echo "API service URL: ${API_PUBLIC_URL}"
echo "Web service URL: ${WEB_PUBLIC_URL}"
