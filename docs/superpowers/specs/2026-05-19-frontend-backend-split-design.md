# Frontend/Backend Split Design

## Status
Approved for planning.

## Goal
Split the application into a React + Vite frontend and an API-only FastAPI backend while preserving the current anonymous URL shortener behavior.

This is Phase 1 of the broader frontend/backend split with auth plan. Google login, user ownership, anonymous management tokens, and QR code support are intentionally deferred to a separate Phase 2 design.

## Current Context
The repository is already partly organized as a monorepo:

- `backend/` contains the FastAPI application, tests, Alembic migrations, Dockerfile, `pyproject.toml`, and `uv.lock`.
- `frontend/` exists but only contains a placeholder README.
- `backend/app/static/` still contains the browser UI.
- FastAPI already exposes API routes under `/api` and redirects under `/r/{code}`.
- nginx currently proxies `/url-shortener/` to the backend instead of serving frontend build assets.

## Scope
Phase 1 includes:

- Create a React + Vite frontend in `frontend/`.
- Rebuild the existing browser UI as React components.
- Preserve anonymous link creation, stats display, stats refresh, copy, delete, expiry input, and sessionStorage-based restoration.
- Generate new short URLs as `/url-shortener/r/{code}`.
- Make the backend API-only for application behavior.
- Configure nginx to serve the frontend and proxy backend API and redirect routes.
- Update Docker, compose, README, and CI assumptions to match separate frontend and backend workspaces.
- Update tests and verification commands for the split.

Phase 1 excludes:

- Google OAuth or OIDC login.
- `users` table or `links.owner_user_id`.
- Anonymous management tokens.
- User dashboards scoped by ownership.
- QR code endpoint or QR UI.
- Backward compatibility for legacy `/url-shortener/{code}` short links.

## Architecture
The root repository remains a monorepo with three responsibility areas:

- `frontend/`: React + Vite app, package config, frontend source, frontend tests, and build output.
- `backend/`: FastAPI app, Alembic, backend tests, backend Dockerfile, and Python config.
- repo root: Compose files, nginx config, README, CI/CD workflow, and deployment scripts.

The frontend is a static build served by nginx. It talks to the backend through same-origin paths under `/url-shortener/api/*`, so no browser-facing cross-origin setup is required in normal deployment.

The backend continues to expose canonical routes without the deployment prefix:

- `POST /api/links`
- `GET /api/links`
- `GET /api/links/{code}/stats`
- `DELETE /api/links/{code}`
- `GET /r/{code}`
- `GET /health`

nginx owns the public `/url-shortener` prefix and strips that prefix before proxying to the backend.

## Routing
Public routing after Phase 1:

- `GET /url-shortener/` serves the React app.
- `GET /url-shortener/assets/*` serves Vite build assets.
- `GET /url-shortener/api/*` proxies to FastAPI `/api/*`.
- `POST /url-shortener/api/*` proxies to FastAPI `/api/*`.
- `DELETE /url-shortener/api/*` proxies to FastAPI `/api/*`.
- `GET /url-shortener/r/{code}` proxies to FastAPI `/r/{code}`.
- `GET /health` remains the nginx health endpoint.
- `GET /backend-health` proxies to FastAPI `/health`.

SPA fallback applies only to frontend routes under `/url-shortener/`. It must not intercept `/url-shortener/api/*` or `/url-shortener/r/*`.

Legacy `/url-shortener/{code}` redirect compatibility is not supported in Phase 1. New short links must use `/url-shortener/r/{code}`.

## Frontend Behavior
The React app preserves the current anonymous workflow:

