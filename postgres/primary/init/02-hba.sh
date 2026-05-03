#!/bin/bash
# 等 pg_hba.conf 存在後 append replication 規則
set -e

PG_HBA=$(psql -U postgres -t -c "SHOW hba_file;" | tr -d ' ')

echo "host replication replicator all scram-sha-256" >> "$PG_HBA"

psql -U postgres -c "SELECT pg_reload_conf();"