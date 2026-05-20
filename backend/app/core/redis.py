from redis.asyncio import Redis, from_url

redis_client: Redis | None = None


async def init_redis(url: str):
    global redis_client
    redis_client = from_url(url, decode_responses=True)


async def close_redis():
    if redis_client is None:
        return

    await redis_client.close()


async def get_redis() -> Redis:
    if redis_client is None:
        raise RuntimeError("Redis client hasn't init!")

    return redis_client
