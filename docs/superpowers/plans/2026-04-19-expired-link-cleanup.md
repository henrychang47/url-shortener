# Expired Link Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete expired links from PostgreSQL automatically every hour and on demand via a `DELETE /v1/links/expired` endpoint.

**Architecture:** Follows the existing repo→service→router layered pattern. A new `delete_expired()` method on `LinkRepository` runs a bulk DELETE; `LinkService.cleanup_expired()` wraps it; a new router endpoint exposes it with rate limiting. An asyncio background task in `main.py` lifespan calls the service every 3600 seconds using a direct session from `AsyncSessionLocal`.

**Tech Stack:** FastAPI, SQLAlchemy 2.0 async, asyncio, pytest + fakeredis + aiosqlite

---

### Task 1: Write failing tests for the cleanup endpoint

**Files:**
- Modify: `tests/api/v1/test_links.py`

- [ ] **Step 1: Append TestCleanupExpired class to the test file**

Add at the end of `tests/api/v1/test_links.py`:

```python
class TestCleanupExpired:
    async def test_cleanup_deletes_only_expired_links(self, client: AsyncClient):
        """Expired links are deleted; active links survive."""
        expired_at = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
        await client.post(
            "/v1/links",
            json={"original_url": "https://expired.com", "expires_at": expired_at},
        )

        active_at = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
        active_response = await client.post(
            "/v1/links",
            json={"original_url": "https://active.com", "expires_at": active_at},
        )
        active_code = active_response.json()["code"]

        response = await client.delete("/v1/links/expired")
        assert response.status_code == 200
        assert response.json() == {"deleted": 1}

        stats = await client.get(f"/v1/links/{active_code}/stats")
        assert stats.status_code == 200

    async def test_cleanup_returns_zero_when_none_expired(self, client: AsyncClient):
        """Returns 0 when no links have expired."""
        response = await client.delete("/v1/links/expired")
        assert response.status_code == 200
        assert response.json() == {"deleted": 0}
```

- [ ] **Step 2: Run to confirm the tests fail**

```bash
cd d:/fast-api/url-shortener
.venv/Scripts/pytest tests/api/v1/test_links.py::TestCleanupExpired -v
```

Expected output: FAILED — `AssertionError: assert 404 == 200` (endpoint does not exist yet)

---

### Task 2: Add `delete_expired()` to LinkRepository

**Files:**
- Modify: `app/repositories/link_repo.py`

- [ ] **Step 1: Append the method inside the LinkRepository class**

Add after the `refresh()` method in `app/repositories/link_repo.py`:

```python
    async def delete_expired(self) -> int:
        now = datetime.now(timezone.utc)
        result = await self.db.execute(
            delete(Link).where(
                Link.expires_at.is_not(None),
                Link.expires_at < now,
            )
        )
        await self.db.commit()
        return result.rowcount
```

No new imports needed — `datetime`, `timezone`, and `delete` are already at the top of the file.

---

### Task 3: Add `cleanup_expired()` to LinkService

**Files:**
- Modify: `app/services/link_service.py`

- [ ] **Step 1: Append the method inside the LinkService class**

Add after the `increment_click_count()` method in `app/services/link_service.py`:

```python
    async def cleanup_expired(self) -> int:
        return await self.repo.delete_expired()
```

---

### Task 4: Add the cleanup endpoint, run tests, commit

**Files:**
- Modify: `app/api/v1/links.py`

- [ ] **Step 1: Insert the new endpoint BEFORE `delete_link`**

> **Important:** `DELETE /links/expired` must be registered before `DELETE /links/{code}` in the router. If it comes after, FastAPI will match the literal string "expired" as a `{code}` path parameter and call `delete_link` instead.

In `app/api/v1/links.py`, insert the following block **before** the `@router.delete("/links/{code}", ...)` handler:

```python
@router.delete(
    "/links/expired",
    dependencies=[Depends(RateLimiter())],
)
async def cleanup_expired_links(link_service: LinkServiceDep):
    deleted = await link_service.cleanup_expired()
    return {"deleted": deleted}
```

The final order in the file should be:
1. `POST /links` (create_link)
2. `GET /links/{code}/stats` (link_status)
3. `GET /{code}` (redirect)
4. `DELETE /links/expired` ← new, must be here
5. `DELETE /links/{code}` (delete_link)

- [ ] **Step 2: Run all tests**

```bash
.venv/Scripts/pytest tests/ -v
```

Expected output: All tests PASS, including both `TestCleanupExpired` tests.

- [ ] **Step 3: Commit**

```bash
git add tests/api/v1/test_links.py app/repositories/link_repo.py app/services/link_service.py app/api/v1/links.py
git commit -m "feat: add expired link cleanup — endpoint, service, and repo"
```

---

### Task 5: Add the hourly background cleanup task to lifespan

**Files:**
- Modify: `app/main.py`

- [ ] **Step 1: Update main.py**

Replace the full contents of `app/main.py` with:

```python
import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.api.v1 import links
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.paths import STATIC_DIR
from app.core.redis import close_redis, get_redis, init_redis
from app.repositories.link_cache_repo import LinkCacheRepository
from app.repositories.link_repo import LinkRepository
from app.services.link_service import LinkService

BASE_DIR = Path(__file__).parent

_CLEANUP_INTERVAL = 3600


async def _cleanup_loop() -> None:
    while True:
        await asyncio.sleep(_CLEANUP_INTERVAL)
        try:
            async with AsyncSessionLocal() as db:
                redis = await get_redis()
                service = LinkService(
                    repo=LinkRepository(db),
                    cache_repo=LinkCacheRepository(redis),
                )
                deleted = await service.cleanup_expired()
                print(f"[cleanup] Deleted {deleted} expired links")
        except Exception as exc:
            print(f"[cleanup] Error during cleanup: {exc}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_redis(str(settings.REDIS_URL))
    task = asyncio.create_task(_cleanup_loop())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    await close_redis()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(links.router)


@app.get("/")
async def serve_frontend():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/health")
async def health():
    return {"status": "ok"}
```

> **Why `asyncio.sleep` comes first in `_cleanup_loop`:** The task starts at app startup. Sleeping first avoids an immediate database hit right after startup, and defers cleanup to the first scheduled interval.

> **Why the task is safe during tests:** The test client triggers the lifespan, starting the background task. Since the task sleeps 3600 seconds before doing anything, it is always cancelled by `task.cancel()` during test teardown before it touches the database.

- [ ] **Step 2: Run all tests**

```bash
.venv/Scripts/pytest tests/ -v
```

Expected output: All tests PASS (no change in test results — the background task sleeps and is cancelled cleanly).

- [ ] **Step 3: Commit**

```bash
git add app/main.py
git commit -m "feat: add hourly background task to auto-clean expired links"
```
