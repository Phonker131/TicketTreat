"""Ban enforcement outside login: automatic seats, Telegram chat and QR scans.

Runs only against the disposable PostgreSQL database supplied by CI.
"""
import base64
import hashlib
import hmac
import json
import os
import secrets
import time
import unittest
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from urllib.parse import urlencode

if not os.getenv("DATABASE_URL", "").endswith("/tickettreat_ci"):
    raise RuntimeError("Refusing ban side-channel tests outside disposable CI database")

from fastapi import HTTPException
from fastapi.testclient import TestClient

import main
from db.session import SessionLocal
from demo_account_bans import AccountBanAction
from demo_mfa import _code
from demo_pilot_ops import EventPilotSettings
from demo_roles import EventOwnership
from demo_telegram import DemoTelegramIdentity
from demo_waitlist_offers import WaitlistOffer
from integration_pilot_ops import account_with_session


def signed_telegram(telegram_id: int, bot_token: str) -> str:
    values = {"auth_date": str(int(time.time())),
              "user": json.dumps({"id": telegram_id, "first_name": "Test"},
                                 separators=(",", ":"))}
    data = "\n".join(f"{key}={value}" for key, value in sorted(values.items()))
    secret = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    values["hash"] = hmac.new(secret, data.encode(), hashlib.sha256).hexdigest()
    return urlencode(values)


