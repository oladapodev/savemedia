# iMediaSave Workspace

iMediaSave is a downloader product built on top of a private media-processing deployment.
This repository is a flat Bun and Turborepo workspace with a branded TanStack Start
web app, a native-backed Expo mobile app, an imported processing API, and a private reference
snapshot of the upstream Svelte frontend for implementation research only.

## Workspace layout

- `api/` - imported processing API
- `mobile/` - Expo app for Android and iOS
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

This workspace uses Bun for dependencies, Turbo for workspace tasks, Node for the
production services, and Docker Compose for the private processing API.

```bash
make doctor
make setup
make dev
```

Use these example env files as a starting point:

- `api/.env.example`
- `web/.env.example`
- `mobile/.env.example`

## Dev commands

- `make doctor` - show the resolved Bun, Node, and Docker toolchain
- `make setup` - install workspace dependencies with Bun
- `make dev` - start the dockerized processing API and the local iMediaSave web dev server
- `make dev-web` - run only the local TanStack frontend
- `make dev-mobile` - run Expo Metro for an iMediaSave development build on a physical phone
- `make dev-api` - run only the dockerized processing API
- `make dev-api-local` - run the processing API directly with Node
- `make dev-all` - run the API container, web server, and Expo Metro together
- `make lint` - run frontend ESLint
- `make typecheck` - run workspace TypeScript checks
- `make test` - run workspace tests
- `make check` - validate the workspace, lint, type-check, and test
- `make compose-up` - run the full dockerized web + api stack
- `make compose-down` - stop the full dockerized stack
- `make build` - build the iMediaSave web app
- `make build-all` - run every available workspace build task
- `make preview-web` - run the built web output

The default test command runs deterministic product tests. The imported cobalt live-provider
suite is network-dependent and remains available separately with `bun run test:api`.

## Mobile development without an emulator

The downloader uses custom Android and iOS code for background transfers and native share
intake, so use an iMediaSave development build rather than Expo Go. Build it remotely with
EAS, install it on a physical phone, connect the phone and computer to the same network,
copy `mobile/.env.example` to `mobile/.env`, and replace the example address with the
computer's LAN address.

Create a development build without running a local emulator:

```bash
cd mobile
bunx eas-cli build --platform android --profile development
# On macOS/iPhone, use: bunx eas-cli build --platform ios --profile development
```

After installing that build, start Metro from the repository root:

```bash
bun run dev:mobile
```

Open the installed development build and connect it to Metro. A phone cannot use the
computer's `localhost`; use a LAN address such as `http://192.168.1.10:3000` or a deployed
iMediaSave web URL. The mobile app must call the public wrapper in `web/`, never the private
cobalt service on port 9000.

Native Android and iOS binaries can be built remotely with EAS from `mobile/`, so Android
Studio and a local emulator are not required:

```bash
cd mobile
bunx eas-cli build --platform android --profile preview
```

Native acceptance flows live in `mobile/maestro/`. Set their required staging media URL
environment variables, then run `maestro test mobile/maestro` against an installed build.
The flows intentionally use test media that you own or are authorized to download.
See `docs/mobile-acceptance.md` for the complete Android/iPhone release matrix.

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

Production web and Docker builds run in GitHub Actions with a larger Node heap. This keeps
the regular local workflow light on lower-memory computers.

## Cloud Run

Deploy the workspace as two separate Cloud Run services:

- `imediasave-api` using the repo root `Dockerfile`
- `imediasave-web` using `web/Dockerfile`

The starter manifests live in:

- `cloudrun/api.service.yaml`
- `cloudrun/web.service.yaml`

The mobile app is distributed separately through Expo EAS and is not a Cloud Run service.

## License notes

- The imported cobalt API code in `api/` remains subject to its upstream AGPL-3.0 terms.
- The reference frontend in `reference/cobalt-web/` remains subject to cobalt web's upstream license and branding restrictions.
- iMediaSave does not ship the cobalt Svelte frontend as part of the live product.
