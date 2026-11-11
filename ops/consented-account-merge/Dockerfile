# Separate, one-shot operator worker. No public domain, never auto-run writes.
FROM python:3.12-slim
WORKDIR /merge-worker
RUN python -m pip install --no-cache-dir "psycopg2-binary>=2.9,<3"
COPY scripts/admin_merge_consented_accounts.py /merge-worker/merge.py
RUN useradd -m -u 10001 mergeagent && chown -R mergeagent:mergeagent /merge-worker
USER mergeagent
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
CMD ["python","/merge-worker/merge.py"]
