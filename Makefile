SHELL := /bin/bash
.DEFAULT_GOAL := help

.PHONY: help doctor setup install dev dev-web dev-api dev-api-local lint typecheck check gcp-setup gcp-docker-auth gcp-secrets gcp-github-oidc push-api push-web push-images deploy-api deploy-web deploy-sync deploy-run build build-api preview-web compose-up compose-down compose-logs

help:
	@printf "Available targets:\n"
	@printf "  make doctor          # show resolved Bun/Node/Docker toolchain\n"
	@printf "  make setup           # install workspace dependencies with Bun\n"
	@printf "  make dev             # start dockerized cobalt API and local web dev server\n"
	@printf "  make dev-web         # run only the local iMediaSave web dev server\n"
	@printf "  make dev-api         # run only the dockerized cobalt API\n"
	@printf "  make dev-api-local   # run the cobalt API directly with Node\n"
	@printf "  make lint            # run frontend eslint\n"
	@printf "  make typecheck       # run frontend TypeScript typecheck\n"
	@printf "  make check           # run lint + typecheck\n"
	@printf "  make gcp-setup       # enable APIs and create Artifact Registry for local Docker pushes\n"
	@printf "  make gcp-docker-auth # configure Docker auth for Artifact Registry\n"
	@printf "  make gcp-secrets     # create or rotate the Cloud Run API key secrets\n"
	@printf "  make gcp-github-oidc # bootstrap GitHub OIDC deploy access for this repo\n"
	@printf "  make push-api        # build and push the API image locally\n"
	@printf "  make push-web        # build and push the web image locally\n"
	@printf "  make push-images     # build and push both images locally\n"
	@printf "  make deploy-api      # deploy the API image to Cloud Run\n"
	@printf "  make deploy-web      # deploy the web image to Cloud Run\n"
	@printf "  make deploy-sync     # update the live service URLs after deployment\n"
	@printf "  make deploy-run      # push both images and deploy both services\n"
	@printf "  make build           # build the iMediaSave web app\n"
	@printf "  make preview-web     # run the built iMediaSave web output\n"
	@printf "  make compose-up      # run the full dockerized web + api stack\n"
	@printf "  make compose-down    # stop the dockerized stack\n"
	@printf "  make compose-logs    # follow docker logs for web + api\n"

doctor:
	@./scripts/doctor.sh

setup install:
	@./scripts/install.sh

dev:
	@./scripts/dev-stack.sh

dev-web:
	@./scripts/dev-web.sh

dev-api:
	@./scripts/dev-api-docker.sh

dev-api-local:
	@./scripts/dev-api-local.sh

lint:
	@./scripts/lint-web.sh

typecheck:
	@./scripts/typecheck-web.sh

check:
	@./scripts/check-web.sh

gcp-setup:
	@./scripts/gcp-setup.sh

gcp-docker-auth:
	@./scripts/gcp-docker-auth.sh

gcp-secrets:
	@./scripts/setup-cloudrun-secrets.sh

gcp-github-oidc:
	@./scripts/setup-github-oidc.sh

push-api:
	@./scripts/push-api-image.sh

push-web:
	@./scripts/push-web-image.sh

push-images:
	@./scripts/push-images.sh

deploy-api:
	@./scripts/deploy-api-run.sh

deploy-web:
	@./scripts/deploy-web-run.sh

deploy-sync:
	@./scripts/sync-cloudrun-urls.sh

deploy-run:
	@./scripts/deploy-all-run.sh

build:
	@./scripts/build-web.sh

build-api:
	@./scripts/build-api.sh

preview-web:
	@./scripts/preview-web.sh

compose-up:
	@./scripts/compose-up.sh

compose-down:
	@./scripts/compose-down.sh

compose-logs:
	@docker compose logs -f api web
