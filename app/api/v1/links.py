from typing import Annotated

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    Query,
    Response,
    status,
)
from fastapi.responses import FileResponse, RedirectResponse

from app.core.deps import LinkServiceDep, RateLimiter
from app.core.paths import STATIC_DIR
from app.schemas.link import LinkCreate, LinkRead

router = APIRouter(prefix="/v1")


@router.post(
    "/links",
    response_model=LinkRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(RateLimiter())],
)
async def create_link(
    link_create: LinkCreate, link_service: LinkServiceDep, response: Response
):
    link = await link_service.create(link_create)
    response.set_cookie(key="read_after_write", value=str(True), max_age=15)
    return link


@router.get(
    "/links/{code}/stats",
    response_model=LinkRead,
    dependencies=[Depends(RateLimiter())],
)
async def link_status(code: str, link_service: LinkServiceDep):
    link = await link_service.get_by_code(code)

    if link is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Not valid code"
        )

    return link


@router.get(
    "/links",
    response_model=list[LinkRead],
    dependencies=[Depends(RateLimiter())],
)
async def list_links(
    link_service: LinkServiceDep,
    codes: Annotated[list[str], Query()] = [],
):
    return await link_service.get_by_codes(codes)


@router.get("/{code}", dependencies=[Depends(RateLimiter())], response_model=None)
async def redirect(
    code: str, link_service: LinkServiceDep, background_tasks: BackgroundTasks
) -> RedirectResponse | FileResponse:
    original_url = await link_service.get_original_url(code)
    if original_url is None:
        return FileResponse(STATIC_DIR / "404.html", status_code=404)

    background_tasks.add_task(link_service.increment_click_count, code)

    return RedirectResponse(url=original_url, status_code=status.HTTP_302_FOUND)


@router.delete(
    "/links/expired",
    dependencies=[Depends(RateLimiter())],
)
async def cleanup_expired_links(link_service: LinkServiceDep):
    deleted = await link_service.cleanup_expired()
    return {"deleted": deleted}


@router.delete(
    "/links/{code}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(RateLimiter())],
)
async def delete_link(code: str, link_service: LinkServiceDep):
    deleted = await link_service.delete_by_code(code)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Not valid code"
        )
