from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.responses import RedirectResponse

from app.core.deps import LinkServiceDep, RateLimiter
from app.schemas.link import LinkCreate, LinkRead

router = APIRouter(prefix="/v1")


@router.post(
    "/links",
    response_model=LinkRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(RateLimiter())],
)
async def create_link(
    link_create: LinkCreate,
    link_service: LinkServiceDep,
):
    data = link_create.model_dump()
    data["original_url"] = str(data["original_url"])
    link = await link_service.create(**data)
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
    "/{code}",
    dependencies=[Depends(RateLimiter())],
)
async def redirect(
    code: str, link_service: LinkServiceDep, background_tasks: BackgroundTasks
) -> RedirectResponse:
    original_url = await link_service.get_original_url(code)
    if original_url is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Not valid code"
        )

    background_tasks.add_task(link_service.increment_click_count, code)

    return RedirectResponse(url=original_url, status_code=status.HTTP_302_FOUND)


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
