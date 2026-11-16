"""Broadcast preference isolation and suppression (disposable PostgreSQL only)."""
import os
import secrets
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from datetime import datetime, timezone
from fastapi.testclient import TestClient

if not os.getenv("DATABASE_URL", "").endswith("/tickettreat_ci"):
    raise RuntimeError("Refusing preference tests outside disposable PostgreSQL")

import main
from db.session import SessionLocal
from integration_pilot_ops import account_with_session
from demo_telegram import DemoTelegramIdentity
from demo_broadcast import (BroadcastPreference, BroadcastCampaign, _audience,
    render_broadcast_email, _deliver_telegram, blocked_telegram_ids)

class BroadcastPreferenceIntegration(unittest.TestCase):
    def test_own_settings_filter_both_channels_and_queued_email(self):
        with SessionLocal() as db:
            account, _, _, auth = account_with_session(db)
            other, _, _, other_auth = account_with_session(db)
            aid, gid, email, oid = account.id, account.guest_id, account.email, other.id
            tid = 7000000000 + secrets.randbelow(1000000000)
            db.add(DemoTelegramIdentity(telegram_id=tid,guest_id=gid))
            campaign = BroadcastCampaign(request_id=secrets.token_hex(16),
                actor_account_id=oid,scope="global",subject="Test announcement",
                message="Test operational announcement only.")
            db.add(campaign);db.commit();cid=campaign.id
        with TestClient(main.app) as client:
            path="/api/v1/auth/broadcast-preferences"
            self.assertEqual(client.get(path).status_code,401)
            self.assertEqual(client.get(path,headers=auth).json(),
                {"email_enabled":True,"telegram_enabled":True})
            result=client.put(path,headers=auth,json={"email_enabled":False,"telegram_enabled":False})
            self.assertEqual(result.status_code,200,result.text)
            self.assertEqual(client.get(path,headers=other_auth).json(),
                {"email_enabled":True,"telegram_enabled":True})
            with SessionLocal() as db:
                emails,ids=_audience(db,"global",None,main)
                self.assertNotIn(aid,[row[0] for row in emails])
                self.assertNotIn(tid,ids)
                self.assertIn(tid,blocked_telegram_ids(db))
                queued=SimpleNamespace(notice_id=cid,guest_id=gid,recipient=email)
                self.assertIsNone(render_broadcast_email(queued,db))
            result=client.put(path,headers=auth,json={"email_enabled":True,"telegram_enabled":False})
            self.assertEqual(result.status_code,200,result.text)
            with SessionLocal() as db:
                emails,ids=_audience(db,"global",None,main)
                self.assertIn(aid,[row[0] for row in emails])
                self.assertNotIn(tid,ids)
                with patch.dict(os.environ,{"EMAIL_FROM":"test@example.test"}):
                    self.assertIsNotNone(render_broadcast_email(queued,db))

    def test_queued_telegram_is_not_sent_after_unsubscribe(self):
        db=MagicMock()
        item=SimpleNamespace(attempts=0,campaign_id=1,telegram_id=123,state="pending")
        db.query.return_value.filter.return_value.order_by.return_value.with_for_update.return_value.first.return_value=item
        db.get.return_value=SimpleNamespace(id=1)
        with patch("demo_broadcast.blocked_telegram_ids",return_value={123}),patch("demo_broadcast._send_telegram") as send:
            self.assertTrue(_deliver_telegram(db))
            send.assert_not_called()
            self.assertEqual(item.state,"skipped")
