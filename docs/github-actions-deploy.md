# GitHub Actions deployment

This repository is set up to deploy to Google Cloud Run from GitHub Actions using
Workload Identity Federation instead of a long-lived Google Cloud JSON key.

## What gets deployed

- `imediasave-api` from the root `Dockerfile`
- `imediasave-web` from `web/Dockerfile`

## Workflows

- `.github/workflows/ci.yml`
  - installs dependencies
  - runs lint + typecheck
  - builds the web app
  - verifies both Docker images build
- `.github/workflows/deploy.yml`
  - runs on `main` pushes or manual dispatch
  - authenticates to Google Cloud with OIDC
  - builds and pushes both images to Artifact Registry
  - syncs Cloud Run secrets
  - deploys both Cloud Run services
  - updates service URLs after deploy

## Required GitHub secrets

- `GCP_WORKLOAD_IDENTITY_PROVIDER`
  - example: `projects/123456789/locations/global/workloadIdentityPools/github-actions/providers/imediasave`
- `GCP_SERVICE_ACCOUNT`
  - example: `github-actions-deployer@imediasave.iam.gserviceaccount.com`
- `IMEDIASAVE_API_SHARED_KEY`
  - a UUID used as the server-to-server API key between the web app and the processing API

## Optional GitHub secrets

- `IMEDIASAVE_COOKIES_JSON`
  - raw JSON contents for platform cookies if you need authenticated source fetches

## Bootstrap the Google Cloud side

Run this once from your machine:

```bash
./scripts/setup-github-oidc.sh
```

The script creates or updates:

- the Artifact Registry and required Google APIs
- a GitHub deployer service account
- a workload identity pool and provider
- IAM bindings for Cloud Run deploys and Artifact Registry pushes
- the `production` GitHub environment
- the required GitHub repository variables through `gh variable set`
- the required GitHub repository secrets through `gh secret set`

Before running it, make sure `gh auth status` works for the target repository.

The deploy workflow reads these repository variables:

- `GCP_PROJECT_ID`
- `GCP_REGION`
- `GCP_ARTIFACT_REPO`
- `GCP_API_IMAGE_NAME`
- `GCP_WEB_IMAGE_NAME`
- `GCP_API_SERVICE_NAME`
- `GCP_WEB_SERVICE_NAME`
- `GCP_API_KEYS_SECRET_NAME`
- `GCP_WEB_API_KEY_SECRET_NAME`
- `GCP_API_COOKIES_SECRET_NAME`

Optional repository variables for custom domains:

- `API_PUBLIC_URL`
  - example: `https://api.isavemedia.com/`
- `WEB_PUBLIC_URL`
  - example: `https://isavemedia.com`

If you use custom domains and disable the default Cloud Run URLs, set both variables so the deploy workflow uses your public domains during the initial service deploy and skips the post-deploy URL rewrite step.

## Manual deploy

You can still deploy from your machine after the bootstrap:

```bash
make gcp-setup
make gcp-secrets
make push-images
make deploy-api
make deploy-web
make deploy-sync
```
