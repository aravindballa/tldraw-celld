# Image that builds the client and runs `celld deploy`, which bundles the
# worker with esbuild and uploads code + static assets to the fleet bucket.
# Serving nodes run the stock ghcr.io/denoland/celld image.
ARG CELLD_VERSION=v0.6.3

FROM ghcr.io/denoland/celld:${CELLD_VERSION} AS celld

FROM node:22-bookworm-slim
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
COPY --from=celld /usr/local/bin/celld /usr/local/bin/celld
ENV CELLD_ESBUILD=/app/node_modules/.bin/esbuild
ENTRYPOINT ["celld", "deploy", "."]
