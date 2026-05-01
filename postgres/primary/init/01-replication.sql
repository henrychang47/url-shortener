-- 建立 replication 專用帳號
CREATE ROLE replicator
WITH
    REPLICATION LOGIN PASSWORD 'replicator_pass';