- Users submit a long URL and optional expiry date.
- The frontend calls `POST /url-shortener/api/links`.
- Created links render as result cards with short URL, original URL preview, click count, created date, expiry date, copy action, delete action, and refresh support.
- New short links use `${window.location.origin}/url-shortener/r/${code}`.
- Created link codes are stored in `sessionStorage` for the current browser session.
- On load, stored codes are fetched through `GET /url-shortener/api/links?codes=...`.
- Delete calls `DELETE /url-shortener/api/links/{code}` and removes the card on `204`.
- Stats refresh calls `GET /url-shortener/api/links?codes=...`.
- API errors map to user-facing messages for rate limits, validation failures, missing links, and unexpected failures.

The UI can improve structure while preserving behavior, but Phase 1 should avoid introducing new product features. The design should remain focused on a short-link dashboard rather than a marketing landing page.

## Backend Changes
The FastAPI app should no longer be responsible for serving the browser UI. Any remaining static files under `backend/app/static/` should either be removed during implementation or left unused until cleanup if a smaller implementation step needs that staging.

The backend API behavior should remain stable:

- Link creation still accepts `original_url` and optional `expires_at`.
- Redirect still increments click count in the background.
- Listing by `codes` still supports restoring session links.
- Delete still deletes by code without ownership checks.
- Rate limiting behavior remains unchanged.
- Existing read-after-write cookie behavior can remain if still useful for replica consistency.

`ROOT_PATH=/url-shortener` should be re-evaluated during implementation. If nginx strips the public prefix before proxying, the backend may not need `ROOT_PATH` for API behavior, but docs and OpenAPI URL generation should remain coherent.

## Build And Deployment
Frontend:

- Add `frontend/package.json` with `dev`, `build`, `lint`, and `test` scripts.
- Configure Vite for deployment under `/url-shortener/`.
- Ensure production build output can be served by nginx.

Backend:

- Backend commands run from `backend/`.
- Keep `uv run pytest`, `uv run ruff check .`, and `uv run mypy .` as preferred verification commands when available.
- Keep migrations and backend Docker image rooted in `backend/`.

Compose and nginx:

- Local compose should make frontend build assets available to nginx, either by building a frontend image/stage or by mounting build output for local development.
- Production compose should serve the built frontend assets from nginx and continue to run backend, migrate, PostgreSQL, Redis, and Cloudflare tunnel services.
- nginx config should explicitly order API and redirect proxy locations before SPA fallback.

CI/CD:

- Backend checks run from `backend/`.
- Frontend checks run from `frontend/`.
- Deployment must publish backend runtime artifacts and frontend static build assets together.

## Testing
Backend verification:

- Update backend tests for canonical backend routes if needed.
- Preserve tests for create, list, stats, delete, redirect, expiry, and rate-limit behavior.
- Keep redirect tests focused on backend `/r/{code}`.

Frontend verification:

- `npm run build` must pass.
- If a frontend test runner is added, cover create-link API interaction, session restore, stats refresh, delete success, and API error messages.

nginx/integration verification:

- `/url-shortener/` returns the React app.
- `/url-shortener/api/links` proxies to backend `/api/links`.
- `/url-shortener/r/{code}` proxies to backend `/r/{code}`.
- `/url-shortener/{code}` is not treated as a supported redirect.
- `/health` and `/backend-health` continue to work.

## Risks And Decisions
- The largest routing risk is SPA fallback accidentally swallowing API or redirect requests. nginx location ordering must make API and redirect routes explicit.
- Vite base path must match `/url-shortener/`, otherwise asset URLs will break in production.
- Removing FastAPI static serving changes the local development workflow. The README should clearly separate frontend dev server usage from production nginx serving.
- Not preserving `/url-shortener/{code}` is an intentional product decision for Phase 1.
- Auth-related schema changes are deferred, so Phase 1 should not alter the database model unless required by existing behavior.

## Approval
The Phase 1 direction was approved with these decisions:

- Treat the original plan as the final target and split it into phases.
- Phase 1 maintains the current anonymous URL shortener functionality.
- Phase 1 uses a full React + Vite frontend implementation.
- Legacy `/url-shortener/{code}` redirect compatibility is not required.
