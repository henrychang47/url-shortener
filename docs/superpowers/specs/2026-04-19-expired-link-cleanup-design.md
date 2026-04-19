# Expired Link Cleanup — Design Spec

**Date:** 2026-04-19
**Status:** Approved

## Problem

Expired links are filtered at query time (`expires_at > now()`) but never removed from the database. Over time, the `links` table accumulates dead rows that waste storage and slow down queries.

Redis does not have this problem — cache TTLs are already set to expire at or before the link's `expires_at`, so Redis self-cleans.

## Solution

Two complementary cleanup mechanisms:

1. **Automatic**: an asyncio background task runs every hour inside the FastAPI process, deleting all expired rows from PostgreSQL.
2. **Manual**: a new API endpoint allows on-demand cleanup at any time.

## Architecture

No new infrastructure required. The cleanup uses the existing layered pattern: repository → service → API.

```
lifespan (main.py)
  └─ asyncio background task (3600s interval)
       └─ link_service.cleanup_expired()
            └─ link_repo.delete_expired()
                 └─ DELETE FROM links WHERE expires_at IS NOT NULL AND expires_at < now()

DELETE /v1/links/expired
  └─ RateLimiter (existing)
  └─ link_service.cleanup_expired()
       └─ link_repo.delete_expired()
```

## Changes

### `app/repositories/link_repo.py`

Add `delete_expired() -> int`:

- Executes `DELETE FROM links WHERE expires_at IS NOT NULL AND expires_at < now()`
- Returns `result.rowcount` (number of rows deleted)

### `app/services/link_service.py`

Add `cleanup_expired() -> int`:

- Calls `link_repo.delete_expired()`
- Returns the deleted row count to the caller

### `app/main.py`

In the `lifespan` context manager:

- Before `yield`: start an `asyncio.Task` running `_cleanup_loop()`
- After `yield`: cancel the task and await it (suppress `CancelledError`)

`_cleanup_loop()` behaviour:
- Sleeps 3600 seconds first, then calls `link_service.cleanup_expired()`
- Wraps each cleanup call in `try/except Exception` — a single failure logs and continues; it does not crash the loop
- Interval is hardcoded at 3600 seconds (not configurable)

### `app/api/v1/links.py`

Add `DELETE /v1/links/expired`:

- Dependencies: `RateLimiter()` (same as all other routes), `LinkServiceDep`
- Calls `link_service.cleanup_expired()`
- Returns HTTP 200 with body `{"deleted": N}`

## Behaviour

| Trigger | Interval | Auth | Response |
|---------|----------|------|----------|
| Background task | Every 1 hour (hardcoded) | None (internal) | Logs deleted count |
| `DELETE /v1/links/expired` | On demand | None (rate-limited) | `{"deleted": N}` |

## What is not changing

- Redis: no changes needed — TTLs already expire at or before `expires_at`
- Database schema: no changes needed — `expires_at` column already exists
- Existing endpoints: no changes

## Error handling

- Background task: exceptions are caught per-iteration; the loop continues on next tick
- API endpoint: if the DELETE query fails, SQLAlchemy raises an exception → FastAPI returns HTTP 500 (default behaviour)

## Testing

- Add a test for `DELETE /v1/links/expired` in `tests/api/v1/test_links.py`:
  - Creates expired and non-expired links
  - Calls the endpoint
  - Asserts `{"deleted": N}` matches only expired count
  - Asserts non-expired links are still retrievable
