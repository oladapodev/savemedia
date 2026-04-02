# AGENTS.md

This document describes the current iMediaSave workspace layout for developers and AI agents.

## Project Overview

iMediaSave is a branded downloader product built on top of a private cobalt deployment.
The public product surface is a TanStack Start app in `web/`, while the cobalt API in `api/`
handles media processing behind the scenes.

## Workspace Structure

```text
.
├── api/                    # Imported cobalt processing API
├── cloudrun/               # Example Cloud Run service manifests and deployment notes
├── docs/                   # Upstream cobalt operational documentation
├── packages/               # Upstream cobalt workspace packages
├── reference/
│   └── cobalt-web/         # Private reference snapshot of cobalt's Svelte frontend
├── web/                    # iMediaSave TanStack Start app and public wrapper API
│   ├── public/             # Public assets for the web app
│   ├── src/
│   │   ├── components/     # UI components, including the downloader and API docs embed
│   │   ├── lib/            # Platform helpers and OpenAPI spec
│   │   ├── routes/         # Pages and server routes
│   │   ├── routeTree.gen.ts
│   │   ├── router.tsx
│   │   └── styles.css
│   ├── .env.example
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── Dockerfile              # API image build for Cloud Run
├── package.json            # Workspace scripts
├── pnpm-workspace.yaml
└── README.md
```

## Public Interfaces

iMediaSave exposes these public routes from the `web/` app:

- `POST /api/preview`
- `POST /api/download`
- `GET /api/proxy-download`
- `GET /docs/api`

The public API is iMediaSave-branded and wrapper-based. Browsers should not call the cobalt API directly.

## Internal Integration

- `web/src/routes/api.download.ts` calls cobalt through `COBALT_API_URL`.
- `COBALT_API_KEY` is intended for server-to-server authentication from iMediaSave to cobalt.
- `api/` remains the upstream cobalt codebase with minimal local changes.

## Deployment Model

Deploy as two Cloud Run services:

- `imediasave-api` built from the repo root `Dockerfile`
- `imediasave-web` built from `web/Dockerfile`

Starter manifests live in `cloudrun/`.

## Local Dev

- `Makefile` is the main local entrypoint.
- `docker-compose.yml` runs the cobalt API and an optional full web+api container stack.
- `scripts/` contains Bun/Node/Docker helpers for install, local web dev, dockerized api dev, and compose flows.

## Conventions

- Keep iMediaSave-specific product logic in `web/`.
- Treat `reference/cobalt-web/` as non-deployed reference material only.
- Preserve upstream licensing and branding restrictions for imported cobalt code.
- Prefer updating the public iMediaSave wrapper API and docs together so `/docs/api` stays accurate.
