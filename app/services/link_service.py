from app.core.utils import encode_from_num
from app.models.link import Link
from app.repositories.link_cache_repo import LinkCacheRepository
from app.repositories.link_repo import LinkRepository
from app.schemas.link import LinkCreate


class LinkService:
    def __init__(
        self,
        repo: LinkRepository,
        read_repo: LinkRepository,
        cache_repo: LinkCacheRepository,
    ) -> None:
        self.repo = repo
        self.read_repo = read_repo
        self.cache_repo = cache_repo

    async def create(self, link_create: LinkCreate) -> Link:
        link: Link = await self.repo.pre_create(
            original_url=str(link_create.original_url),
            expires_at=link_create.expires_at,
        )

        link.code = encode_from_num(link.id)

        await self.repo.commit()
        await self.repo.refresh(link)
        return link

    async def get_by_code(self, code: str) -> Link | None:
        return await self.read_repo.get_by_code(code)

    async def get_by_codes(self, codes: list[str]) -> list[Link]:
        return await self.read_repo.get_by_codes(codes)

    async def delete_by_code(self, code: str) -> bool:
        await self.cache_repo.delete(code)
        deleted = await self.repo.delete_by_code(code)
        return deleted

    async def get_original_url(self, code: str) -> str | None:
        cache_url = await self.cache_repo.get(code)
        if cache_url:
            return str(cache_url)

        link: Link | None = await self.read_repo.get_by_code(code)
        if link:
            await self.cache_repo.set(
                code, link.original_url, expires_at=link.expires_at
            )
            return link.original_url

        return None

    async def increment_click_count(self, code: str) -> None:
        await self.repo.increment_click_count(code)

    async def cleanup_expired(self) -> int:
        return await self.repo.delete_expired()
