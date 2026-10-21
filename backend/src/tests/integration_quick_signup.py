"""Two-step first-time registration with consent and one-use OTP."""
import os,secrets,unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
if not os.getenv("DATABASE_URL","").endswith("/tickettreat_ci"):
    raise RuntimeError("Disposable CI database required")
import main
from db.session import SessionLocal
from demo_accounts import WebAccount
from demo_quick_signup import QuickPrivacyConsent,QuickSignupPending

class QuickSignupTests(unittest.TestCase):
    def test_otp_signup_consent_replay_and_participant_role(self):
        email=f"quick-{secrets.token_hex(10)}@example.invalid"
        sent=[]
        with TestClient(main.app) as client,patch("demo_email.configured",return_value=True),patch(
                "demo_quick_signup.send_code",side_effect=lambda to,kind,code:sent.append((to,kind,code))):
            refused=client.post("/demo/auth/quick/request",json={
                "email":email,"first_name":"Guest","privacy_accepted":False})
            self.assertEqual(refused.status_code,422,refused.text)
            requested=client.post("/demo/auth/quick/request",json={
                "email":email,"first_name":"Guest","privacy_accepted":True})
            self.assertEqual(requested.status_code,200,requested.text)
            self.assertEqual(len(sent),1)
            self.assertEqual(sent[0][:2],(email,"quick"))
            bad=client.post("/demo/auth/quick/confirm",json={
                "email":email,"code":"00000000" if sent[0][2]!="00000000" else "11111111"})
            self.assertEqual(bad.status_code,400,bad.text)
            valid=client.post("/demo/auth/quick/confirm",json={
                "email":email,"code":sent[0][2]})
            self.assertEqual(valid.status_code,200,valid.text)
            self.assertTrue(valid.json()["profile"]["email_verified"])
            self.assertEqual(valid.json()["profile"]["account"]["role"],"participant")
            replay=client.post("/demo/auth/quick/confirm",json={
                "email":email,"code":sent[0][2]})
            self.assertEqual(replay.status_code,400,replay.text)
            exists=client.post("/demo/auth/quick/request",json={
                "email":email,"first_name":"Guest","privacy_accepted":True})
            self.assertEqual(exists.status_code,200,exists.text)
            self.assertEqual(exists.json(),requested.json())
        with SessionLocal() as db:
            account=db.query(WebAccount).filter(WebAccount.email==email).one()
            ledger=db.get(QuickPrivacyConsent,account.id)
            self.assertEqual(ledger.version,"2026-10")
            self.assertIsNone(db.get(QuickSignupPending,email))

if __name__=="__main__":
    unittest.main()
