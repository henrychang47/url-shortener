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
