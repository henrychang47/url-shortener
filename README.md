# URL Shortener

URL Shortener 是一個短網址服務，採用 FastAPI 後端與 React + Vite 前端。Nginx 會在 `/url-shortener/` 提供前端靜態檔案，並將 API、短網址轉址與文件路徑反向代理到後端。

## 功能

- 建立短網址，並可選擇設定到期日期與時間
- 透過短碼轉址到原始 URL
- 建立、檢視、刪除短網址，並查看統計資訊
- 支援一鍵複製短網址與下載短網址 QR Code

## 架構

Docker Compose 服務架構：

```text
Client -> Nginx -> React static assets
              |-> FastAPI backend -> PostgreSQL
                                  |-> Redis
```

主要路徑：

- `/url-shortener/`：前端應用
- `/url-shortener/api/`：API 入口
- `/url-shortener/r/{code}`：短網址轉址
- `/url-shortener/docs`：FastAPI Swagger UI
- `/health`：Nginx health check
- `/backend-health`：後端 health check proxy

部署時會由獨立的 `migrate` 服務先執行 `alembic upgrade head`，成功後才啟動後端服務，確保正式環境 schema 與程式碼同步。

## API

| Method | Endpoint | 說明 |
| --- | --- | --- |
| `POST` | `/api/links` | 建立短網址 |
| `GET` | `/r/{code}` | 轉址到原始 URL |
| `GET` | `/api/links` | 列出短網址，可用 `?codes=` 篩選 |
| `GET` | `/api/links/{code}/stats` | 取得短網址統計 |
| `DELETE` | `/api/links/{code}` | 刪除指定短網址 |
| `DELETE` | `/api/links/expired` | 刪除所有過期短網址 |

## 本機開發

需求：

- Docker
- Docker Compose
- Python 3.13 與 uv（執行後端工具時使用）
- Node.js 24 與 npm（執行前端工具時使用）

複製環境變數範本：

```bash
cp .env.example .env
```

啟動完整服務：

```bash
docker compose up --build
```

本機服務位置：

- 前端：http://localhost/url-shortener/
- API：http://localhost/url-shortener/api/
- 後端直接連線：http://localhost:8000
- PostgreSQL：localhost:5433
- Redis：localhost:6379

## 環境變數

| 變數 | 說明 |
| --- | --- |
| `DATABASE_URL` | 後端直接執行時使用的 PostgreSQL 連線字串，例如 `postgresql+asyncpg://...` |
| `REDIS_URL` | 後端直接執行時使用的 Redis 連線字串，例如 `redis://localhost:6379` |
| `POSTGRES_USER` | PostgreSQL 使用者名稱 |
| `POSTGRES_PASSWORD` | PostgreSQL 密碼 |
| `POSTGRES_DB` | PostgreSQL 資料庫名稱 |
| `DEBUG` | 是否啟用 SQLAlchemy query logging，預設 `false` |
| `ROOT_PATH` | 後端在反向代理後的 URL 前綴，本機 Compose 會設為 `/url-shortener` |
| `CLOUDFLARE_TUNNEL_TOKEN` | 正式環境 Cloudflare Tunnel token |

正式環境另外會由 CI/CD 在部署時注入：

- `BACKEND_IMAGE`
- `FRONTEND_IMAGE`

## 測試與檢查

後端工具請在 `backend/` 目錄執行：

```bash
uv run ruff check .
uv run ruff format --check .
uv run mypy .
uv run alembic upgrade head
uv run alembic check
uv run pytest
```

前端工具請在 `frontend/` 目錄執行：

```bash
npm ci
npm run lint
npm test
npm run build
```
