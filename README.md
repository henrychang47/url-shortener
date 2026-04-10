# URL Shortener

A URL shortening service built with FastAPI, PostgreSQL, and Redis.

## Tech Stack

- **FastAPI** — async REST API
- **PostgreSQL** + **SQLAlchemy 2.0** — persistent storage with async ORM
- **Redis** — URL caching and sliding window rate limiting
- **Alembic** — database migrations
- **Sqids** — collision-free short code generation from database IDs

## Features

- Shorten URLs with optional expiry date
- Redirect with click count tracking (via background tasks)
- Redis cache layer to reduce DB reads on popular links
- Sliding window rate limiter (10 requests / 60 seconds per IP)

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/links` | Create a short link |
| `GET` | `/v1/{code}` | Redirect to original URL |
| `GET` | `/v1/links/{code}/stats` | Get link stats |
| `DELETE` | `/v1/links/{code}` | Delete a link |

**Create a link**
```bash
curl -X POST http://localhost:8000/v1/links \
  -H "Content-Type: application/json" \
  -d '{"original_url": "https://example.com", "expires_at": null}'
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

   Migrations run automatically on startup. The API is available at `http://localhost:8000`.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (`postgresql+asyncpg://...`) |
| `REDIS_URL` | Redis connection string (`redis://...`) |
| `POSTGRES_USER` | PostgreSQL username |
| `POSTGRES_PASSWORD` | PostgreSQL password |
| `POSTGRES_DB` | PostgreSQL database name |
| `DEBUG` | Enable SQLAlchemy query logging (default: `false`) |

## Running Tests

Tests use an in-memory SQLite database and `fakeredis` — no external services needed.

```bash
uv run pytest
```
