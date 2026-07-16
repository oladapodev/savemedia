# AGENTS.md

This document describes the current iMediaSave workspace layout for developers and AI agents.

## Project Overview

iMediaSave is a branded downloader product built on top of a private cobalt deployment.
The public product surfaces are a TanStack Start app in `web/` and an Expo app in `mobile/`,
while the cobalt API in `api/` handles media processing behind the scenes.

## Workspace Structure

```text
.
├── api/                    # Imported cobalt processing API
├── cloudrun/               # Example Cloud Run service manifests and deployment notes
├── docs/                   # Upstream cobalt operational documentation
├── mobile/                 # Expo Android/iOS downloader and native modules
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
├── bun.lock                # Sole workspace dependency lockfile
├── bunfig.toml             # Bun installation settings
├── package.json            # Workspace scripts
├── turbo.json              # Workspace task graph
└── README.md
```

## Public Interfaces

iMediaSave exposes these public routes from the `web/` app:

- `POST /api/preview`
- `POST /api/download`
- `GET /api/proxy-download`
- `GET /docs/api`

The public API is iMediaSave-branded and wrapper-based. Browsers and the mobile app should
not call the cobalt API directly.

## Internal Integration

- `web/src/routes/api.download.ts` calls cobalt through `COBALT_API_URL`.
- `COBALT_API_KEY` is intended for server-to-server authentication from iMediaSave to cobalt.
- `api/` remains the upstream cobalt codebase with minimal local changes.
- `mobile/` uses `EXPO_PUBLIC_API_URL` to call the public wrapper served by `web/`.
- `mobile/modules/imediasave-download/` owns platform background transfer bridges.
- `mobile/extensions/share/` owns the production iOS Share Extension source.

## Deployment Model

Deploy as two Cloud Run services:

- `imediasave-api` built from the repo root `Dockerfile`
- `imediasave-web` built from `web/Dockerfile`

Starter manifests live in `cloudrun/`.

## Local Dev

- `Makefile` is the main local entrypoint.
- Bun owns dependency installation and Turbo owns workspace task orchestration.
- `docker-compose.yml` runs the cobalt API and an optional full web+api container stack.
- `scripts/` contains Bun/Node/Docker helpers for web, mobile, API, and combined development flows.
- `bun run dev:mobile` starts Metro for a physical phone; no emulator is required.
- Custom download/share code requires an iMediaSave development build, not Expo Go.
- Run heavy Android/iOS builds through GitHub Actions or EAS on constrained machines.
- `mobile/maestro/` contains physical-device acceptance flows.

## Conventions

- Keep iMediaSave-specific product logic in `web/`.
- Keep mobile-specific UI in `mobile/`; add shared packages only when web and mobile genuinely share code.
- Keep JavaScript orchestration platform-neutral and isolate native behavior behind `mobile/src/platform/`.
- Keep the App Group and extension identifiers synchronized across app config, plugins, and Swift code.
- Treat `reference/cobalt-web/` as non-deployed reference material only.
- Preserve upstream licensing and branding restrictions for imported cobalt code.
- Prefer updating the public iMediaSave wrapper API and docs together so `/docs/api` stays accurate.
