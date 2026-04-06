from datetime import datetime

from app.core.utils import base62_encode
from app.models.link import Link
from app.repositories.link_cache_repo import LinkCacheRepository
from app.repositories.link_repo import LinkRepository


class LinkService:
    def __init__(self, repo: LinkRepository, cache_repo: LinkCacheRepository) -> None:
        self.repo = repo
        self.cache_repo = cache_repo

    async def create(
        self, original_url: str, custom_alias: str | None, expires_at: datetime | None
    ) -> Link:

        link: Link = await self.repo.pre_create(
            original_url=original_url,
            custom_alias=custom_alias,
            expires_at=expires_at,
        )

        link.code = base62_encode(link.id)

        await self.repo.commit()
        await self.repo.refresh(link)
        return link

    async def get_by_code(self, code: str) -> Link | None:
        return await self.repo.get_by_code(code)

    async def delete_by_code(self, code: str) -> bool:
        await self.cache_repo.delete(code)
        deleted = await self.repo.delete_by_code(code)
        return deleted

    async def get_original_url(self, code: str) -> str | None:
        cache_url = await self.cache_repo.get(code)
        if cache_url:
            return str(cache_url)

        link: Link | None = await self.repo.get_by_code(code)
        if link:
            await self.cache_repo.set(
                code, link.original_url, expires_at=link.expires_at
            )
            return link.original_url

        return None
