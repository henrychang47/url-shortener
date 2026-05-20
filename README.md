# URL Shortener

**Demo 網址：** https://app.henry.christmas/url-shortener/

URL Shortener 是一個短網址服務，採用 FastAPI 後端與 React + Vite 前端。Nginx 會在 `/url-shortener/` 提供前端靜態檔案，並將 API、短網址轉址與文件路徑反向代理到後端。

## 技術棧

- **FastAPI**：非同步 REST API
- **React + Vite**：短網址管理前端
- **Nginx**：靜態檔案服務與反向代理
- **PostgreSQL 18**：主要資料庫
- **SQLAlchemy 2.0**：非同步資料存取
- **Redis**：短網址快取與滑動視窗 rate limit
- **Alembic**：資料庫 migration
- **Sqids**：依資料庫 ID 產生短碼
- **Docker Compose**：本機與正式環境服務編排
- **GitHub Actions**：CI/CD、自動建置映像檔與部署

## 功能

- 建立短網址，並可選擇設定到期時間
- 透過短碼轉址到原始 URL
- 以背景工作更新點擊次數
- 使用 Redis Cache-Aside 降低熱門短網址的資料庫讀取
- 以 Redis 實作滑動視窗 rate limit，預設每個 IP 每 60 秒 10 次請求
- 後端每小時自動清理過期連結
- 前端可建立、檢視、篩選、刪除短網址，並查看統計資訊

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

建立短網址：

```bash
curl -X POST http://localhost:8000/api/links \
  -H "Content-Type: application/json" \
  -d '{"original_url": "https://example.com", "expires_at": null}'
```

依短碼批次查詢：

```bash
curl "http://localhost:8000/api/links?codes=abc&codes=xyz"
```

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

## CI/CD 流程

CI/CD 設定在 `.github/workflows/ci-cd.yaml`，workflow 名稱為 `CICD`。

觸發條件：

- `pull_request` 到 `main`：執行檢查與測試，不部署
- `push` 到 `main`：執行檢查、測試，通過後部署
- `workflow_dispatch`：可手動觸發

CI 階段：

1. `lint-and-type-check`
   - Checkout 程式碼
   - 設定 Python 3.13
   - 安裝 uv
   - 在 `backend/` 執行 `uv sync --group dev`
   - 執行 `uv run ruff check .`
   - 執行 `uv run ruff format --check .`
   - 執行 `uv run mypy .`
   - 設定 Node.js 24，並以 `frontend/package-lock.json` 快取 npm
   - 在 `frontend/` 執行 `npm ci`
   - 執行 `npm run lint`

2. `test`
   - 等待 `lint-and-type-check` 成功
   - 啟動 GitHub Actions service container：Redis 7 與 PostgreSQL 18
   - 設定 Python 3.13 與 uv
   - 在 `backend/` 執行 `uv sync --all-extras`
   - 使用測試用 PostgreSQL 執行 `uv run alembic upgrade head`
   - 執行 `uv run alembic check` 確認沒有遺漏 migration
   - 執行 `uv run pytest`
   - 設定 Node.js 24
   - 在 `frontend/` 執行 `npm ci`
   - 執行 `npm test`
   - 執行 `npm run build`

CD 階段只會在 `push` 到 `main` 時執行：

1. `deploy`
   - 等待 `test` 成功
   - 設定 Docker Buildx
   - 使用 `GITHUB_TOKEN` 登入 GHCR
   - 建置並推送後端映像檔：
     - `ghcr.io/henrychang47/url-shortener/backend:${GITHUB_SHA}`
     - `ghcr.io/henrychang47/url-shortener/backend:latest`
   - 建置並推送前端映像檔：
     - `ghcr.io/henrychang47/url-shortener/frontend:${GITHUB_SHA}`
     - `ghcr.io/henrychang47/url-shortener/frontend:latest`
   - 透過 GitHub OIDC 假設 AWS IAM role，role 來源為 repository variable `AWS_ROLE_TO_ASSUME`，若未設定則使用 secret `AWS_ROLE_TO_ASSUME`
   - 在 AWS `ap-east-2` 查找唯一一台狀態為 running 且標籤 `App=url-shortener` 的 EC2 instance
   - 執行 `.github/scripts/build_ssm_payload.py`，將映像檔 tag、`compose.prod.yaml` 與 `nginx/conf.d/default.conf` 打包成 SSM command payload
   - 透過 AWS Systems Manager `AWS-RunShellScript` 在 EC2 上部署

EC2 上的部署動作：

1. 建立 `/opt/url-shortener/nginx/conf.d`
2. 寫入最新的 `compose.prod.yaml` 與 Nginx 設定
3. 確認 `/opt/url-shortener/.env` 已存在
4. 匯出 `BACKEND_IMAGE` 與 `FRONTEND_IMAGE`
5. Pull 後端、migration、前端 Nginx 與 Cloudflare Tunnel 映像檔
6. 啟動 PostgreSQL 與 Redis
7. 執行 `migrate` 服務完成 Alembic migration
8. 啟動 backend、nginx 與 cloudflare-tunnel
9. 以 `curl --fail http://localhost/health` 驗證部署結果
10. 顯示 `docker compose ps`
11. 執行 `docker image prune -f` 清理未使用映像檔

正式環境對外網址為 https://app.henry.christmas/url-shortener/，流量由 Cloudflare Tunnel 連到 EC2 上的 Nginx，再轉送到前端或後端服務。

## 專案現況核對

目前 README 描述已依照下列檔案核對：

- `compose.yaml`：本機 Docker Compose 服務、health check、port 與 `ROOT_PATH=/url-shortener`
- `compose.prod.yaml`：正式環境映像檔、Cloudflare Tunnel、資源限制與服務相依性
- `nginx/conf.d/default.conf`：前端、API、短網址轉址、Swagger UI 與 health check 路由
- `.github/workflows/ci-cd.yaml`：CI/CD 觸發條件、測試流程、GHCR 建置推送與 AWS SSM 部署
- `.github/scripts/build_ssm_payload.py`：EC2 實際部署命令
- `backend/pyproject.toml`：Python 版本、後端依賴與測試工具
- `frontend/package.json`：Node 前端 script 與測試/build 指令
- `frontend/vite.config.ts` 與 `frontend/src/config.ts`：前端 base path 與 API path
