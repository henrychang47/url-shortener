from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.link import Link


class LinkRepository:
    def __init__(self, db: AsyncSession):
        self.db: AsyncSession = db

    async def pre_create(
        self,
        original_url: str,
        expires_at: datetime | None,
    ):
        link = Link(
            original_url=original_url,
            expires_at=expires_at,
        )

        self.db.add(link)
        await self.db.flush()

        return link

    async def get_by_code(self, code: str) -> Link | None:
        link_res = await self.db.execute(select(Link).where(Link.code == code))
        return link_res.scalar_one_or_none()

    async def delete_by_code(self, code: str) -> bool:
        link = await self.get_by_code(code)
        if link is None:
            return False

        await self.db.delete(link)
        await self.db.commit()
        return True

    async def increment_click_count(self, code: str) -> None:
        stmt = (
            update(Link)
            .where(Link.code == code)
            .values(click_count=Link.click_count + 1)
        )
        await self.db.execute(stmt)
        await self.db.commit()

    async def commit(self):
        await self.db.commit()

    async def refresh(self, link: Link):
        await self.db.refresh(link)
