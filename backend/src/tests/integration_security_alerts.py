"""Exercise both security triggers against isolated PostgreSQL; never send Telegram messages."""
import os
import secrets
import unittest
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch

if not os.getenv("DATABASE_URL", "").endswith("/tickettreat_ci"):
    raise RuntimeError("Disposable CI database required")

from fastapi.testclient import TestClient
import main
from db.session import SessionLocal
from demo_account_bans import PermanentAccountBan
from demo_admin_telegram_alerts import render_admin_alert
from demo_security_alerts import SecurityAlertWindow
from demo_telegram import DemoTelegramIdentity
from demo_telegram_notifications import TelegramNotificationOutbox
from integration_pilot_ops import account_with_session


class SecurityAlertTests(unittest.TestCase):
    def test_verified_denials_are_correlated_and_deduplicated(self):
        with SessionLocal() as db:
            admin, guest, _, _ = account_with_session(db)
            participant, _, _, auth = account_with_session(db)
            admin_id, actor_id = admin.id, participant.id
            db.add(DemoTelegramIdentity(guest_id=guest.id,
                                        telegram_id=2_000_000_000_000 + secrets.randbelow(10**8)))
            db.commit()

        with patch.dict(os.environ, {"GLOBAL_ADMIN_ACCOUNT_IDS": str(admin_id), "GLOBAL_ADMIN_EMAILS": ""}), \
             patch("demo_telegram_notifications.configured", return_value=False), TestClient(main.app) as client, \
             patch("demo_telegram_notifications.configured", return_value=True):
            route = "/demo/manage/global-admins"
            self.assertEqual(client.get(route).status_code, 401)
            for _ in range(2):
                self.assertEqual(client.get(route, headers=auth).status_code, 403)
            with SessionLocal() as db:
                window = db.query(SecurityAlertWindow).filter_by(actor_id=actor_id).one()
                self.assertIsNone(window.alerted_at)
            with ThreadPoolExecutor(3) as pool:
                responses = list(pool.map(lambda _: client.get("/demo/manage/accounts", headers=auth), range(3)))
            self.assertTrue(all(r.status_code == 403 for r in responses))
            request_ids = {r.headers["X-Request-ID"] for r in responses}
            with SessionLocal() as db:
                db.add(PermanentAccountBan(account_id=actor_id, reason="CI fixture"))
                db.commit()
            blocked = client.get(route, headers=auth)
            self.assertEqual(blocked.json()["detail"], "account_banned")
            self.assertEqual(client.get(route, headers=auth).status_code, 403)
            with SessionLocal() as db:
                windows = {w.kind: w for w in db.query(SecurityAlertWindow).filter_by(actor_id=actor_id)}
                self.assertEqual(set(windows), {"banned_actor", "admin_denials"})
                self.assertIn(windows["admin_denials"].request_id, request_ids)
                self.assertEqual(windows["banned_actor"].request_id, blocked.headers["X-Request-ID"])
                for window in windows.values():
                    row = db.query(TelegramNotificationOutbox).filter_by(kind="admin_security", notice_id=window.id).one()
                    text, _ = render_admin_alert(db, row)
                    self.assertIn(window.request_id, text)
                    self.assertIn("UTC", text)
