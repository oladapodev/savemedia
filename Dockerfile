FROM oven/bun:1.3.14-alpine AS deps
WORKDIR /app
COPY package.json bun.lock bunfig.toml /app/
COPY api/package.json /app/api/package.json
COPY web/package.json /app/web/package.json
COPY mobile/package.json /app/mobile/package.json
COPY packages/api-client/package.json /app/packages/api-client/package.json
COPY packages/version-info/package.json /app/packages/version-info/package.json
RUN apk add --no-cache python3 make g++
RUN --mount=type=cache,id=bun,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --production --filter @imput/cobalt-api

FROM mirror.gcr.io/library/node:24-alpine AS api
WORKDIR /app

COPY --from=deps /app/node_modules /app/node_modules
COPY --chown=node:node api /app/api
COPY --chown=node:node packages/version-info /app/packages/version-info

USER node

WORKDIR /app/api
EXPOSE 9000
CMD [ "node", "src/cobalt" ]
