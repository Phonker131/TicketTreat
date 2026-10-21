"""Preserve legacy Telegram reservations while issuing canonical QR passes for free events."""
import hashlib,hmac,json,os,secrets,time,unittest
from datetime import datetime,timedelta,timezone
from decimal import Decimal
from urllib.parse import urlencode
from fastapi.testclient import TestClient

if not os.getenv("DATABASE_URL","").endswith("/tickettreat_ci"):
    raise RuntimeError("Disposable test database required")
import main
from db.session import SessionLocal
from demo_legacy import LegacyTicketClaim

BOT_TOKEN="ci-only-bot-token-not-production"
os.environ["TELEGRAM_MINIAPP_BOT_TOKEN"]=BOT_TOKEN


def signed(tid):
    data={"auth_date":str(int(time.time())),
          "user":json.dumps({"id":tid,"first_name":"Existing User"},separators=(",",":"))}
    message="\n".join(f"{k}={v}" for k,v in sorted(data.items()))
    key=hmac.new(b"WebAppData",BOT_TOKEN.encode(),hashlib.sha256).digest()
    data["hash"]=hmac.new(key,message.encode(),hashlib.sha256).hexdigest()
    return urlencode(data)


class LegacyMigrationTests(unittest.TestCase):
    def test_free_legacy_is_claimed_once_and_paid_legacy_held(self):
        tid=secrets.randbelow(10**12)+10**10
        with SessionLocal() as db:
            user=main.User(telegram_id=tid,first_name="Existing User")
            free=main.Event(title="Free legacy test",price=Decimal("0"),
                starts_at=datetime.now(timezone.utc).replace(tzinfo=None)+timedelta(days=4),
                max_participants=1,currency="CZK")
            paid=main.Event(title="Paid legacy test",price=Decimal("250"),
                starts_at=datetime.now(timezone.utc).replace(tzinfo=None)+timedelta(days=4),
                max_participants=3,currency="CZK")
            db.add_all([user,free,paid]);db.flush()
            r1=main.Registration(user_id=user.id,event_id=free.id)
            r2=main.Registration(user_id=user.id,event_id=paid.id)
            db.add_all([r1,r2]);db.commit()
            free_id,paid_id,legacy_id=free.id,paid.id,r1.id
        self.assertEqual(main.get_registered_count(SessionLocal(),free_id),1)
        launch=signed(tid)
        with TestClient(main.app) as client:
            login=client.post("/demo/telegram/auth",json={"init_data":launch})
            self.assertEqual(login.status_code,200,login.text)
            self.assertEqual(login.json()["legacy_reconciliation"]["converted"],1)
            self.assertGreaterEqual(login.json()["legacy_reconciliation"]["held_for_review"],1)
            self.assertEqual(login.json()["guest"]["access_token"],"")
            list_resp=client.get("/demo/me/tickets",
                headers={"X-Telegram-Init-Data":launch})
            self.assertEqual(list_resp.status_code,200,list_resp.text)
            tickets=list_resp.json()
            self.assertEqual(len(tickets),1)
            self.assertEqual(tickets[0]["event_id"],free_id)
            self.assertEqual(tickets[0]["payment_provider"],"legacy_free")
            self.assertEqual(main.get_registered_count(SessionLocal(),free_id),1)
            self.assertEqual(main.get_registered_count(SessionLocal(),paid_id),1)
            self.assertEqual({x["id"] for x in login.json()["bot_registrations"]},{paid_id})
            repeat=client.post("/demo/telegram/auth",json={"init_data":launch})
            self.assertEqual(repeat.status_code,200,repeat.text)
            self.assertEqual(repeat.json()["legacy_reconciliation"]["converted"],0)
            with SessionLocal() as db:
                claim=db.get(LegacyTicketClaim,legacy_id)
                self.assertIsNotNone(claim)
                self.assertEqual(claim.ticket_id,tickets[0]["id"])
                preserved=db.get(main.Registration,legacy_id)
                self.assertIsNotNone(preserved)
            # Cancelling the canonical ticket must not leave a ghost "joined"
            # event in the historical Telegram bot event list.
            cancelled=client.delete(
                f"/demo/me/tickets/{tickets[0]['id']}",
                headers={"X-Telegram-Init-Data":launch},
            )
            self.assertEqual(cancelled.status_code,200,cancelled.text)
            with SessionLocal() as db:
                visible=main.get_user_events(tid,include_past=True,db=db)
                self.assertEqual({e["id"] for e in visible},{paid_id})
                self.assertIsNotNone(db.get(main.Registration,legacy_id))
                self.assertEqual(main.get_registered_count(db,free_id),0)



if __name__=="__main__":
    unittest.main()
