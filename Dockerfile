FROM mirror.gcr.io/library/node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml /app/
COPY api/package.json /app/api/package.json
COPY packages/version-info/package.json /app/packages/version-info/package.json
RUN apk add --no-cache python3 make g++
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --prod --filter @imput/cobalt-api... --no-frozen-lockfile

FROM deps AS build
WORKDIR /app
COPY api /app/api
COPY packages/version-info /app/packages/version-info
RUN pnpm deploy --filter=@imput/cobalt-api --prod /prod/api

FROM base AS api
WORKDIR /app

COPY --from=build --chown=node:node /prod/api /app

USER node

EXPOSE 9000
CMD [ "node", "src/cobalt" ]
