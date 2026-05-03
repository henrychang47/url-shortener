from datetime import datetime

from pydantic import BaseModel, ConfigDict, HttpUrl


class Cookies(BaseModel):
    read_after_write: bool | None = None


class LinkBase(BaseModel):
    original_url: HttpUrl
    expires_at: datetime | None = None


class LinkCreate(LinkBase): ...


class LinkRead(LinkBase):
    code: str
    created_at: datetime
    click_count: int

    model_config = ConfigDict(from_attributes=True)
