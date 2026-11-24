"""Fast ban-policy checks with an isolated, in-memory SQLite database."""
import unittest

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from demo_accounts import WebAccount
from demo_account_bans import (AccountBanAction, active_ban,
                               active_bans_for, require_account_active,
                               require_guest_active)


class AccountBanPolicyTests(unittest.TestCase):
    def test_latest_action_wins_and_guest_identity_is_blocked(self):
        engine = create_engine("sqlite://", connect_args={"check_same_thread":False},
                               poolclass=StaticPool)
        WebAccount.__table__.create(engine)
        AccountBanAction.__table__.create(engine)
        try:
            with Session(engine) as db:
                target = WebAccount(email="ban-local@example.invalid", password_hash="unused",
                    first_name="Local", last_name="User", guest_id=777, contact_preference="email")
                db.add(target);db.flush()
                require_account_active(db,target)
                require_guest_active(db,777)
                db.add(AccountBanAction(account_id=target.id,actor_account_id=99,
                    action="ban",reason="Repeated abusive behavior"));db.commit()
                self.assertEqual(active_ban(db,target.id).reason,"Repeated abusive behavior")
                self.assertIn(target.id,active_bans_for(db,[target.id]))
                for fn,arg in ((require_account_active,target),(require_guest_active,777)):
                    with self.assertRaises(HTTPException) as error:
                        fn(db,arg)
                    self.assertEqual(error.exception.status_code,403)
                    self.assertEqual(error.exception.detail,"account_banned")
                db.add(AccountBanAction(account_id=target.id,actor_account_id=99,
                    action="unban",reason="Appeal accepted"));db.commit()
                self.assertIsNone(active_ban(db,target.id))
                self.assertNotIn(target.id,active_bans_for(db,[target.id]))
                require_account_active(db,target)
                require_guest_active(db,777)
        finally:
            engine.dispose()


if __name__ == "__main__":
    unittest.main()
