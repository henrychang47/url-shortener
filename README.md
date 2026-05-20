# URL Shortener

**Live Demo:** https://url-shortener-sbc1.onrender.com

A URL shortening service with a FastAPI backend and React + Vite frontend. Nginx serves the frontend at `/url-shortener/` and proxies API and redirect traffic to the backend.

## Tech Stack

- **FastAPI** — async REST API
- **React + Vite** — frontend dashboard
- **Nginx** — static frontend server and reverse proxy
- **PostgreSQL 18** — primary database
- **SQLAlchemy 2.0** — dual async engine for read/write routing
- **Redis** — URL caching and sliding window rate limiting
- **Alembic** — async database migrations
- **Sqids** — collision-free short code generation from database IDs

## Features

- Shorten URLs with optional expiry date
- Redirect with click count tracking (via background tasks)
- Redis cache layer (Cache-Aside) to reduce DB reads on popular links
- Sliding window rate limiter (10 requests / 60 seconds per IP)
- Automatic hourly cleanup of expired links

## Architecture

Docker Compose stack:

```
Client → Nginx → React static assets
             └→ FastAPI backend → PostgreSQL
                              └→ Redis
```

**Migration service** — a dedicated `migrate` container runs `alembic upgrade head` before any API container starts, ensuring schema is always up to date on deployment.

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/links` | Create a short link |
| `GET` | `/r/{code}` | Redirect to original URL |
| `GET` | `/api/links` | List links (optional `?codes=` filter) |
| `GET` | `/api/links/{code}/stats` | Get link stats |
| `DELETE` | `/api/links/{code}` | Delete a link |
| `DELETE` | `/api/links/expired` | Delete all expired links |

**Create a link**
```bash
curl -X POST http://localhost:8000/api/links \
  -H "Content-Type: application/json" \
  -d '{"original_url": "https://example.com", "expires_at": null}'
```

**Batch fetch by codes**
```bash
curl "http://localhost:8000/api/links?codes=abc&codes=xyz"
```

## Getting Started

**Prerequisites:** Docker, Docker Compose

1. Copy the example env file and fill in the values:
   ```bash
   cp .env.example .env
   ```

2. Start all services:
   ```bash
   docker compose up --build
   ```

   Migrations run automatically via the `migrate` service before the API starts. The app is available at `http://localhost/url-shortener/`; the API is available through Nginx under `http://localhost/url-shortener/api`.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Primary PostgreSQL connection string (`postgresql+asyncpg://...`) |
| `REDIS_URL` | Redis connection string (`redis://...`) |
| `POSTGRES_USER` | PostgreSQL username |
| `POSTGRES_PASSWORD` | PostgreSQL password |
| `POSTGRES_DB` | PostgreSQL database name |
| `DEBUG` | Enable SQLAlchemy query logging (default: `false`) |
| `ROOT_PATH` | Reverse-proxy URL prefix, e.g. `/url-shortener` |
| `CLOUDFLARE_TUNNEL_TOKEN` | Cloudflare tunnel token used by production Compose |

## Running Tests

Tests use an in-memory SQLite database and `fakeredis` — no external services needed. Run backend tooling from `backend/`.

```bash
cd backend
uv run pytest
```

## Deployment

Production CD runs from `.github/workflows/ci-cd.yaml` and triggers only on `push` to `main` after CI passes.

- GitHub Actions builds and pushes backend image tags under `ghcr.io/henrychang47/url-shortener/backend` and frontend image tags under `ghcr.io/henrychang47/url-shortener/frontend`.
- Actions assumes the AWS role from repository variable `AWS_ROLE_TO_ASSUME` via GitHub OIDC.
- The deploy job targets the single running EC2 instance tagged `App=url-shortener` in `ap-southeast-2`.
- SSM syncs `compose.prod.yaml` and `nginx/conf.d/default.conf` into `/opt/url-shortener`.
- EC2 reuses `/opt/url-shortener/.env`, runs migrations, restarts the stack, and checks `http://localhost/health`.
