FROM python:3.12-slim
WORKDIR /audit
RUN pip install --no-cache-dir "psycopg2-binary>=2.9,<3" "Unidecode>=1.3,<2" "rapidfuzz>=3,<4"
COPY scripts/audit_account20.py /audit/profile.py
RUN python -m py_compile /audit/profile.py && useradd -m -u 10001 auditor
USER auditor
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
CMD ["python","/audit/profile.py"]
