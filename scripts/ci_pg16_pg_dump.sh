#!/usr/bin/env bash
# CI-only wrapper: preserve the backup script's pg_dump invocation while
# matching the PostgreSQL 16 server's archive format and SQL compatibility.
set -euo pipefail

exec docker run --rm --network host \
  --volume "${RUNNER_TEMP:?RUNNER_TEMP must be set}:${RUNNER_TEMP}" \
  --env PGHOST --env PGPORT --env PGDATABASE --env PGUSER --env PGPASSWORD \
  postgres:16 pg_dump "$@"
