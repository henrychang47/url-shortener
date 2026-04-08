from pydantic import PostgresDsn, RedisDsn
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: PostgresDsn
    REDIS_URL: RedisDsn

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()  # type:ignore
