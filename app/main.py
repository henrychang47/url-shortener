import asyncio
import hashlib
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from app.api import links
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.paths import STATIC_DIR
from app.core.redis import close_redis, get_redis, init_redis
from app.repositories.link_cache_repo import LinkCacheRepository
from app.repositories.link_repo import LinkRepository
from app.services.link_service import LinkService

BASE_DIR = Path(__file__).parent

_CLEANUP_INTERVAL = 3600


def _asset_version(filename: str) -> str:
    return hashlib.sha256((STATIC_DIR / filename).read_bytes()).hexdigest()[:12]


def _render_frontend() -> str:
    html = (STATIC_DIR / "index.html").read_text(encoding="utf-8")
    replacements = {
        "static/style.css": f"static/style.css?v={_asset_version('style.css')}",
        "static/script.js": f"static/script.js?v={_asset_version('script.js')}",
    }
    for source, target in replacements.items():
        html = html.replace(source, target)
    return html


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
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

    @app.get("/")
    async def serve_frontend():
        return HTMLResponse(
            _render_frontend(),
            headers={"Cache-Control": "no-store, max-age=0, must-revalidate"},
        )

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    return app


app = create_app()
