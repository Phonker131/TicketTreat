"""Production-mode tests for controlled organizer admission and account erasure."""
import base64,os,secrets,time,unittest
from datetime import timedelta
from fastapi.testclient import TestClient
if not os.getenv("DATABASE_URL","").endswith("/tickettreat_ci"):
    raise RuntimeError("Requires disposable CI database")
import main
from db.session import SessionLocal
from demo_accounts import WebAccount,WebSession,token_hash
from demo_auth_security import hash_password
from demo_account_recovery import VerifiedEmail,now
from demo_mfa import _code
from demo_privacy import PrivacyRequest
from demo_roles import OrganizerApplication,WebAccountRole


class ApprovalAndPrivacyTests(unittest.TestCase):
    def test_admin_mfa_organizer_approval_and_eligible_privacy_erasure(self):
        previous=os.environ.get("GLOBAL_ADMIN_ACCOUNT_IDS")
        admin_pwd="privileged-test-password-123"
        user_pwd="participant-test-password-123"
        with SessionLocal() as db:
            g=main.DemoGuest(access_token=secrets.token_urlsafe(32),
                first_name="Super",email=f"super-{secrets.token_hex(8)}@example.invalid")
            db.add(g);db.flush()
            a=WebAccount(email=g.email,first_name="Super",last_name="Operator",
                password_hash=hash_password(admin_pwd),guest_id=g.id,contact_preference="email")
            db.add(a);db.flush()
            admin_id=a.id
            db.add(VerifiedEmail(account_id=a.id,verified_at=now()))
            session=secrets.token_urlsafe(36)
            db.add(WebSession(account_id=a.id,token_hash=token_hash(session),
                expires_at=now()+timedelta(days=2)))
            db.commit()
        os.environ["GLOBAL_ADMIN_ACCOUNT_IDS"]=str(admin_id)
        try:
            with TestClient(main.app) as client:
                admin={"Authorization":"Bearer "+session}
                pre=client.get("/demo/manage/organizer-applications",headers=admin)
                self.assertEqual(pre.status_code,403,pre.text)
                step=client.post("/demo/auth/mfa/start",headers=admin,
                    json={"current_password":admin_pwd})
                self.assertEqual(step.status_code,200,step.text)
                encoded=step.json()["secret"]
                secret=base64.b32decode(encoded+"="*((8-len(encoded)%8)%8))
                code=_code(secret,int(time.time())//30)
                elevated=client.post("/demo/auth/mfa/confirm",headers=admin,json={"code":code})
                self.assertEqual(elevated.status_code,200,elevated.text)
                unique=f"applicant-{secrets.token_hex(9)}@example.invalid"
                application=client.post("/demo/auth/signup",json={
                    "email":unique,"password":user_pwd,
                    "first_name":"Future","last_name":"Organizer",
                    "account_role":"organizer","country_code":"CZ","city":"Prague",
                })
                self.assertEqual(application.status_code,201,application.text)
                self.assertEqual(application.json()["profile"]["account"]["role"],"participant")
                app_id=application.json()["profile"]["account"]["id"]
                applicant={"Authorization":"Bearer "+application.json()["token"]}
                state=client.get("/demo/auth/organizer-application",headers=applicant)
                self.assertEqual(state.json()["status"],"pending")
                with SessionLocal() as db:
                    db.add(VerifiedEmail(account_id=app_id,verified_at=now()));db.commit()
                pending=client.get("/demo/manage/organizer-applications",headers=admin)
                self.assertEqual(pending.status_code,200,pending.text)
                self.assertIn(app_id,[x["account_id"] for x in pending.json()])
                approved=client.post(f"/demo/manage/organizer-applications/{app_id}/decision",
                    headers=admin,json={"approve":True})
                self.assertEqual(approved.status_code,200,approved.text)
                privileged=client.get("/demo/manage/me",headers=applicant)
                self.assertEqual(privileged.status_code,403,privileged.text)
                self.assertEqual(privileged.json()["detail"],"mfa_enrollment_required")

                # A ticket-free participant can request and receive an
                # audited erasure after manual approval, without affecting
                # other users or the legacy bookings tables.
                unique2=f"erase-{secrets.token_hex(9)}@example.invalid"
                signup=client.post("/demo/auth/signup",json={
                    "email":unique2,"password":user_pwd,
                    "first_name":"Delete","last_name":"Me",
                    "country_code":"CZ","city":"Prague",
                })
                self.assertEqual(signup.status_code,201,signup.text)
                user_headers={"Authorization":"Bearer "+signup.json()["token"]}
                req=client.post("/demo/auth/privacy-request",headers=user_headers,
                    json={"current_password":user_pwd})
                self.assertEqual(req.status_code,202,req.text)
                from demo_privacy import PrivacyRequest
                with SessionLocal() as db:
                    account=db.query(WebAccount).filter(WebAccount.email==unique2).first()
                    pending_id=db.query(PrivacyRequest.id).filter(
                        PrivacyRequest.account_id==account.id).first()[0]
                fulfilled=client.post(f"/demo/manage/privacy-requests/{pending_id}/fulfill",
                    headers=admin,json={"confirmation":"ERASE",
                        "justification":"Verified approved data-subject erasure test"})
                self.assertEqual(fulfilled.status_code,200,fulfilled.text)
                self.assertEqual(fulfilled.json()["status"],"fulfilled")
                revoked=client.get("/demo/auth/me",headers=user_headers)
                self.assertEqual(revoked.status_code,401,revoked.text)
                with SessionLocal() as db:
                    self.assertIsNone(db.query(WebAccount).filter(WebAccount.email==unique2).first())
                    self.assertEqual(db.get(PrivacyRequest,pending_id).status,"fulfilled")
        finally:
            if previous is None:os.environ.pop("GLOBAL_ADMIN_ACCOUNT_IDS",None)
            else:os.environ["GLOBAL_ADMIN_ACCOUNT_IDS"]=previous


if __name__=="__main__":
    unittest.main()
