from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.v1 import links
from app.core.config import settings
from app.core.redis import close_redis, init_redis


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_redis(settings.REDIS_URL)
    yield
    await close_redis()


app = FastAPI(lifespan=lifespan)
app.include_router(links.router)
