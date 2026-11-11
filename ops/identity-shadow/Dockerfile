# Isolated, one-shot; never hosts a public HTTP server.
# Contains only the application dependencies needed to preserve existing
# canonical account and ticket models while adding verified Telegram shadows.
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/work/backend/src
WORKDIR /work
COPY backend/src/requirements.txt /tmp/backend-requirements.txt
RUN python -m pip install --no-cache-dir -r /tmp/backend-requirements.txt
COPY backend/src /work/backend/src
COPY scripts/audit_auth_identities.py scripts/backfill_verified_telegram_shadows.py /work/scripts/
RUN useradd -m -u 10001 identity && chown -R identity:identity /work
USER identity
CMD ["python", "/work/scripts/backfill_verified_telegram_shadows.py"]
