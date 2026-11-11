"""Canonical provider identity registry: disposable PostgreSQL integration only."""
import os
import secrets
import unittest
from concurrent.futures import ThreadPoolExecutor

from sqlalchemy.exc import IntegrityError

if not os.getenv("DATABASE_URL", "").endswith("/tickettreat_ci"):
    raise RuntimeError("Refusing to run identity integration against a non-CI database")

import main
from db.session import SessionLocal
from demo_accounts import AuthIdentity, WebAccount
from demo_identity_registry import (
    IdentityConflict, canonical_subject, claim_verified_identity,
)


def test_account():
    with SessionLocal() as db:
        email = "identity-ci-" + secrets.token_hex(12) + "@example.invalid"
        guest = main.DemoGuest(
            access_token=secrets.token_urlsafe(32), first_name="Identity", email=email,
        )
        db.add(guest)
        db.flush()
        account = WebAccount(
            guest_id=guest.id, email=email, password_hash="!identity-registry-ci",
            first_name="Identity", last_name="Tester", contact_preference="email",
        )
        db.add(account)
        db.commit()
        return account.id


class IdentityRegistryTests(unittest.TestCase):
    def test_same_verified_provider_is_idempotent_under_24_concurrent_transactions(self):
        account_id = test_account()
        subject = "ci-" + secrets.token_hex(12)
        def worker(_):
            with SessionLocal() as db:
                row = claim_verified_identity(
                    db, account_id=account_id, provider="google",
                    verified_subject=subject,
                )
                db.commit()
                return row.account_id
        with ThreadPoolExecutor(max_workers=8) as pool:
            owners = list(pool.map(worker, range(24)))
        self.assertEqual(owners, [account_id] * 24)
        with SessionLocal() as db:
            rows = db.query(AuthIdentity).filter(
                AuthIdentity.provider == "google",
                AuthIdentity.provider_subject == subject,
            ).all()
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0].account_id, account_id)

    def test_provider_cannot_transfer_to_another_account_without_two_proofs(self):
        first = test_account()
        second = test_account()
        subject = "ci-" + secrets.token_hex(12)
        with SessionLocal() as db:
            row = claim_verified_identity(
                db, account_id=first, provider="telegram",
                verified_subject="000" + str(int(secrets.token_hex(6), 16) + 1),
            )
            telegram_subject = row.provider_subject
            db.commit()
        with SessionLocal() as db:
            with self.assertRaises(IdentityConflict):
                claim_verified_identity(
                    db, account_id=second, provider="telegram",
                    verified_subject=telegram_subject,
                )
            db.rollback()
        with SessionLocal() as db:
            claim_verified_identity(
                db, account_id=first, provider="google", verified_subject=subject,
            )
            db.commit()
        with SessionLocal() as db:
            with self.assertRaises(IdentityConflict):
                claim_verified_identity(
                    db, account_id=second, provider="google",
                    verified_subject=subject,
                )
            db.rollback()
        with SessionLocal() as db:
            found = db.query(AuthIdentity).filter(
                AuthIdentity.provider == "telegram",
                AuthIdentity.provider_subject == telegram_subject,
            ).one()
            self.assertEqual(found.account_id, first)

    def test_same_account_cannot_silently_replace_provider_subject(self):
        account_id = test_account()
        with SessionLocal() as db:
            claim_verified_identity(
                db, account_id=account_id, provider="google",
                verified_subject="original-" + secrets.token_hex(8),
            )
            db.commit()
        with SessionLocal() as db:
            with self.assertRaises(IdentityConflict):
                claim_verified_identity(
                    db, account_id=account_id, provider="google",
                    verified_subject="replacement-" + secrets.token_hex(8),
                )
            db.rollback()

    def test_verified_email_normalization_and_database_uniqueness(self):
        account = test_account()
        address = "Verification-" + secrets.token_hex(8) + "@Example.Invalid"
        with SessionLocal() as db:
            first = claim_verified_identity(
                db, account_id=account, provider="email",
                verified_subject="  " + address + "  ",
            )
            self.assertEqual(first.provider_subject, address.lower())
            db.commit()
        with SessionLocal() as db:
            second = claim_verified_identity(
                db, account_id=account, provider="email",
                verified_subject=address.lower(),
            )
            self.assertEqual(second.account_id, account)
            db.commit()
        other = test_account()
        with SessionLocal() as db:
            db.add(AuthIdentity(
                account_id=other, provider="email",
                provider_subject=address.lower(),
                verified_at=main.datetime.now(main.timezone.utc),
            ))
            with self.assertRaises(IntegrityError):
                db.commit()
            db.rollback()
        with SessionLocal() as db:
            self.assertEqual(db.query(AuthIdentity).filter(
                AuthIdentity.provider=="email",
                AuthIdentity.provider_subject==address.lower(),
            ).count(), 1)

    def test_unverified_or_unrecognized_subjects_are_not_silently_coerced(self):
        for provider, subject in [
            ("telegram", "not-a-number"), ("telegram", "-123"),
            ("telegram", "0"), ("google", " subject "), ("github", "id"),
        ]:
            with self.subTest(provider=provider, subject=subject):
                with self.assertRaises(ValueError):
                    canonical_subject(provider, subject)


if __name__ == "__main__":
    unittest.main()
