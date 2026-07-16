---
feature: flat-bun-turbo-workspace
status: delivered
specs:
  - docs/compose/specs/2026-07-14-flat-bun-turbo-workspace-design.md
plans:
  - docs/compose/plans/2026-07-14-flat-bun-turbo-workspace.md
branch: main
commits: uncommitted
---

# Flat Bun and Turbo Workspace — Final Report

## What Was Built

iMediaSave is now a flat monorepo with `api/`, `web/`, `mobile/`, and `packages/` as root-level Bun workspaces. Turborepo coordinates repeatable build, lint, type-check, test, and development tasks without adding an `apps/` nesting layer. The previous pnpm lockfile and workspace metadata have been removed, and `bun.lock` is the only dependency lockfile.

The new `mobile/` workspace is a minimal Expo SDK 57 TypeScript app for Android and iOS development on a physical phone. It can run through Expo Go without an emulator and is ready for remote EAS builds. Its only backend configuration is `EXPO_PUBLIC_API_URL`, which must point to the public wrapper served by `web/`; cobalt remains a private server-to-server processing service.

## Architecture

The root `package.json` owns the workspace list and exposes the stable developer commands. `turbo.json` defines the shared task graph, while `bunfig.toml` selects hoisted installation for Expo, cobalt, and Docker compatibility. `scripts/check-workspace.ts` validates the folder layout, exact commands, Turbo graph, lock metadata, executable dev helpers, and removal of active pnpm tooling.

`scripts/dev-web.sh` and `scripts/dev-mobile.sh` replace themselves with the selected Turbo process, allowing `scripts/dev-all.sh` to stop the actual long-lived web and Metro processes during cleanup. The combined workflow starts the private API container, web server, and Metro without launching an emulator.

The API and web Dockerfiles use Bun 1.3.14 for frozen filtered dependency installs and Node 24 for production execution. Cloud Run still deploys only `imediasave-api` and `imediasave-web`. GitHub Actions pin Bun 1.3.14, run workspace checks and Expo Doctor, build the web app with a larger Node heap, and verify both Docker images. Mobile binaries are built separately through EAS.

### Design Decisions

- We kept deployable folders at the repository root because the user wanted a minimal, flat tree and the existing cobalt path is easier to maintain in place.
- We chose hoisted Bun installs because the imported cobalt workspace and Expo tooling benefit from conventional module resolution and straightforward Docker copying.
- We keep cobalt's live media-provider tests opt-in because they depend on external sites; deterministic web tests remain in the default CI gate.
- We share contracts only when a real web/mobile consumer appears, avoiding empty `core`, `sdk`, or `config` packages.

## Usage

Install and validate the workspace:

```bash
bun install
bun run check
```

Run one surface:

```bash
bun run dev:web
bun run dev:api
bun run dev:mobile
```

Run API, web, and Metro together:

```bash
bun run dev:all
```

For a physical phone, copy `mobile/.env.example` to `mobile/.env`, replace the example address with the computer's LAN address or a deployed web URL, and scan Metro's QR code using Expo Go. Native preview builds can be requested from `mobile/` with:

```bash
bunx eas-cli build --platform android --profile preview
```

## Verification

- `bun run check` passes workspace validation, web linting, web and mobile TypeScript checks, and all 10 deterministic web tests.
- Expo Doctor passes all 20 checks for the SDK 57 mobile project.
- Expo's configured `expo/AppEntry` resolves successfully from the hoisted workspace.
- `bun install --frozen-lockfile --dry-run --ignore-scripts`, Turbo filtered dry runs, Bash syntax checks, YAML parsing, and `git diff --check` pass.
- The web production build completed client and SSR phases locally, then exceeded this low-memory machine's 2 GB V8 heap during the final Nitro bundle. CI and the web Docker build stage use a 4 GB Node heap for complete production proof.
- Local Docker Compose execution was not available because the installed Podman runtime has an unwritable runroot and no `crun`; Docker image builds remain enforced by CI.

## Journey Log

> Brief notes on what informed the final design. Not required reading.

- [pivot] Per-task execution left package metadata temporarily ahead of mobile, Docker, and lockfile consumers, so the tightly coupled migration was completed as one integrated batch.
- [lesson] Expo Doctor validates package compatibility but does not catch a broken application entry path; resolve the configured entry explicitly in monorepos.
- [lesson] Default monorepo tests should exclude imported live-provider suites whose results depend on external services.
- [lesson] Pin the same Bun version in local metadata, Docker, and CI to keep lockfile behavior reproducible.

## Source Materials

| File | Role | Notes |
|------|------|-------|
| `docs/compose/specs/2026-07-14-flat-bun-turbo-workspace-design.md` | Approved design | Defines the flat workspace and physical-phone constraints |
| `docs/compose/plans/2026-07-14-flat-bun-turbo-workspace.md` | Implementation plan | Executed as an integrated migration after coupling was identified |
