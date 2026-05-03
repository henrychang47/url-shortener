from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

engine = create_async_engine(
    str(settings.DATABASE_URL),
    echo=settings.DEBUG,
    connect_args={"statement_cache_size": 0},
)

engine_replica = create_async_engine(
    str(settings.DATABASE_URL_REPLICA),
    echo=settings.DEBUG,
    connect_args={"statement_cache_size": 0},
)

AsyncSessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False)
AsyncSessionLocalReplica = async_sessionmaker(
    bind=engine_replica, expire_on_commit=False
)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session


async def get_read_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocalReplica() as session:
        yield session


class Base(DeclarativeBase):
    pass
