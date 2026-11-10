"""One-use Telegram bot-approved desktop login, on disposable CI PostgreSQL."""
import os
import secrets
import unittest

from fastapi.testclient import TestClient

if not os.getenv("DATABASE_URL","").endswith("/tickettreat_ci"):
    raise RuntimeError("Run only against disposable CI database")

import main
from db.session import SessionLocal
from demo_accounts import WebAccount
from demo_telegram import DemoTelegramIdentity
from integration_telegram_browser_link import BOT_TOKEN,signed_init_data


class BotApprovedWebLoginTests(unittest.TestCase):
    def setUp(self):
        self.old=os.environ.get("TELEGRAM_MINIAPP_BOT_TOKEN")
        os.environ["TELEGRAM_MINIAPP_BOT_TOKEN"]=BOT_TOKEN

    def tearDown(self):
        if self.old is None:os.environ.pop("TELEGRAM_MINIAPP_BOT_TOKEN",None)
        else:os.environ["TELEGRAM_MINIAPP_BOT_TOKEN"]=self.old

    def test_bot_first_browser_approval_reuses_guest_and_issues_one_session(self):
        tg_id=secrets.randbelow(10**12)+10**10
        other_id=secrets.randbelow(10**12)+10**10
        with TestClient(main.app) as client:
            signed=signed_init_data(tg_id)
            tg=client.post("/demo/telegram/auth",json={"init_data":signed})
            self.assertEqual(tg.status_code,200,tg.text)
            guest_id=tg.json()["guest"]["id"]
            started=client.post("/demo/auth/telegram/browser/start",json={})
            self.assertEqual(started.status_code,200,started.text)
            code=started.json()["challenge"]
            verifier=started.json()["browser_token"]
            pin=started.json()["pin"]
            self.assertRegex(pin,r"^[0-9]{6}$")
            self.assertNotIn(verifier,started.json()["bot_link"])
            self.assertNotIn(pin,started.json()["bot_link"])
            good={"X-Telegram-Browser-Token":verifier}
            body={"challenge":code}
            self.assertEqual(client.post("/demo/auth/telegram/browser/complete",json=body).status_code,401)
            self.assertEqual(client.post("/demo/auth/telegram/browser/complete",
                headers={"X-Telegram-Browser-Token":secrets.token_urlsafe(32)},
                json=body).status_code,401)
            pending=client.post("/demo/auth/telegram/browser/complete",headers=good,json=body)
            self.assertEqual(pending.status_code,200,pending.text)
            self.assertEqual(pending.json()["status"],"pending")
            invalid=client.post("/demo/auth/telegram/browser/claim",json={
                "challenge":code,"init_data":"unsigned_request"})
            self.assertEqual(invalid.status_code,401)
            missing_pin=client.post("/demo/auth/telegram/browser/claim",json={
                "challenge":code,"init_data":signed})
            self.assertEqual(missing_pin.status_code,422,missing_pin.text)
            invalid_pin=client.post("/demo/auth/telegram/browser/claim",json={
                "challenge":code,"init_data":signed,"pin":"000000" if pin!="000000" else "111111"})
            self.assertEqual(invalid_pin.status_code,400,invalid_pin.text)
            approved=client.post("/demo/auth/telegram/browser/claim",json={
                "challenge":code,"init_data":signed,"pin":pin})
            self.assertEqual(approved.status_code,200,approved.text)
            self.assertEqual(client.post("/demo/auth/telegram/browser/claim",json={
                "challenge":code,"init_data":signed_init_data(other_id),"pin":pin}).status_code,409)
            complete=client.post("/demo/auth/telegram/browser/complete",headers=good,json=body)
            self.assertEqual(complete.status_code,200,complete.text)
            self.assertEqual(complete.json()["status"],"authenticated")
            self.assertEqual(complete.json()["profile"]["guest"]["id"],guest_id)
            token=complete.json()["token"]
            self.assertEqual(client.get("/demo/me/tickets",headers={
                "Authorization":"Bearer "+token}).status_code,200)
            self.assertEqual(client.post("/demo/auth/telegram/browser/complete",
                headers=good,json=body).status_code,409)
            with SessionLocal() as db:
                self.assertEqual(db.get(DemoTelegramIdentity,tg_id).guest_id,guest_id)
                self.assertEqual(db.query(WebAccount).filter(WebAccount.guest_id==guest_id).count(),1)


if __name__=="__main__":
    unittest.main()
