FROM python:3.12-slim
WORKDIR /audit
RUN python -m pip install --no-cache-dir "psycopg2-binary>=2.9,<3"
COPY scripts/audit_timur_account_provenance.py /audit/target.py
RUN useradd -m -u 10001 auditor && chown -R auditor:auditor /audit
USER auditor
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
CMD ["python", "/audit/target.py"]
