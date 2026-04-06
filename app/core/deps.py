from datetime import datetime
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.redis import get_redis
from app.repositories.link_cache_repo import LinkCacheRepository
from app.repositories.link_repo import LinkRepository
from app.services.link_service import LinkService

from .database import get_db

SessionDep = Annotated[AsyncSession, Depends(get_db)]
RedisDep = Annotated[Redis, Depends(get_redis)]


def get_link_repo(session: SessionDep) -> LinkRepository:
    return LinkRepository(session)


LinkRepositoryDep = Annotated[LinkRepository, Depends(get_link_repo)]


def get_link_cache_repo(redis: RedisDep):
    return LinkCacheRepository(redis)


LinkCacheRepositoryDep = Annotated[LinkCacheRepository, Depends(get_link_cache_repo)]


def get_link_service(
    repo: LinkRepositoryDep,
    cache_repo: LinkCacheRepositoryDep,
) -> LinkService:
    return LinkService(repo, cache_repo)


LinkServiceDep = Annotated[LinkService, Depends(get_link_service)]


class RateLimiter:
    def __init__(self, window_size: int = 60, limit: int = 10) -> None:
        self.window_size = window_size
        self.limit = limit

    async def __call__(self, request: Request, redis: RedisDep) -> None:
        client_host = request.client.host if request.client is not None else None

        if client_host is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST)

        now = int(datetime.now().timestamp())

        curr_window_id = now // self.window_size
        prev_window_id = curr_window_id - 1

        key_prev = f"rl:{client_host}:{prev_window_id}"
        key_curr = f"rl:{client_host}:{curr_window_id}"

        prev_count = int(await redis.get(key_prev) or 0)
        curr_count = int(await redis.get(key_curr) or 0)

        position = (now % self.window_size) / self.window_size
        estimated = prev_count * (1 - position) + curr_count

        if estimated < self.limit:
            await redis.incr(key_curr)
            await redis.expire(key_curr, self.window_size * 2)
        else:
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS)
