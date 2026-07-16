# Flat Bun and Turbo Workspace Design

> [!NOTE]
> This document may not reflect the current implementation.
> See the final report for up-to-date state:
> [Final Report](../reports/flat-bun-turbo-workspace.md)

## [S1] Goal

Turn iMediaSave into a complete but visually flat monorepo for the existing web app, the existing private processing API, and a new mobile app. Bun is the only workspace package manager, Turborepo coordinates repeatable tasks, and local development remains usable on a low-powered computer without an Android emulator.

## [S2] Repository shape

The repository keeps its deployable products directly at the root:

```text
api/          private cobalt processing service
web/          TanStack Start site and public wrapper API
mobile/       minimal Expo application
packages/     existing shared and upstream workspace packages
docs/         product and engineering documentation
scripts/      local development and deployment helpers
```

There is no `apps/` wrapper and no speculative empty package. Existing `api/` and `web/` paths stay intact, which keeps the migration small and preserves the imported cobalt boundary. Shared packages are added only when web and mobile have real code to share.

## [S3] Workspace tooling

The root `package.json` declares `api`, `web`, `mobile`, and `packages/*` as Bun workspaces and pins the local Bun release through `packageManager`. `bun.lock` is the only dependency lockfile. A small `bunfig.toml` selects hoisted installs for compatibility with the imported cobalt workspace, Expo tooling, and Docker copying.

Turborepo owns `build`, `lint`, `typecheck`, and `test` orchestration. Development helpers retain their environment setup and use Turbo for the web and mobile processes. Deployment-specific shell scripts and the Makefile remain because Turbo is not a deployment tool.

## [S4] Mobile foundation

`mobile/` is a minimal Expo SDK 57 TypeScript app using one `App.tsx` entry point instead of a routing framework. It contains only the files needed to start on a physical phone, type-check, and use EAS cloud builds. The first screen confirms the iMediaSave mobile workspace and reports whether `EXPO_PUBLIC_API_URL` is configured.

The mobile app talks only to the public wrapper hosted by `web/`; it never receives cobalt credentials and never calls `api/` directly. A physical phone uses a deployed wrapper URL or the computer's LAN address because phone-local `localhost` does not point to the development computer.

## [S5] Local commands

The supported root commands are:

- `bun run dev` for the existing API-container plus web workflow.
- `bun run dev:web`, `bun run dev:api`, and `bun run dev:mobile` for one service.
- `bun run dev:all` for API, web, and Expo Metro together without launching an emulator.
- `bun run check` for repository linting, type-checking, and tests.
- `bun run build` for the production web build and `bun run build:all` for every workspace build task.

The Makefile exposes matching short commands and documents that mobile development expects Expo Go or a development build on a physical device.

## [S6] Containers and automation

Both Dockerfiles install dependencies from `bun.lock` using the pinned Bun image, then retain Node for production execution. CI installs with Bun, runs the Turbo-backed checks, checks the Expo project, builds the web app, and builds the two existing Cloud Run images. Cloud Run deployment behavior and service names do not change.

The obsolete pnpm lockfile and workspace file are removed only after Docker and automation no longer reference them.

## [S7] Safety and verification

The migration must preserve the user's existing uncommitted web content and SEO changes. Verification is intentionally lightweight locally: workspace metadata checks, frozen Bun install, Turbo dry runs, focused web tests, web and mobile TypeScript checks, and Expo Doctor. Full Docker image builds remain in GitHub Actions to avoid unnecessary load on the development computer.

Failures should identify the affected workspace. Missing mobile API configuration is shown as setup guidance, not treated as a crash. Dev scripts must clean up child processes and the local API container when they exit.