def unlock_mfa(client, headers, password):
    started = client.post("/demo/auth/mfa/start", headers=headers,
                          json={"current_password": password})
    assert started.status_code == 200, started.text
    encoded = started.json()["secret"]
    raw = base64.b32decode(encoded + "=" * ((8 - len(encoded) % 8) % 8))
    confirmed = client.post("/demo/auth/mfa/confirm", headers=headers,
                            json={"code": _code(raw, int(time.time()) // 30)})
    assert confirmed.status_code == 200, confirmed.text


class BannedGuestSideChannelTests(unittest.TestCase):
    def test_waitlist_promotion_and_timed_offer_skip_banned_guest(self):
        with SessionLocal() as db:
            moderator, _, _, _ = account_with_session(db, "organizer")
            banned, banned_guest, _, _ = account_with_session(db)
            _, allowed_guest, _, _ = account_with_session(db)
            db.add(AccountBanAction(account_id=banned.id,
                                    actor_account_id=moderator.id, action="ban",
                                    reason="Automated abusive account"))
            future = (datetime.now(timezone.utc) + timedelta(days=4)).replace(tzinfo=None)
            immediate = main.Event(title="Ban waitlist auto-promotion", price=Decimal("0"),
                                   starts_at=future, max_participants=1, currency="CZK")
            timed = main.Event(title="Ban waitlist offer", price=Decimal("0"),
                               starts_at=future, max_participants=1, currency="CZK")
            db.add_all([immediate, timed]); db.flush()
            db.add(EventPilotSettings(event_id=timed.id, waitlist_offer_minutes=60))
            entries = [main.DemoWaitlist(event_id=event.id, guest_id=guest.id,
                                         status="waiting")
                       for event in (immediate, timed)
                       for guest in (banned_guest, allowed_guest)]
            db.add_all(entries); db.flush()
            immediate_id, timed_id = immediate.id, timed.id
            bad_entries = [entries[0].id, entries[2].id]
            good_entries = [entries[1].id, entries[3].id]
            allowed_guest_id = allowed_guest.id
            db.commit()

        with SessionLocal() as db:
            promoted = main.promote_demo_waitlist(db, immediate_id)
            self.assertIsNotNone(promoted)
            self.assertEqual(promoted.guest_id, allowed_guest_id)
            db.commit()
            self.assertIsNone(main.promote_demo_waitlist(db, timed_id))
            db.commit()

        with SessionLocal() as db:
            self.assertEqual([db.get(main.DemoWaitlist, row_id).status
                              for row_id in bad_entries], ["waiting", "waiting"])
            self.assertEqual(db.get(main.DemoWaitlist, good_entries[0]).status,
                             "promoted")
            self.assertEqual(db.get(main.DemoWaitlist, good_entries[1]).status,
                             "offered")
            offers = db.query(WaitlistOffer).filter(
                WaitlistOffer.event_id == timed_id).all()
            self.assertEqual(len(offers), 1)
            self.assertEqual(offers[0].guest_id, allowed_guest_id)

    def test_banned_telegram_chat_and_every_qr_checkin_path_are_denied(self):
        old_token = os.getenv("TELEGRAM_MINIAPP_BOT_TOKEN")
        bot_token = "ci-banned-telegram-auth-proof-2026"
        os.environ["TELEGRAM_MINIAPP_BOT_TOKEN"] = bot_token
        try:
            with SessionLocal() as db:
                organizer, _, password, headers = account_with_session(db, "organizer")
                banned, guest, _, _ = account_with_session(db)
                allowed, allowed_guest, _, _ = account_with_session(db)
                tg_bad = secrets.randbelow(10**12) + 10**10
                tg_good = tg_bad + 1
                db.add_all([
                    DemoTelegramIdentity(telegram_id=tg_bad, guest_id=guest.id),
                    DemoTelegramIdentity(telegram_id=tg_good, guest_id=allowed_guest.id),
                    AccountBanAction(account_id=banned.id,
                        actor_account_id=organizer.id, action="ban",
                        reason="Automated abusive account"),
                ])
                event = main.Event(title="Ban checkin regression", price=Decimal("0"),
                    starts_at=(datetime.now(timezone.utc) + timedelta(days=3)).replace(tzinfo=None),
                    max_participants=3, currency="CZK")
                db.add(event); db.flush()
                db.add(EventOwnership(event_id=event.id,
                                      owner_account_id=organizer.id))
                ticket = main.DemoTicket(event_id=event.id, guest_id=guest.id,
                    qr_token=secrets.token_urlsafe(32), ticket_status="active",
                    payment_status="not_required", payment_provider="free",
                    payment_amount="0", currency="CZK")
                db.add(ticket); db.flush()
                event_id, ticket_id, qr = event.id, ticket.id, ticket.qr_token
                db.commit()

            with TestClient(main.app) as client:
                bad = {"X-Telegram-Init-Data": signed_telegram(tg_bad, bot_token)}
                good = {"X-Telegram-Init-Data": signed_telegram(tg_good, bot_token)}
                self.assertEqual(client.get("/demo/me/chats", headers=bad).status_code, 403)
                self.assertEqual(client.get("/demo/me/chats", headers=good).status_code, 200)
                self.assertEqual(client.post(
                    f"/demo/me/events/{event_id}/chat/messages", headers=bad,
                    json={"body":"Banned user cannot message", "client_nonce":str(uuid.uuid4())}
                ).status_code, 403)

                unlock_mfa(client, headers, password)
                requests = [
                    (f"/demo/manage/events/{event_id}/check-in-by-list/{ticket_id}", None),
                    ("/demo/manage/check-in", {"qr_token": qr, "event_id": event_id}),
                    ("/demo/pilot/check-in", {"qr_token": f"CRD-{ticket_id:06d}"}),
                ]
                for path, payload in requests:
                    response = client.post(path, headers=headers, json=payload)
                    self.assertEqual(response.status_code, 403, (path, response.text))
                    self.assertEqual(response.json()["detail"], "account_banned")

            with SessionLocal() as db:
                with self.assertRaises(HTTPException) as error:
                    main.demo_admin_check_in(qr, _admin_key="", db=db)
                self.assertEqual(error.exception.status_code, 403)
                self.assertIsNone(db.get(main.DemoTicket, ticket_id).checked_in_at)
        finally:
            if old_token is None:
                os.environ.pop("TELEGRAM_MINIAPP_BOT_TOKEN", None)
            else:
                os.environ["TELEGRAM_MINIAPP_BOT_TOKEN"] = old_token


if __name__ == "__main__":
    unittest.main()
