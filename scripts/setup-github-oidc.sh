#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

GITHUB_REPOSITORY_SLUG="${GITHUB_REPOSITORY_SLUG:-}"
GITHUB_REPOSITORY_ID="${GITHUB_REPOSITORY_ID:-}"
GITHUB_WIF_POOL="${GITHUB_WIF_POOL:-github-actions}"
GITHUB_WIF_PROVIDER="${GITHUB_WIF_PROVIDER:-imediasave}"
GITHUB_DEPLOYER_SERVICE_ACCOUNT_NAME="${GITHUB_DEPLOYER_SERVICE_ACCOUNT_NAME:-github-actions-deployer}"
GITHUB_ENVIRONMENT_NAME="${GITHUB_ENVIRONMENT_NAME:-production}"
API_KEY_VALUE="${API_KEY_VALUE:-}"
ATTRIBUTE_MAPPING="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_id=assertion.repository_id,attribute.repository_owner=assertion.repository_owner,attribute.ref=assertion.ref"
ATTRIBUTE_CONDITION_TEMPLATE="assertion.repository_id=='%s'"

ensure_gh_auth() {
  if ! run_gh auth status >/dev/null 2>&1; then
    echo "GitHub CLI is not authenticated. Run 'gh auth login' and try again." >&2
    exit 1
  fi
}

require_repo_admin() {
  local permission
  permission="$(run_gh repo view "$GITHUB_REPOSITORY_SLUG" --json viewerPermission --jq '.viewerPermission' 2>/dev/null || true)"

  if [[ "$permission" != "ADMIN" ]]; then
    cat >&2 <<EOF
GitHub CLI needs admin access to configure repository secrets and variables.

Repository: ${GITHUB_REPOSITORY_SLUG}
Current permission: ${permission:-unknown}

Log into GitHub with an admin account for this repository, then rerun:
  ./scripts/setup-github-oidc.sh
EOF
    exit 1
  fi
}

derive_repo_slug() {
  local remote_url
  remote_url="$(git -C "$ROOT_DIR" remote get-url origin 2>/dev/null || true)"

  if [[ "$remote_url" =~ github.com[:/]([^/]+/[^/.]+)(\.git)?$ ]]; then
    echo "${BASH_REMATCH[1]}"
    return 0
  fi

  local slug
  slug="$(run_gh repo view --json nameWithOwner --jq '.nameWithOwner' 2>/dev/null || true)"
  if [[ -n "$slug" ]]; then
    echo "$slug"
    return 0
  fi

  echo "Could not determine GitHub repository from origin remote." >&2
  exit 1
}

fetch_repo_id() {
  local slug="$1"
  run_gh api "repos/${slug}" --jq '.id'
}

grant_project_role() {
  local member="$1"
  local role="$2"

  run_gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="$member" \
    --role="$role" >/dev/null
}

upsert_repo_variable() {
  local name="$1"
  local value="$2"

  run_gh variable set "$name" \
    --body "$value" \
    --repo "$GITHUB_REPOSITORY_SLUG" >/dev/null
}

upsert_repo_secret() {
  local name="$1"
  local value="$2"

  run_gh secret set "$name" \
    --body "$value" \
    --repo "$GITHUB_REPOSITORY_SLUG" >/dev/null
}

ensure_environment() {
  run_gh api \
    --method PUT \
    "repos/${GITHUB_REPOSITORY_SLUG}/environments/${GITHUB_ENVIRONMENT_NAME}" >/dev/null
}

ensure_gh_auth

if [[ -z "$GITHUB_REPOSITORY_SLUG" ]]; then
  GITHUB_REPOSITORY_SLUG="$(derive_repo_slug)"
fi

require_repo_admin

"$ROOT_DIR/scripts/gcp-setup.sh"

run_gcloud services enable \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com \
  cloudresourcemanager.googleapis.com >/dev/null

if [[ -z "$GITHUB_REPOSITORY_ID" ]]; then
  GITHUB_REPOSITORY_ID="$(fetch_repo_id "$GITHUB_REPOSITORY_SLUG")"
fi

PROJECT_NUMBER="$(run_gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
DEPLOYER_SA_EMAIL="${GITHUB_DEPLOYER_SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
WIF_PROVIDER_RESOURCE="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${GITHUB_WIF_POOL}/providers/${GITHUB_WIF_PROVIDER}"
WIF_PRINCIPAL="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${GITHUB_WIF_POOL}/attribute.repository_id/${GITHUB_REPOSITORY_ID}"
ATTRIBUTE_CONDITION="$(printf "$ATTRIBUTE_CONDITION_TEMPLATE" "$GITHUB_REPOSITORY_ID")"

if ! run_gcloud iam service-accounts describe "$DEPLOYER_SA_EMAIL" >/dev/null 2>&1; then
  run_gcloud iam service-accounts create "$GITHUB_DEPLOYER_SERVICE_ACCOUNT_NAME" \
    --display-name="GitHub Actions deployer" >/dev/null
fi

if ! run_gcloud iam workload-identity-pools describe "$GITHUB_WIF_POOL" --location=global >/dev/null 2>&1; then
  run_gcloud iam workload-identity-pools create "$GITHUB_WIF_POOL" \
    --location=global \
    --display-name="GitHub Actions" >/dev/null
fi

