from pydantic import PostgresDsn, RedisDsn
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: PostgresDsn
    DATABASE_URL_REPLICA: PostgresDsn | None = None
    REDIS_URL: RedisDsn
    DEBUG: bool = False
    SERVER_NAME: str = "api"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()  # type:ignore
