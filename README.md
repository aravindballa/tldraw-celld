# tldraw sync on celld

Self-hosted port of tldraw's [sync-cloudflare template](https://github.com/tldraw/tldraw/tree/main/templates/sync-cloudflare). It runs on [celld](https://github.com/denoland/celld) instead of Cloudflare.

- Each room is a Durable Object (a celld "cell") with its own SQLite DB.
- Uploads go to an R2 binding, which celld stores in the same bucket.
- All durable state (rooms, uploads, deployed code) lives in one S3-compatible bucket.
- Local node disk is only a cache. You can wipe it or move hosts.

## Self-host with Docker Compose

```sh
cp .env.example .env    # set S3_SECRET_KEY to something random
docker compose up -d --build
```

Open http://localhost:8080. `/` sends you to a new room. Share the URL to collaborate.

Services:

| service | role |
| --- | --- |
| `seaweedfs` | bundled S3 store (profile `local-s3`, on by default via `.env`) |
| `create-bucket` | one-shot, creates the bucket, idempotent |
| `deploy` | one-shot, builds the client and runs `celld deploy` into the bucket |
| `celld` | serving node, `ghcr.io/denoland/celld` |

### Domain and HTTPS

celld serves plain HTTP on `PORT`. To use a domain over HTTPS, put your own reverse proxy (nginx, Traefik, Caddy, Cloudflare Tunnel) in front of `PORT`. The proxy must pass WebSocket upgrades for `/api/connect/*`. Without HTTPS, the app works, but traffic is unencrypted and the "Copy link" button fails, because browsers allow the clipboard API only on HTTPS or localhost.

### Update

```sh
docker compose up -d --build deploy
```

Running nodes adopt the new version in place within 30s. Open rooms keep their connections.

### Use an external bucket instead of SeaweedFS

Remove `COMPOSE_PROFILES=local-s3` from `.env`. Then set the following values:

```sh
S3_ENDPOINT=https://ACCOUNT_ID.r2.cloudflarestorage.com
AWS_REGION=auto
BUCKET=my-bucket
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
```

The bucket must support conditional writes and ranged reads. AWS S3, R2, Tigris, and GCS qualify. B2, Hetzner, and DO Spaces do not. MinIO is not production-qualified (and its images are no longer published). SeaweedFS passes celld's storage test (`celld diagnose`). It is not on celld's officially qualified list.

### Notes

- A single node waits for the bucket on every write. With the bundled SeaweedFS on the same host, that wait is milliseconds. With a remote bucket, run 2+ nodes on a private network and point each at the same bucket. They find each other through the bucket.
- Keep port 8081 (celld internal listener) private. Don't publish it.
- Back up the `seaweedfs-data` volume. It holds everything.

## Develop

Requirements: `celld` on PATH (`curl -fsSL https://celld.dev/install.sh | sh`) and pnpm.

```sh
pnpm install
pnpm dev
```

This command runs `celld dev` on :8787 (worker + Durable Objects + local object store in `.celld/dev`) and Vite on :5173, which proxies `/api` to celld. Open http://localhost:5173.

## Differences from the Cloudflare template

- `wrangler.toml` became `wrangler.jsonc`. celld reads only JSON and rejects keys like `routes` and `observability`.
- The `@cloudflare/vite-plugin` is gone. Vite builds the client and celld bundles the worker with esbuild.
- The asset download path drops `caches.default`, because celld's cache always misses. Browser caching relies on immutable `cache-control` and the `etag` header.
- Upload `httpMetadata` stores only the content type, instead of copying all request headers.
