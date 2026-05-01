FROM python:3.12-slim

WORKDIR /app

COPY pyproject.toml .
COPY uv.lock .

RUN pip install uv
RUN uv sync

COPY app app/
COPY alembic alembic/
COPY alembic.ini .
COPY ./migrate.sh .
RUN chmod +x /app/migrate.sh

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
