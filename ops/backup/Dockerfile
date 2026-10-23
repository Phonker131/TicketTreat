# Dedicated, private Railway cron job. pg_dump/pg_restore MUST match PostgreSQL 18.
FROM postgres:18-alpine
RUN apk add --no-cache python3 py3-pip && \
    python3 -m venv /opt/tickettreat-venv && \
    /opt/tickettreat-venv/bin/pip install --no-cache-dir "boto3>=1.35,<2" "cryptography>=50,<51"
ENV PATH="/opt/tickettreat-venv/bin:${PATH}" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
WORKDIR /backup-worker
COPY scripts/backup_postgres.py scripts/offsite_backup.py /backup-worker/
RUN addgroup -S backup && adduser -S -G backup backup && \
    mkdir -p /scratch && chmod 0700 /scratch && chown backup:backup /scratch
USER backup
CMD ["python","/backup-worker/offsite_backup.py","--scratch-dir","/scratch"]
