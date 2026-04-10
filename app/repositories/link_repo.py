from datetime import datetime, timezone

from sqlalchemy import delete, or_, select, update
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
        link_res = await self.db.execute(
            select(Link).where(
                Link.code == code,
                or_(
                    Link.expires_at.is_(None),
                    Link.expires_at > datetime.now(timezone.utc),
                ),
            )
        )
        return link_res.scalar_one_or_none()

    async def delete_by_code(self, code: str) -> bool:
        result = await self.db.execute(
            delete(Link).where(Link.code == code).returning(Link.id)
        )
        await self.db.commit()
        return result.scalar() is not None

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
