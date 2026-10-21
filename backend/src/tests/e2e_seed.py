"""Disposable PostgreSQL fixture for headless browser E2E.

Never run against live databases. The CI user and password are placeholders.
"""
import os
from datetime import datetime,timedelta,timezone
from decimal import Decimal
from pathlib import Path
import sys

if not os.environ.get("DATABASE_URL","").endswith("/tickettreat_ci"):
    raise RuntimeError("Browser fixture requires disposable tickettreat_ci database")

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import main
from db.session import SessionLocal
from demo_accounts import WebAccount
from demo_account_recovery import VerifiedEmail,now
from demo_auth_security import hash_password

with SessionLocal() as db:
    event=main.Event(
        title="CI browser free event",
        price=Decimal("0"),
        currency="CZK",
        starts_at=datetime.now(timezone.utc).replace(tzinfo=None)+timedelta(days=4),
        max_participants=20,
    )
    db.add(event)
    guest=main.DemoGuest(
        access_token="ci-browser-guest-not-a-production-secret-"+str(os.getpid()),
        first_name="Browser",last_name="Tester",
        email="browser-e2e@example.invalid",
    )
    db.add(guest)
    db.flush()
    account=WebAccount(
        email="browser-e2e@example.invalid",
        password_hash=hash_password("Browser-only-testing-passphrase-2026"),
        first_name="Browser",last_name="Tester",
        guest_id=guest.id,contact_preference="email",
    )
    db.add(account);db.flush()
    db.add(VerifiedEmail(account_id=account.id,verified_at=now()))
    db.commit()
print("Disposable browser fixtures installed (no user data)")
