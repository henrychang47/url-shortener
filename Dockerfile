FROM python:3.12-slim

WORKDIR /app

COPY pyproject.toml .
COPY uv.lock .

RUN pip install uv
RUN uv sync

COPY app app/
COPY alembic alembic/
COPY alembic.ini .
COPY entrypoint.sh .

RUN chmod +x entrypoint.sh

CMD ["bash", "entrypoint.sh"]
