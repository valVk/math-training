# syntax=docker/dockerfile:1

# better-sqlite3 ships prebuilt musl binaries for amd64 and arm64 (Raspberry Pi), so Alpine works without compiling.
ARG NODE_IMAGE=node:24-alpine3.24
# Runtime base: must be the Alpine release the Node image is built on, so the copied node binary finds matching libraries.
ARG ALPINE_IMAGE=alpine:3.24

# ---- deps: install node_modules once, shared by the dev and build stages ----
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
# Toolchain only for the case where no prebuilt better-sqlite3 binary matches the platform.
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
# Skip the postinstall `nuxt prepare` (the source is not copied yet), then fetch or compile the native module.
RUN npm ci --ignore-scripts && npm rebuild better-sqlite3

# ---- dev: hot-reloading dev server, the source is bind-mounted by docker compose ----
FROM deps AS dev
ENV NODE_ENV=development
EXPOSE 3000
CMD ["sh", "-c", "npx nuxt prepare && npx nuxt dev --host 0.0.0.0 --port 3000"]

# ---- build: compile the production server ----
FROM deps AS build
COPY . .
RUN npx nuxt prepare && npx nuxt build \
  # better-sqlite3 bundles binaries for 8 platforms; keep only the one this image loads (linuxmusl-<arch>).
  && find .output/server/node_modules/better-sqlite3/prebuilds -type f \
     ! -name "linuxmusl-$(node -p process.arch).node" -delete

# ---- prod: plain Alpine plus the node binary and .output; no npm/yarn, build tools, source or secrets ----
FROM ${ALPINE_IMAGE} AS prod
RUN apk add --no-cache libstdc++ libgcc \
  && addgroup -g 1000 node \
  && adduser -u 1000 -G node -s /bin/sh -D node
COPY --from=deps /usr/local/bin/node /usr/local/bin/node
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    NUXT_DB_PATH=/data/math.sqlite
COPY --from=build --chown=node:node /app/.output ./.output
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/_auth/session').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", ".output/server/index.mjs"]
