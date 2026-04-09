from datetime import datetime, timedelta, timezone

from redis.asyncio import Redis


class LinkCacheRepository:
    def __init__(self, redis: Redis) -> None:
        self.redis: Redis = redis

    async def set(
        self, code: str, original_url: str, expires_at: datetime | None
    ) -> None:
        now = datetime.now(timezone.utc)
        default_expires = timedelta(hours=1)

        if expires_at is None:
            ex_delta = default_expires

        elif expires_at < now:
            return

        else:
            ex_delta = min(expires_at - now, default_expires)

        ex = int(ex_delta.total_seconds())
        await self.redis.set(code, original_url, ex=ex)

    async def get(self, code: str):
        return await self.redis.get(code)

    async def delete(self, code: str):
        await self.redis.delete(code)
