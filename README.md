# iMediaSave Workspace

iMediaSave is a downloader product built on top of a private media-processing deployment.
This repository is organized as a workspace with a branded TanStack Start web app,
an imported processing API, and a private reference snapshot of the upstream
Svelte frontend for implementation research only.

## Workspace layout

- `api/` - imported processing API
- `packages/` - imported workspace packages
- `web/` - the iMediaSave TanStack Start app and public wrapper API
- `docs/` - operational and deployment documentation
- `cloudrun/` - example Cloud Run service manifests for the web and api services
- `reference/cobalt-web/` - non-deployed upstream frontend reference

## Public API surface

The public iMediaSave API is served by the web app:

- `POST /api/preview`
- `POST /api/download`
- `GET /api/proxy-download`
- `GET /docs/api`

The web service talks to the private processing API internally through `COBALT_API_URL` and `COBALT_API_KEY`.

## Local setup

This workspace is set up to work with direct Bun and Node binaries, plus Docker Compose for the private processing API.

```bash
make doctor
make setup
make dev
```

Use these example env files as a starting point:

- `api/.env.example`
- `web/.env.example`

## Dev commands

- `make doctor` - show the resolved Bun, Node, and Docker toolchain
- `make setup` - install workspace dependencies with Bun
- `make dev` - start the dockerized processing API and the local iMediaSave web dev server
- `make dev-web` - run only the local TanStack frontend
- `make dev-api` - run only the dockerized processing API
- `make dev-api-local` - run the processing API directly with Node
- `make lint` - run frontend ESLint
- `make typecheck` - run frontend TypeScript checks
- `make check` - run lint and typecheck together
- `make compose-up` - run the full dockerized web + api stack
- `make compose-down` - stop the full dockerized stack
- `make build` - build the iMediaSave web app
- `make preview-web` - run the built web output

## GitHub Actions deployment

This repo now includes:

- `.github/workflows/ci.yml` for checks and Docker build verification
- `.github/workflows/deploy.yml` for production Cloud Run deployment with GitHub OIDC
- `docs/github-actions-deploy.md` for the setup steps and required GitHub secrets

Bootstrap GitHub deploy access with:

```bash
make gcp-github-oidc
```

The bootstrap uses `gh` to create the repository variables and secrets that the deploy workflow needs.

## Cloud Run

Deploy the workspace as two separate Cloud Run services:

- `imediasave-api` using the repo root `Dockerfile`
- `imediasave-web` using `web/Dockerfile`

The starter manifests live in:

- `cloudrun/api.service.yaml`
- `cloudrun/web.service.yaml`

## License notes

- The imported cobalt API code in `api/` remains subject to its upstream AGPL-3.0 terms.
- The reference frontend in `reference/cobalt-web/` remains subject to cobalt web's upstream license and branding restrictions.
- iMediaSave does not ship the cobalt Svelte frontend as part of the live product.
