"""Disposable signups must not create principals or trigger verification email."""
import os
import unittest

from fastapi.testclient import TestClient

if not os.getenv("DATABASE_URL", "").endswith("/tickettreat_ci"):
    raise RuntimeError("Disposable signup tests require the isolated tickettreat_ci database")

import main
from db.session import SessionLocal
from demo_accounts import WebAccount


class DisposableSignupTests(unittest.TestCase):
    def test_password_signup_is_rejected_before_guest_creation(self):
        email = "ttqa20261125@euploading.com"
        with TestClient(main.app) as client:
            response = client.post("/demo/auth/signup", json={
                "email": email,
                "password": "long-safe-ci-password-123",
                "first_name": "QA",
                "last_name": "Test",
                "account_role": "organizer",
            })
        self.assertEqual(response.status_code, 422, response.text)
        self.assertEqual(response.json()["detail"], "disposable_email_not_allowed")
        with SessionLocal() as db:
            self.assertIsNone(db.query(WebAccount.id).filter(WebAccount.email == email).first())

    def test_quick_signup_request_and_confirm_are_rejected(self):
        email = "ttorg20261125@euploading.com"
        with TestClient(main.app) as client:
            request = client.post("/demo/auth/quick/request", json={
                "email": email, "first_name": "Org QA", "privacy_accepted": True,
                "privacy_version": "2026-10",
            })
            confirm = client.post("/demo/auth/quick/confirm", json={
                "email": email, "code": "00000000",
            })
        for response in (request, confirm):
            self.assertEqual(response.status_code, 422, response.text)
            self.assertEqual(response.json()["detail"], "disposable_email_not_allowed")
        with SessionLocal() as db:
            self.assertIsNone(db.query(WebAccount.id).filter(WebAccount.email == email).first())