if ! run_gcloud iam workload-identity-pools providers describe "$GITHUB_WIF_PROVIDER" \
  --location=global \
  --workload-identity-pool="$GITHUB_WIF_POOL" >/dev/null 2>&1; then
  run_gcloud iam workload-identity-pools providers create-oidc "$GITHUB_WIF_PROVIDER" \
    --location=global \
    --workload-identity-pool="$GITHUB_WIF_POOL" \
    --issuer-uri="https://token.actions.githubusercontent.com/" \
    --attribute-mapping="$ATTRIBUTE_MAPPING" \
    --attribute-condition="$ATTRIBUTE_CONDITION" >/dev/null
else
  run_gcloud iam workload-identity-pools providers update-oidc "$GITHUB_WIF_PROVIDER" \
    --location=global \
    --workload-identity-pool="$GITHUB_WIF_POOL" \
    --issuer-uri="https://token.actions.githubusercontent.com/" \
    --attribute-mapping="$ATTRIBUTE_MAPPING" \
    --attribute-condition="$ATTRIBUTE_CONDITION" >/dev/null
fi

run_gcloud iam service-accounts add-iam-policy-binding "$DEPLOYER_SA_EMAIL" \
  --member="$WIF_PRINCIPAL" \
  --role="roles/iam.workloadIdentityUser" >/dev/null

grant_project_role "serviceAccount:${DEPLOYER_SA_EMAIL}" "roles/run.admin"
grant_project_role "serviceAccount:${DEPLOYER_SA_EMAIL}" "roles/artifactregistry.writer"
grant_project_role "serviceAccount:${DEPLOYER_SA_EMAIL}" "roles/secretmanager.admin"

RUNTIME_SA="$(runtime_service_account)"
run_gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" \
  --member="serviceAccount:${DEPLOYER_SA_EMAIL}" \
  --role="roles/iam.serviceAccountUser" >/dev/null

if [[ -z "$API_KEY_VALUE" ]]; then
  API_KEY_VALUE="$(run_node -e 'console.log(require("node:crypto").randomUUID())')"
fi

ensure_environment

upsert_repo_variable "GCP_PROJECT_ID" "$PROJECT_ID"
upsert_repo_variable "GCP_REGION" "$REGION"
upsert_repo_variable "GCP_ARTIFACT_REPO" "$ARTIFACT_REPO"
upsert_repo_variable "GCP_API_IMAGE_NAME" "$API_IMAGE_NAME"
upsert_repo_variable "GCP_WEB_IMAGE_NAME" "$WEB_IMAGE_NAME"
upsert_repo_variable "GCP_API_SERVICE_NAME" "$API_SERVICE_NAME"
upsert_repo_variable "GCP_WEB_SERVICE_NAME" "$WEB_SERVICE_NAME"
upsert_repo_variable "GCP_API_KEYS_SECRET_NAME" "$API_KEYS_SECRET_NAME"
upsert_repo_variable "GCP_WEB_API_KEY_SECRET_NAME" "$WEB_API_KEY_SECRET_NAME"
upsert_repo_variable "GCP_API_COOKIES_SECRET_NAME" "$API_COOKIES_SECRET_NAME"
upsert_repo_secret "GCP_WORKLOAD_IDENTITY_PROVIDER" "$WIF_PROVIDER_RESOURCE"
upsert_repo_secret "GCP_SERVICE_ACCOUNT" "$DEPLOYER_SA_EMAIL"
upsert_repo_secret "IMEDIASAVE_API_SHARED_KEY" "$API_KEY_VALUE"

if [[ -n "${IMEDIASAVE_COOKIES_JSON:-}" ]]; then
  upsert_repo_secret "IMEDIASAVE_COOKIES_JSON" "$IMEDIASAVE_COOKIES_JSON"
fi

cat <<EOF
GitHub OIDC bootstrap complete.

Repository:
  slug: ${GITHUB_REPOSITORY_SLUG}
  id: ${GITHUB_REPOSITORY_ID}

Workload Identity Provider:
  ${WIF_PROVIDER_RESOURCE}

Service account:
  ${DEPLOYER_SA_EMAIL}

GitHub repository variables synced:
  GCP_PROJECT_ID=${PROJECT_ID}
  GCP_REGION=${REGION}
  GCP_ARTIFACT_REPO=${ARTIFACT_REPO}
  GCP_API_IMAGE_NAME=${API_IMAGE_NAME}
  GCP_WEB_IMAGE_NAME=${WEB_IMAGE_NAME}
  GCP_API_SERVICE_NAME=${API_SERVICE_NAME}
  GCP_WEB_SERVICE_NAME=${WEB_SERVICE_NAME}
  GCP_API_KEYS_SECRET_NAME=${API_KEYS_SECRET_NAME}
  GCP_WEB_API_KEY_SECRET_NAME=${WEB_API_KEY_SECRET_NAME}
  GCP_API_COOKIES_SECRET_NAME=${API_COOKIES_SECRET_NAME}

GitHub repository secrets synced:
  GCP_WORKLOAD_IDENTITY_PROVIDER
  GCP_SERVICE_ACCOUNT
  IMEDIASAVE_API_SHARED_KEY

GitHub environment ready:
  ${GITHUB_ENVIRONMENT_NAME}

Optional secret synced when provided:
  IMEDIASAVE_COOKIES_JSON
EOF
