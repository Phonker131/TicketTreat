# One-shot, isolated restore test. Never connects to production PostgreSQL.
# PostgreSQL 18 matches the encrypted backup worker's pg_dump/pg_restore.
FROM postgres:18-alpine
RUN apk add --no-cache python3 py3-pip && \
    python3 -m venv /opt/identity-audit && \
    /opt/identity-audit/bin/pip install --no-cache-dir \
      "boto3>=1.35,<2" "cryptography>=50,<51" \
      "SQLAlchemy>=2.0,<2.1" "psycopg2-binary>=2.9,<3"
ENV PATH="/opt/identity-audit/bin:${PATH}" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
WORKDIR /identity-worker
COPY scripts/offsite_backup.py scripts/backup_postgres.py \
     scripts/restore_offsite_backup.py scripts/audit_auth_identities.py \
     scripts/backfill_auth_identities.py /identity-worker/
COPY backend/migrations/20261111_auth_identities.sql /identity-worker/identity-migration.sql
COPY ops/identity-restore/restore_audit.py /identity-worker/restore_audit.py
RUN mkdir /identity-scratch && chmod 0700 /identity-scratch && \
    chown postgres:postgres /identity-scratch /identity-worker
USER postgres
CMD ["python", "/identity-worker/restore_audit.py"]
