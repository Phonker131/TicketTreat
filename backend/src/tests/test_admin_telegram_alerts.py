"""Unit tests for privacy-safe Telegram notifications to real global admins.

No production database, bot credentials or Telegram calls.
"""
import os
import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import patch
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from demo_accounts import WebAccount
from demo_account_recovery import VerifiedEmail
from demo_roles import (WebAccountRole, GlobalAdminBinding, GlobalAdminDelegation,
                        OrganizerApplication)
from demo_support import SupportTicket, SupportMessage
from demo_telegram import DemoTelegramIdentity
from demo_admin_telegram_alerts import (
    linked_global_admins, enqueue_admin_alert, render_admin_alert,
)


class GlobalAdminTelegramAlertTests(unittest.TestCase):
    def setUp(self):
        self.engine=create_engine("sqlite://", connect_args={"check_same_thread":False},
                                  poolclass=StaticPool)
        for model in (WebAccount, VerifiedEmail, WebAccountRole, GlobalAdminBinding,
                      GlobalAdminDelegation, DemoTelegramIdentity, OrganizerApplication,
                      SupportTicket, SupportMessage):
            model.__table__.create(self.engine)
        self.db=sessionmaker(bind=self.engine)()
        for i in (1,2,3,4,5):
            self.db.add(WebAccount(id=i,email=f"user{i}@example.invalid",
                first_name=f"Test{i}",last_name="User",password_hash="test",guest_id=i))
        self.db.flush()
        # Global admins 2 and 3; account 4 is not an admin, account 5 lacks
        # email verification even though it is configured as an admin.
        for i in (1,2,3,4):
            self.db.add(VerifiedEmail(account_id=i,verified_at=datetime.now(timezone.utc)))
        for i in (2,3,4,5):
            self.db.add(DemoTelegramIdentity(guest_id=i,telegram_id=1000+i))
        self.db.add(WebAccountRole(account_id=4,role="organizer"))
        self.db.flush()
        self.env=patch.dict(os.environ,{"GLOBAL_ADMIN_ACCOUNT_IDS":"2,3,5",
            "GLOBAL_ADMIN_EMAILS":"","WEB_APP_URL":"https://tickettreat.eu"})
        self.env.start()

    def tearDown(self):
        self.env.stop()
        self.db.close()
        self.engine.dispose()

    def row(self,kind,notice_id,tg_id=1002,language="en"):
        return SimpleNamespace(kind=kind,notice_id=notice_id,event_id=0,
                               telegram_id=tg_id,language=language)

    def test_fans_out_exactly_to_two_verified_linked_global_admins(self):
        self.assertEqual(set(linked_global_admins(self.db)), {(2,1002),(3,1003)})
        with patch("demo_telegram_notifications.configured",return_value=True), \
             patch("demo_telegram_notifications._insert_rows") as inserted:
            count=enqueue_admin_alert(self.db,kind="admin_organizer",object_id=1,
                                      notification_id=1,occurrence="123456")
        self.assertEqual(count,2)
        rows=inserted.call_args.args[1]
        self.assertEqual({r["telegram_id"] for r in rows},{1002,1003})
        self.assertEqual({r["event_key"] for r in rows},
            {"tg:admin_organizer:1:123456:1002","tg:admin_organizer:1:123456:1003"})
        self.assertTrue(all(r["event_id"]==0 and r["kind"]=="admin_organizer" for r in rows))

    def test_no_delivery_to_unknown_unverified_or_revoked_admin(self):
        ticket=SupportTicket(id=100,account_id=1,category="technical",
                             subject="Secret card data <script>",status="open")
        msg=SupportMessage(id=200,ticket_id=100,author_account_id=1,
                           author_role="customer",body="Sensitive access token")
        self.db.add_all([ticket,msg])
        self.db.flush()
        for tg_id in (1004,1005,1999):
            self.assertIsNone(render_admin_alert(self.db,
                self.row("admin_support_new",200,tg_id)))
        self.assertIsNotNone(render_admin_alert(self.db,
            self.row("admin_support_new",200,1002)))
        self.env.stop()
        self.env=patch.dict(os.environ,{"GLOBAL_ADMIN_ACCOUNT_IDS":"3,5",
            "GLOBAL_ADMIN_EMAILS":"","WEB_APP_URL":"https://tickettreat.eu"})
        self.env.start()
        self.assertIsNone(render_admin_alert(self.db,
            self.row("admin_support_new",200,1002)))

    def test_support_link_and_no_customer_text_leak(self):
        ticket=SupportTicket(id=111,account_id=1,category="technical",
                             subject="<svg onload=alert(1)>",status="open")
        message=SupportMessage(id=222,ticket_id=111,author_account_id=1,
                               author_role="customer",body="Password=secret")
        self.db.add_all([ticket,message]);self.db.flush()
        for kind in ("admin_support_new","admin_support_reply"):
            text,markup=render_admin_alert(self.db,self.row(kind,222))
            self.assertIn("#111",text)
            self.assertNotIn("Password",text)
            self.assertNotIn("<svg",text)
            self.assertNotIn("user1@",text)
            self.assertEqual(markup["inline_keyboard"][0][0]["url"],
                             "https://tickettreat.eu/admin/support?ticket=111")
        message.author_role="admin"
        self.assertIsNone(render_admin_alert(self.db,self.row("admin_support_reply",222)))

    def test_organizer_alert_only_for_pending_applications(self):
        self.db.add(OrganizerApplication(account_id=1,status="pending"))
        self.db.flush()
        text,markup=render_admin_alert(self.db,self.row("admin_organizer",1,1002,"cs"))
        self.assertIn("žádost",text)
        self.assertIn("#1",text)
        self.assertEqual(markup["inline_keyboard"][0][0]["url"],
                         "https://tickettreat.eu/admin/organizers")
        self.db.get(OrganizerApplication,1).status="approved"
        self.assertIsNone(render_admin_alert(self.db,self.row("admin_organizer",1)))

    def test_invalid_alert_cannot_be_queued_or_sent(self):
        with self.assertRaises(ValueError):
            enqueue_admin_alert(self.db,kind="event_notice",object_id=1,
                                notification_id=1)
        self.assertIsNone(render_admin_alert(self.db,self.row("admin_support_new",0)))
        self.assertIsNone(render_admin_alert(self.db,
            SimpleNamespace(kind="admin_support_new",notice_id=200,
                            event_id=10,telegram_id=1002,language="en")))


if __name__=="__main__":
    unittest.main()
