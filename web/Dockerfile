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
    bun install --frozen-lockfile --filter @imediasave/web

FROM deps AS build
WORKDIR /app
ENV NODE_OPTIONS="--max-old-space-size=4096"
COPY web /app/web
RUN bun run --cwd web build

FROM mirror.gcr.io/library/node:24-alpine AS web
WORKDIR /app

COPY --from=build /app/web/.output /app/.output
COPY --from=build /app/web/package.json /app/package.json

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
