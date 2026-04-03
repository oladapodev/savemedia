#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

if [[ -z "${PROJECT_ID}" || -z "${REGION}" ]]; then
  echo "gcloud project or run region is not configured." >&2
  exit 1
fi

run_gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com \
  cloudresourcemanager.googleapis.com \
  serviceusage.googleapis.com

if ! run_gcloud artifacts repositories describe "$ARTIFACT_REPO" --location="$REGION" >/dev/null 2>&1; then
  run_gcloud artifacts repositories create "$ARTIFACT_REPO" \
    --repository-format=docker \
    --location="$REGION" \
    --description="iMediaSave Docker images"
fi

echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Artifact repo: $ARTIFACT_REPO"
