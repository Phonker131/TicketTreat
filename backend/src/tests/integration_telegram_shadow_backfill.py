"""One-shot historical Telegram backfill must preserve event and ticket owners."""
import os
import secrets
import sys
import unittest
from datetime import datetime,timedelta,timezone
from decimal import Decimal
from pathlib import Path
from unittest.mock import patch

if not os.getenv("DATABASE_URL","").endswith("/tickettreat_ci"):
    raise RuntimeError("Never run historical backfill test outside disposable CI")

sys.path.insert(0,str(Path(__file__).resolve().parents[3]/"scripts"))
from backfill_verified_telegram_shadows import run

import main
from db.session import SessionLocal
from demo_accounts import AuthIdentity,WebAccount
from demo_telegram import DemoTelegramIdentity
from demo_roles import role_for


class HistoricalTelegramShadowBackfillTests(unittest.TestCase):
    def test_only_verified_mapping_gains_canonical_account_no_ticket_moves(self):
        telegram_id=secrets.randbelow(10**12)+10**10
        with SessionLocal() as db:
            guest=main.DemoGuest(
                access_token=secrets.token_urlsafe(32),first_name="Legacy TG",
                last_name="Owner",telegram_id=telegram_id,email=None,
            )
            event=main.Event(
                title="Preserved historical QR",price=Decimal("0"),
                currency="CZK",starts_at=(datetime.now(timezone.utc)+timedelta(days=7)).replace(tzinfo=None),
                max_participants=10,
            )
            db.add_all([guest,event]);db.flush()
            db.add(DemoTelegramIdentity(telegram_id=telegram_id,guest_id=guest.id))
            ticket=main.DemoTicket(
                event_id=event.id,guest_id=guest.id,qr_token=secrets.token_urlsafe(32),
                ticket_status="active",payment_status="not_required",
                payment_provider="free",payment_amount="0",currency="CZK",
            )
            db.add(ticket);db.commit()
            guest_id=guest.id
            ticket_id=ticket.id

        with patch.dict(os.environ,{"TICKETTREAT_IDENTITY_REGISTRY_MODE":"shadow"}):
            dry=run(os.environ["DATABASE_URL"],apply=False)
            self.assertEqual(dry["status"],"dry_run_only")
            self.assertGreaterEqual(dry["eligible_verified_telegram_guests"],1)
            first=run(os.environ["DATABASE_URL"],apply=True)
            self.assertEqual(first["status"],"verified_telegram_shadows_created")
            self.assertGreaterEqual(first["created"],1)
            second=run(os.environ["DATABASE_URL"],apply=True)
            self.assertEqual(second["created"],0)

        with SessionLocal() as db:
            account=db.query(WebAccount).filter(WebAccount.guest_id==guest_id).one()
            self.assertIsNone(account.email)
            self.assertEqual(role_for(db,account),"participant")
            claim=db.query(AuthIdentity).filter(
                AuthIdentity.provider=="telegram",
                AuthIdentity.provider_subject==str(telegram_id),
            ).one()
            self.assertEqual(claim.account_id,account.id)
            ticket=db.get(main.DemoTicket,ticket_id)
            self.assertEqual(ticket.guest_id,guest_id)
            self.assertEqual(ticket.ticket_status,"active")


if __name__=="__main__":
    unittest.main()
