#!/usr/bin/env bash
# Keep backup/restore CI on the PostgreSQL 16 client when the runner ships 18.
# The backup script still invokes pg_dump normally, so this wrapper exercises
# the real backup code while sharing its archive output with the runner.
set -euo pipefail

exec docker run --rm --network host \
  --volume "$RUNNER_TEMP:$RUNNER_TEMP" \
  --env PGHOST --env PGPORT --env PGDATABASE \
  --env PGUSER --env PGPASSWORD --env PGSSLMODE \
  postgres:16 pg_dump "$@"
