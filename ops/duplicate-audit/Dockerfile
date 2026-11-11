# One-shot forensic audit; NO app imports and NO database writes.
FROM python:3.12-slim
WORKDIR /audit
RUN python -m pip install --no-cache-dir \
    "psycopg2-binary>=2.9,<3" "Unidecode>=1.3,<2" "rapidfuzz>=3,<4"
COPY scripts/audit_possible_duplicate_users.py /audit/audit.py
RUN useradd -m -u 10001 auditor && chown -R auditor:auditor /audit
USER auditor
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
CMD ["python", "/audit/audit.py"]
