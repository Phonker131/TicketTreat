"""PostgreSQL integration: customer support/organizer request alerts share transactions.

Never run against production. Telegram sendMessage is NOT invoked.
"""
import os
import secrets
import unittest
from unittest.mock import patch

if not os.getenv("DATABASE_URL","").endswith("/tickettreat_ci"):
    raise RuntimeError("Refusing Telegram admin alert integration outside CI database")

from fastapi.testclient import TestClient
import main
from db.session import SessionLocal
from demo_telegram import DemoTelegramIdentity
from demo_telegram_notifications import TelegramNotificationOutbox
from integration_pilot_ops import account_with_session


class AdminTelegramAlertIntegration(unittest.TestCase):
    def test_both_linked_global_admins_receive_one_alert_per_user_action(self):
        with SessionLocal() as db:
            admin1, guest1, _, _ = account_with_session(db)
            admin2, guest2, _, _ = account_with_session(db)
            ordinary, guest3, _, _ = account_with_session(db)
            applicant, _, _, applicant_auth = account_with_session(db)
            _, _, _, customer_auth = account_with_session(db)
            ids=[(admin1.id, guest1.id),(admin2.id,guest2.id),
                 (ordinary.id, guest3.id)]
            unique=1000000000000+secrets.randbelow(10000000)*10
            tgs=[unique+1,unique+2,unique+3]
            for (_,gid),tg in zip(ids,tgs):
                db.add(DemoTelegramIdentity(guest_id=gid,telegram_id=tg))
            db.commit()

        with patch.dict(os.environ,{
            "GLOBAL_ADMIN_ACCOUNT_IDS":f"{ids[0][0]},{ids[1][0]}",
            "GLOBAL_ADMIN_EMAILS":"", 
        }):
            # Suppress the Telegram worker at app startup and any network calls.
            with patch("demo_telegram_notifications.configured",return_value=False):
                with TestClient(main.app) as client:
                    with patch("demo_telegram_notifications.configured",return_value=True):
                        new=client.post("/demo/support/tickets",headers=customer_auth,json={
                            "category":"technical","subject":"I need help with a ticket",
                            "body":"Ticket missing on my account, please help with this booking.",
                        })
                        self.assertEqual(new.status_code,201,new.text)
                        ticket_id=new.json()["id"]
                        reply=client.post(f"/demo/support/tickets/{ticket_id}/messages",
                            headers=customer_auth,
                            json={"body":"I have more information about this issue."})
                        self.assertEqual(reply.status_code,201,reply.text)
                        apply=client.post("/demo/auth/organizer-application",headers=applicant_auth)
                        self.assertEqual(apply.status_code,202,apply.text)
                        apply_again=client.post("/demo/auth/organizer-application",headers=applicant_auth)
                        self.assertEqual(apply_again.status_code,202,apply_again.text)

            with SessionLocal() as db:
                rows=db.query(TelegramNotificationOutbox).filter(
                    TelegramNotificationOutbox.telegram_id.in_(tgs)).all()
                ours=[r for r in rows if r.kind.startswith("admin_")]
                self.assertEqual(len(ours),6)
                self.assertEqual({r.telegram_id for r in ours},set(tgs[:2]))
                self.assertEqual({r.kind for r in ours},{
                    "admin_support_new","admin_support_reply","admin_organizer"})
                self.assertEqual({r.event_id for r in ours},{0})
                self.assertTrue(all(r.state=="pending" and r.attempts==0 for r in ours))
                # Customer content and email are not persisted into Telegram rows.
                self.assertTrue(all("Ticket missing" not in r.event_key for r in ours))
                self.assertEqual(len({r.event_key for r in ours}),6)


if __name__=="__main__":
    unittest.main()
