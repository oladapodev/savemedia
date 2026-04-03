FROM mirror.gcr.io/library/node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml /app/
COPY web/package.json /app/web/package.json
RUN apk add --no-cache python3 make g++
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --filter @imediasave/web... --no-frozen-lockfile

FROM deps AS build
WORKDIR /app
COPY web /app/web
RUN pnpm --filter @imediasave/web build

FROM base AS web
WORKDIR /app

COPY --from=build /app/web/.output /app/.output
COPY --from=build /app/web/package.json /app/package.json

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
