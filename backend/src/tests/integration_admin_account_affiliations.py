"""Global-admin account affiliations, against disposable PostgreSQL only."""
import os
import secrets
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from fastapi.testclient import TestClient

if not os.getenv("DATABASE_URL", "").endswith("/tickettreat_ci"):
    raise RuntimeError("Requires disposable tickettreat_ci database")

import main
from db.session import SessionLocal
from demo_organizer_profiles import OrganizerPublicProfile
from demo_organizer_teams import OrganizerTeamMember
from demo_account_recovery import VerifiedEmail
from integration_pilot_ops import account_with_session
from integration_organizer_rewards import enroll_mfa


class AdminAccountAffiliationsTests(unittest.TestCase):
    def test_org_membership_is_not_confused_with_base_role(self):
        with SessionLocal() as db:
            admin, _, admin_pw, admin_headers = account_with_session(db)
            owner, _, _, owner_headers = account_with_session(db, "organizer")
            member, _, _, member_headers = account_with_session(db)
            invited, _, _, _ = account_with_session(db)
            expired, _, _, _ = account_with_session(db)
            outsider, _, _, _ = account_with_session(db)
            db.add(OrganizerPublicProfile(
                account_id=owner.id, slug="ci-org-" + secrets.token_hex(6),
                display_name="CI Event Studio", bio="", city="", website_url="",
                instagram="", published=False,
            ))
            now = datetime.now(timezone.utc)
            for user, status, invited_at in (
                (member, "active", now - timedelta(days=2)),
                (invited, "invited", now - timedelta(days=1)),
                (expired, "invited", now - timedelta(days=8)),
            ):
                db.add(OrganizerTeamMember(
                    owner_account_id=owner.id, member_account_id=user.id,
                    status=status, invited_at=invited_at,
                    accepted_at=now if status == "active" else None,
                ))
            db.commit()
            ids = {
                "admin": admin.id, "owner": owner.id, "member": member.id,
                "invited": invited.id, "expired": expired.id, "outsider": outsider.id,
            }

        with patch.dict(os.environ, {"GLOBAL_ADMIN_ACCOUNT_IDS": str(ids["admin"])}):
            with TestClient(main.app) as client:
                route = "/demo/manage/accounts"
                self.assertEqual(client.get(route, headers=member_headers).status_code, 403)
                self.assertEqual(client.get(route, headers=owner_headers).status_code, 403)
                self.assertEqual(client.get(route, headers=admin_headers).status_code, 403)
                enroll_mfa(client, admin_headers, admin_pw)
                response = client.get(route, headers=admin_headers)
                self.assertEqual(response.status_code, 200, response.text)
                accounts = {item["account_id"]: item for item in response.json()}
                self.assertEqual(accounts[ids["owner"]]["role"], "organizer")
                self.assertEqual(accounts[ids["owner"]]["organizer_name"], "CI Event Studio")
                self.assertEqual(accounts[ids["member"]]["role"], "participant")
                self.assertEqual(accounts[ids["member"]]["team_memberships"], [{
                    "owner_account_id": ids["owner"],
                    "organization": "CI Event Studio", "status": "active",
                }])
                self.assertEqual(accounts[ids["invited"]]["team_memberships"][0]["status"], "invited")
                self.assertEqual(accounts[ids["expired"]]["team_memberships"], [])
                self.assertEqual(accounts[ids["outsider"]]["team_memberships"], [])

                with SessionLocal() as db:
                    row = db.get(OrganizerTeamMember, (ids["owner"], ids["member"]))
                    row.status = "revoked"
                    row.revoked_at = now
                    db.commit()
                after_revocation = client.get(route, headers=admin_headers)
                self.assertEqual(after_revocation.status_code, 200)
                after = {item["account_id"]: item for item in after_revocation.json()}
                self.assertEqual(after[ids["member"]]["team_memberships"], [])

                with SessionLocal() as db:
                    db.query(VerifiedEmail).filter(VerifiedEmail.account_id == ids["owner"]).delete()
                    db.commit()
                invalid_owner = client.get(route, headers=admin_headers)
                self.assertEqual(invalid_owner.status_code, 200)
                after = {item["account_id"]: item for item in invalid_owner.json()}
                self.assertEqual(after[ids["invited"]]["team_memberships"], [])


if __name__ == "__main__":
    unittest.main()
