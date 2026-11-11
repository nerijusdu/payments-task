#!/bin/sh
# One instance, one schema per owner, one role per app limited to its schema.
set -e
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<SQL
CREATE ROLE payments_api LOGIN PASSWORD '${PAYMENTS_DB_PASSWORD}';
CREATE ROLE psp_adapter LOGIN PASSWORD '${ADAPTER_DB_PASSWORD}';

CREATE SCHEMA payments AUTHORIZATION payments_api;
CREATE SCHEMA adapter AUTHORIZATION psp_adapter;
-- pgboss is created and migrated by payments-api (pg-boss needs CREATE on the DB to run
-- CREATE SCHEMA IF NOT EXISTS); the adapter only gets DML.
GRANT CREATE ON DATABASE payments TO payments_api;
CREATE SCHEMA pgboss AUTHORIZATION payments_api;

GRANT USAGE ON SCHEMA pgboss TO psp_adapter;
ALTER DEFAULT PRIVILEGES FOR ROLE payments_api IN SCHEMA pgboss
  GRANT SELECT, INSERT, UPDATE ON TABLES TO psp_adapter;
ALTER DEFAULT PRIVILEGES FOR ROLE payments_api IN SCHEMA pgboss
  GRANT USAGE ON SEQUENCES TO psp_adapter;
ALTER DEFAULT PRIVILEGES FOR ROLE payments_api IN SCHEMA pgboss
  GRANT EXECUTE ON FUNCTIONS TO psp_adapter;

ALTER ROLE payments_api SET search_path = payments;
ALTER ROLE psp_adapter SET search_path = adapter;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
SQL
