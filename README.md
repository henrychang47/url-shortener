# URL Shortener

A URL shortening service built with FastAPI, PostgreSQL, and Redis.

## Features

- Create short links from long URLs
- Redirect to original URL via short code
- View link stats (click count, creation time, etc.)
- Delete links by code
- Rate limiting on all endpoints (via Redis)

## Tech Stack

- **FastAPI** — web framework
- **PostgreSQL** — persistent storage (via SQLAlchemy + asyncpg)
- **Redis** — caching & rate limiting
- **Alembic** — database migrations
- **uv** — package manager