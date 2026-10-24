# Isolated one-shot restore drill. No network listener, no production DB URL.
FROM postgres:18-alpine
RUN apk add --no-cache python3 py3-pip && \
    python3 -m venv /opt/restore-venv && \
    /opt/restore-venv/bin/pip install --no-cache-dir "boto3>=1.35,<2" "cryptography>=50,<51"
ENV PATH="/opt/restore-venv/bin:/usr/local/bin:/usr/bin:/bin" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
WORKDIR /drill
COPY scripts/offsite_backup.py scripts/restore_offsite_backup.py scripts/staging_restore_drill.py /drill/
RUN mkdir -p /scratch && chmod 0700 /scratch && chown postgres:postgres /scratch
USER postgres
CMD ["python","/drill/staging_restore_drill.py"]
