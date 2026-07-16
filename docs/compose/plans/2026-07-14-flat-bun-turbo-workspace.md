# Flat Bun and Turbo Workspace Implementation Plan

> [!NOTE]
> This document may not reflect the current implementation.
> See the final report for up-to-date state:
> [Final Report](../reports/flat-bun-turbo-workspace.md)

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert iMediaSave to a flat Bun/Turborepo workspace and add a minimal Expo mobile development foundation that works with a physical phone.

**Architecture:** Keep `api/`, `web/`, `mobile/`, and `packages/` directly under the root. Bun owns installation and workspace linking, Turbo owns task orchestration, shell scripts own environment/process setup, and the mobile app calls the public API exposed by `web/` rather than cobalt.

**Tech Stack:** Bun 1.3.14, Turborepo, Expo SDK 57, React Native 0.86, React 19.2.3, TanStack Start, TypeScript, Docker, GitHub Actions.

---

### Task 1: Lock the Bun and Turbo workspace contract

**Covers:** [S2, S3]

**Files:**
- Create: `bunfig.toml`
- Create: `turbo.json`
- Modify: `package.json`
- Modify: `tsconfig.json`
- Delete: `pnpm-workspace.yaml`
- Delete: `pnpm-lock.yaml`

- [ ] **Step 1: Add a workspace metadata test before changing configuration**

Create `scripts/check-workspace.ts` to load root and workspace manifests, require Bun as the package manager, require the four flat workspace patterns, reject obsolete pnpm files, verify the mobile workspace, and verify required root scripts.

- [ ] **Step 2: Run the metadata test and confirm it fails**

Run: `bun scripts/check-workspace.ts`

Expected: FAIL because the root still declares pnpm and `mobile/`, `turbo.json`, and `bunfig.toml` do not exist.

- [ ] **Step 3: Replace the root package-manager and task configuration**

Set `packageManager` to `bun@1.3.14`, require Node 22.13+ and Bun 1.3.14+, add the `mobile` workspace, add Turbo as a root development dependency, and expose `dev:mobile`, `dev:all`, `build:all`, `test`, and `check:workspace`. Keep deployment scripts intact. Add a minimal Turbo task graph for persistent development, cached builds, and uncached validation tasks.

- [ ] **Step 4: Select the compatibility linker and remove pnpm metadata**

Create `bunfig.toml` containing:

```toml
[install]
linker = "hoisted"
```

Delete the pnpm lockfile and workspace file after no active configuration references them.

- [ ] **Step 5: Run the metadata test again**

Run: `bun scripts/check-workspace.ts`

Expected: PASS with `workspace configuration is valid`.

### Task 2: Add the minimal mobile workspace

**Covers:** [S4, S7]

**Files:**
- Create: `mobile/package.json`
- Create: `mobile/App.tsx`
- Create: `mobile/app.json`
- Create: `mobile/eas.json`
- Create: `mobile/tsconfig.json`
- Create: `mobile/.env.example`
- Modify: `.gitignore`

- [ ] **Step 1: Define the Expo workspace manifest**

Use Expo SDK 57's compatible dependency set: `expo ~57.0.0`, `react 19.2.3`, `react-native 0.86.0`, and `expo-status-bar ~57.0.0`. Add `dev`, `start`, `android`, `ios`, `typecheck`, and `doctor` scripts without any emulator-launching root command.

- [ ] **Step 2: Add one focused TypeScript application entry point**

Render a branded setup screen using React Native primitives. Read `process.env.EXPO_PUBLIC_API_URL`, normalize a trailing slash for display, and show clear physical-device guidance when the value is absent.

- [ ] **Step 3: Add minimal Expo and EAS configuration**

Set the app name and slug to iMediaSave, use `com.imediasave.app` for Android and iOS identifiers, and define development, preview, and production EAS profiles. Do not generate native `android/` or `ios/` folders.

- [ ] **Step 4: Document the mobile environment value**

Add `EXPO_PUBLIC_API_URL=http://192.168.1.10:3000` as an example and explain that it must point at the public web wrapper, not port 9000.

### Task 3: Route development through Turbo without hiding environment setup

**Covers:** [S3, S5, S7]

**Files:**
- Create: `scripts/dev-mobile.sh`
- Create: `scripts/dev-all.sh`
- Modify: `scripts/dev-web.sh`
- Modify: `scripts/dev-stack.sh`
- Modify: `scripts/check-web.sh`
- Modify: `scripts/doctor.sh`
- Modify: `Makefile`

