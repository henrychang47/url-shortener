#!/bin/sh
set -e

echo ">>> Migrating db1..."
DATABASE_URL=$DATABASE_URL_DB1 uv run alembic upgrade head

echo ">>> Migrating db2..."
DATABASE_URL=$DATABASE_URL_DB2 uv run alembic upgrade head

echo ">>> All migrations completed."