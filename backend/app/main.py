import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import links
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.redis import close_redis, get_redis, init_redis
from app.repositories.link_cache_repo import LinkCacheRepository
from app.repositories.link_repo import LinkRepository
from app.services.link_service import LinkService

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


def create_app(root_path: str | None = None) -> FastAPI:
    app = FastAPI(lifespan=lifespan, root_path=root_path or settings.ROOT_PATH)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(links.router)
    app.include_router(links.redirect_router)

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    return app


app = create_app()
