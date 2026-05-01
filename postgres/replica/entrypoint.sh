#!/bin/bash
set -e

PGDATA="/var/lib/postgresql/data"

# 只在 data dir 為空時才做 basebackup（避免重啟時重跑）
if [ ! -f "${PGDATA}/PG_VERSION" ]; then
  echo ">>> Running pg_basebackup..."
  PGPASSWORD=replicator_pass pg_basebackup \
    -h pg-primary \
    -p 5432 \
    -U replicator \
    -D "${PGDATA}" \
    -P -Xs -R

  # 修正權限
  chown -R postgres:postgres "${PGDATA}"
  chmod 700 "${PGDATA}"
fi

echo ">>> Starting PostgreSQL as standby..."
exec gosu postgres postgres