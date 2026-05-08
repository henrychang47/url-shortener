# URL Shortener

**Live Demo:** https://url-shortener-sbc1.onrender.com

A URL shortening service built with FastAPI, targeting production-grade architecture with primary/replica database separation, Nginx load balancing, and read-after-write consistency.

## Tech Stack

- **FastAPI** — async REST API (2 instances behind Nginx)
- **Nginx** — round-robin load balancer
- **PostgreSQL 18** — primary/replica replication for read scaling
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
- Read replica routing for read traffic with read-after-write consistency

## Architecture

Seven-service Docker Compose stack:

```
Client → Nginx (round-robin) → api-1 / api-2
                                    ↓           ↓
                             pg-primary    pg-replica
                                    ↓
                                  Redis
```

**Read/write routing** — writes go to `pg-primary` via `get_session()`; reads go to `pg-replica` via `get_read_session()`. After a link is created, a `read_after_write` cookie (TTL: 60s) routes subsequent reads back to the primary, preventing stale reads caused by replication lag.

**Migration service** — a dedicated `migrate` container runs `alembic upgrade head` before any API container starts, ensuring schema is always up to date on deployment.

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/links` | Create a short link |
| `GET` | `/v1/{code}` | Redirect to original URL |
| `GET` | `/v1/links` | List links (optional `?codes=` filter) |
| `GET` | `/v1/links/{code}/stats` | Get link stats |
| `DELETE` | `/v1/links/{code}` | Delete a link |
| `DELETE` | `/v1/links/expired` | Delete all expired links |
| `GET` | `/whoami` | Return current server name (load balancing verification) |

**Create a link**
```bash
curl -X POST http://localhost:8000/v1/links \
  -H "Content-Type: application/json" \
  -d '{"original_url": "https://example.com", "expires_at": null}'
```

**Batch fetch by codes**
```bash
curl "http://localhost:8000/v1/links?codes=abc&codes=xyz"
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

   Migrations run automatically via the `migrate` service before the API starts. The API is available at `http://localhost:80` (via Nginx) or directly at `http://localhost:8000` / `http://localhost:8001`.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Primary PostgreSQL connection string (`postgresql+asyncpg://...`) |
| `DATABASE_URL_REPLICA` | Replica PostgreSQL connection string (`postgresql+asyncpg://...`) |
| `REDIS_URL` | Redis connection string (`redis://...`) |
| `POSTGRES_USER` | PostgreSQL username |
| `POSTGRES_PASSWORD` | PostgreSQL password |
| `POSTGRES_DB` | PostgreSQL database name |
| `SERVER_NAME` | Server identifier returned by `/whoami` (set per container) |
| `DEBUG` | Enable SQLAlchemy query logging (default: `false`) |

## Running Tests

Tests use an in-memory SQLite database and `fakeredis` — no external services needed.

```bash
uv run pytest
```
