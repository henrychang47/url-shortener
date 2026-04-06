from datetime import datetime

from pydantic import BaseModel, ConfigDict, HttpUrl


class LinkBase(BaseModel):
    original_url: HttpUrl
    custom_alias: str | None = None
    expires_at: datetime | None = None


class LinkCreate(LinkBase): ...


class LinkRead(LinkBase):
    code: str
    created_at: datetime
    click_count: int

    model_config = ConfigDict(from_attributes=True)
