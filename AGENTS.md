# AGENTS.md

Project-specific instructions for agents working in this repository.

## Branching
- Do not modify files directly on the `main` branch.
- Create or switch to a feature branch before making any changes.
- Use descriptive branch names following common practice, such as `feature/...`, `fix/...`, `chore/...`, or `docs/...`.
- Commit after each completed implementation slice or milestone instead of batching multiple slices into one commit.

## Repository Layout
- Keep backend code, tests, migrations, and Python config together.
- Keep frontend code, assets, tests, and package config together if a frontend is added.
- Keep deployment files such as Compose, nginx, and CI config at the repo root unless a change clearly requires moving them.

## Coding
- Follow modern development best practices when designing, implementing, testing, and reviewing changes.
- Follow existing FastAPI, SQLAlchemy, Alembic, Redis, and test patterns.
- Keep changes scoped to the requested task.
- Do not revert user changes unless explicitly asked.
- Prefer clear, typed Python and small, focused modules.

## Testing
- Add or update tests for behavior changes.
- Run the smallest relevant verification first, then broader checks when practical.
- For backend changes, prefer `uv run pytest`, `uv run ruff check .`, and `uv run mypy .`.

## Frontend
- Use React + Vite if implementing the planned frontend split.
- Use Tailwind CSS and shadcn/ui for frontend styling and components.
- Keep UI functional, responsive, and consistent with the app's short-link dashboard purpose.
- Avoid adding heavy dependencies unless they materially simplify the feature.

## Deployment
- Keep Docker, nginx, and CI changes aligned.
- Document new environment variables in `.env.example` and `README.md`.
