import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


# session.py:
# Crowdly/app/backend/src/db/session.py
#
# parents[4]:
# Crowdly/
PROJECT_ROOT = Path(__file__).resolve().parents[4]
ENV_FILE = PROJECT_ROOT / ".env"

# Loads the local .env file.
# override=False ensures Railway variables take priority in production.
load_dotenv(
    dotenv_path=ENV_FILE,
    override=False,
)

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is not configured.\n"
        f"Expected local environment file: {ENV_FILE}"
    )


engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=300,
    pool_timeout=30,
    pool_size=5,
    max_overflow=10,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()