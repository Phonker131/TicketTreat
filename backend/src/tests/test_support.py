"""Support desk regressions: authenticated ownership, admin inbox, mail outbox."""
import os
import unittest
from datetime import datetime,timedelta,timezone
from unittest.mock import patch
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from demo_accounts import WebAccount, WebSession, token_hash
from demo_account_recovery import VerifiedEmail
from demo_email import EmailOutbox,render_email
from demo_support import SupportTicket,SupportMessage,SupportAdminRead,install_support_api

class SupportWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.engine=create_engine("sqlite://",connect_args={"check_same_thread":False},poolclass=StaticPool)
        for table in (WebAccount.__table__,WebSession.__table__,VerifiedEmail.__table__,
                      SupportTicket.__table__,SupportMessage.__table__,SupportAdminRead.__table__,
                      EmailOutbox.__table__):
            table.create(self.engine)
        self.Session=sessionmaker(bind=self.engine)
        self.db=self.Session()
        expires=datetime.now(timezone.utc)+timedelta(days=1)
        for id in (1,2,3):
            self.db.add(WebAccount(id=id,email=f"user{id}@example.invalid",guest_id=id,
                    first_name=f"User {id}",last_name="Test",password_hash="placeholder"))
            self.db.add(VerifiedEmail(account_id=id,verified_at=datetime.now(timezone.utc)))
            self.db.add(WebSession(account_id=id,token_hash=token_hash(f"token-{id}-"+("z"*38)),expires_at=expires))
        self.db.commit()
        self.env=patch.dict(os.environ,{"GLOBAL_ADMIN_ACCOUNT_IDS":"2",
                      "APP_ENV":"development","EMAIL_FROM":"support@tickettreat.eu",
                      "WEB_APP_URL":"https://tickettreat.eu"})
        self.env.start()
        self.config=patch("demo_email.configured",return_value=True)
        self.config.start()
        app=FastAPI()
        def get_db():
            db=self.Session()
            try:yield db
            finally:db.close()
        install_support_api(app,get_db)
        self.client=TestClient(app)

    def tearDown(self):
        self.client.close()
        self.config.stop()
        self.env.stop()
        self.db.close()
        self.engine.dispose()

    def auth(self,id):
        return {"Authorization":"Bearer "+f"token-{id}-"+("z"*38)}

    def create_ticket(self,who=1,body="This support request has a description."):
        return self.client.post("/demo/support/tickets",headers=self.auth(who),
            json={"category":"technical","subject":"Need help with event booking","body":body})

    def test_user_ownership_and_staff_permissions(self):
        r=self.create_ticket()
        self.assertEqual(r.status_code,201,r.text)
        tid=r.json()["id"]
        self.assertEqual(self.client.get(f"/demo/support/tickets/{tid}",headers=self.auth(1)).status_code,200)
        self.assertEqual(self.client.get(f"/demo/support/tickets/{tid}",headers=self.auth(3)).status_code,404)
        self.assertEqual(self.client.get("/demo/manage/support/summary",headers=self.auth(1)).status_code,403)
        self.assertEqual(self.client.get("/demo/support/tickets").status_code,401)
        inbox=self.client.get("/demo/manage/support/summary",headers=self.auth(2)).json()
        self.assertEqual(inbox["unread"],1)
        self.assertEqual(inbox["open"],1)
        self.assertTrue(self.client.get("/demo/manage/support/tickets",
                                      headers=self.auth(2)).json()["tickets"][0]["unread"])

    def test_staff_reply_queues_email_and_customer_reopens(self):
        tid=self.create_ticket().json()["id"]
        self.assertEqual(self.client.post(f"/demo/manage/support/tickets/{tid}/read",
                                          headers=self.auth(2)).status_code,200)
        self.assertEqual(self.client.get("/demo/manage/support/summary",headers=self.auth(2)).json()["unread"],0)
        response=self.client.post(f"/demo/manage/support/tickets/{tid}/reply",
            headers=self.auth(2),json={"body":"We reviewed your ticket. <script>alert(1)</script>"})
        self.assertEqual(response.status_code,201,response.text)
        self.assertEqual(response.json()["email_status"],"queued")
        item=self.db.query(EmailOutbox).filter(EmailOutbox.kind=="support_reply").one()
        self.assertEqual(item.recipient,"user1@example.invalid")
        result=render_email(item,self.db)
        self.assertIn("&lt;script&gt;",result["html"])
        self.assertNotIn("<script>",result["html"])
        self.assertIn("/support?ticket=",result["text"])
        self.assertEqual(self.client.get(f"/demo/support/tickets/{tid}",
                        headers=self.auth(1)).json()["ticket"]["status"],"answered")
        self.assertEqual(self.client.post(f"/demo/support/tickets/{tid}/messages",
            headers=self.auth(1),json={"body":"Here is some additional information."}).status_code,201)
        self.assertEqual(self.client.get("/demo/manage/support/summary",headers=self.auth(2)).json()["unread"],1)
        self.assertEqual(self.client.post(f"/demo/manage/support/tickets/{tid}/close",
                                headers=self.auth(2)).status_code,200)
        self.assertEqual(self.client.post(f"/demo/support/tickets/{tid}/messages",
            headers=self.auth(1),json={"body":"No longer allowed."}).status_code,409)

    def test_email_config_required_before_reply(self):
        tid=self.create_ticket().json()["id"]
        self.config.stop()
        try:
            # Install the routes with email disabled. A reply must fail before
            # persisting the message, so no invisible unanswered email exists.
            with patch("demo_email.configured",return_value=False):
                app=FastAPI()
                def get_db():
                    db=self.Session()
                    try:yield db
                    finally:db.close()
                install_support_api(app,get_db)
                with TestClient(app) as c:
                    response=c.post(f"/demo/manage/support/tickets/{tid}/reply",
                         headers=self.auth(2),json={"body":"A reply without SMTP"})
                    self.assertEqual(response.status_code,503)
        finally:
            self.config.start()
        self.assertEqual(self.db.query(SupportMessage).filter(SupportMessage.author_role=="admin").count(),0)

    def test_ticket_rate_limit(self):
        self.assertEqual(self.create_ticket().status_code,201)
        second=self.create_ticket(body="A different valid issue description.")
        self.assertEqual(second.status_code,429,second.text)

if __name__=="__main__":unittest.main()