- [ ] **Step 1: Make web and mobile helpers call filtered Turbo tasks**

Run Turbo from the repository root so it sees the full workspace graph. Preserve the existing cobalt URL and app URL defaults for web; give mobile a default local Metro process without opening Android Studio.

- [ ] **Step 2: Add the complete development helper**

Start the API container, web dev server, and Metro as separate processes. Trap `EXIT`, `INT`, and `TERM`; terminate both child processes and stop the API container before returning.

- [ ] **Step 3: Update diagnostics and Make targets**

Remove pnpm diagnostics. Report Bun, Node, Turbo, Docker, and workspace validation. Add `dev-mobile`, `dev-all`, `test`, and `build-all` Make targets while retaining existing target names.

- [ ] **Step 4: Validate task selection without starting persistent servers**

Run:

```bash
bun run check:workspace
bunx turbo run build --filter=@imediasave/web --dry-run=json
bunx turbo run dev --filter=@imediasave/mobile --dry-run=json
```

Expected: Turbo selects only the requested workspace for each command.

### Task 4: Convert container builds and CI to Bun

**Covers:** [S6, S7]

**Files:**
- Modify: `Dockerfile`
- Modify: `web/Dockerfile`
- Modify: `.dockerignore`
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/deploy.yml`

- [ ] **Step 1: Replace pnpm dependency stages**

Use `oven/bun:1.3.14-alpine` to perform frozen production installs from `bun.lock`. Copy only required workspace manifests before installation, then copy the API or web source. Retain `node:24-alpine` for both production runtime stages.

- [ ] **Step 2: Keep Cloud Run outputs unchanged**

The API image still starts `node src/cobalt` on port 9000. The web image still starts `.output/server/index.mjs` on port 3000. Existing Dockerfile paths and deployment service names remain unchanged.

- [ ] **Step 3: Extend CI validation**

Run `bun run check:workspace`, `bun run check`, `bun run mobile:doctor`, and `bun run build`. Keep Docker builds in CI rather than running them as part of the local migration verification.

- [ ] **Step 4: Prove pnpm is fully removed from active tooling**

Run: `rg -n "pnpm|pnpm-lock|pnpm-workspace" package.json bunfig.toml turbo.json Dockerfile web/Dockerfile scripts Makefile .github docker-compose.yml README.md cloudrun`

Expected: no active tooling references.

### Task 5: Update developer documentation

**Covers:** [S2, S4, S5, S6]

**Files:**
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `cloudrun/README.md`

- [ ] **Step 1: Document the flat workspace and boundaries**

List `mobile/` next to `api/` and `web/`, keep cobalt described as private processing infrastructure, and state that all clients call the public web wrapper.

- [ ] **Step 2: Add exact local commands**

Document installation, individual dev commands, the complete dev command, physical-phone setup, Expo Go/Metro behavior, EAS cloud builds, and the reason a phone cannot use the computer's `localhost`.

- [ ] **Step 3: Document verification and deployment behavior**

Explain Turbo-backed checks and note that the existing two-service Cloud Run model remains unchanged; mobile builds use EAS separately.

### Task 6: Install and verify the migrated workspace

**Covers:** [S3, S4, S5, S7]

**Files:**
- Modify: `bun.lock`

- [ ] **Step 1: Install from the root**

Run: `BUN_INSTALL=/tmp/bun-install BUN_TMPDIR=/tmp/bun-tmp /home/dev/.bun/bin/bun install`

Expected: Bun resolves all four flat workspaces, installs Turbo and Expo, and updates only `bun.lock`.

- [ ] **Step 2: Verify frozen installation**

Run: `bun install --frozen-lockfile`

Expected: success with no lockfile changes.

- [ ] **Step 3: Run lightweight repository checks**

Run:

```bash
bun run check:workspace
bun test web/src
bun run typecheck
bun run lint
bun run mobile:doctor
```

Expected: workspace validation, tests, TypeScript, lint, and Expo Doctor pass. Any pre-existing web failure is recorded with its exact command and output rather than hidden.

- [ ] **Step 4: Run the production web build**

Run: `bun run build`

Expected: TanStack Start emits `web/.output` successfully. Do not run an emulator or local Docker image build.

- [ ] **Step 5: Review the final diff without touching unrelated work**

Run: `git status --short` and `git diff --check`.

Expected: no whitespace errors; all pre-existing blog, legal, SEO, and logo changes remain present and unmodified except where dependency alignment requires a manifest change.
