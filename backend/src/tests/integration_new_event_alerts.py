from datetime import datetime, timedelta, timezone
import secrets
import unittest

from fastapi.testclient import TestClient
from integration_pilot_ops import account_with_session
from integration_organizer_rewards import enroll_mfa
from db.session import SessionLocal
import main
from demo_event_alerts import can_deliver, queue_public_events
from demo_telegram import DemoTelegramIdentity
from demo_telegram_notifications import TelegramNotificationOutbox, render_message


class NewEventAlerts(unittest.TestCase):
    def test_first_publication_audience_and_late_opt_out(self):
        tg = 3000000000000 + secrets.randbelow(10**9)
        now = datetime.now(timezone.utc)
        with SessionLocal() as db:
            _, guest, _, auth = account_with_session(db)
            _, _, password, org = account_with_session(db, "organizer")
            db.add(DemoTelegramIdentity(telegram_id=tg, guest_id=guest.id))
            db.add(main.User(telegram_id=tg))
            db.add(main.UserLanguageSetting(telegram_id=tg, language="cs"))
            db.add(main.UserLanguageSetting(telegram_id=tg+1, language="en"))
            db.commit()
        with TestClient(main.app) as client:
            enroll_mfa(client, org, password)
            created = client.post("/demo/manage/events", headers=org, json={
                "title":"New concert", "description":"A live concert", "location":"Prague",
                "visibility":"link_only", "max_participants":50, "languages":["en"],
                "starts_at":(now+timedelta(days=5)).isoformat()
            })
            self.assertEqual(created.status_code, 201, created.text)
            eid = created.json()["id"]
            path = f"/demo/manage/events/{eid}"
            def check_queue(at, count):
                with SessionLocal() as db:
                    queue_public_events(db, main, at)
                    db.commit()
                    rows = db.query(TelegramNotificationOutbox).filter_by(
                        event_id=eid, kind="new_event").filter(
                        TelegramNotificationOutbox.telegram_id.in_([tg, tg+1])).all()
                    self.assertEqual(len(rows), count)
                    if rows:
                        row = next(r for r in rows if r.telegram_id == tg)
                        text, keyboard = render_message(row, db.get(main.Event, eid), None)
                        self.assertIn("Nová akce", text)
                        self.assertTrue(keyboard["inline_keyboard"][0][0]["url"].endswith(f"/events/{eid}"))
            check_queue(now, 0)
            when = now+timedelta(hours=1)
            result = client.put(path+"/publication",headers=org,json={"status":"scheduled","publish_at":when.isoformat()})
            self.assertEqual(result.status_code, 200, result.text)
            check_queue(when+timedelta(seconds=1), 0)  # private
            result = client.put(path+"/visibility",headers=org,json={"visibility":"public"})
            self.assertEqual(result.status_code, 200, result.text)
            check_queue(now, 0)
            check_queue(when+timedelta(seconds=1), 2)
            result = client.put(path+"/publication",headers=org,json={"status":"published"})
            self.assertEqual(result.status_code, 200, result.text)
            check_queue(when+timedelta(seconds=2), 2)
            prefs="/api/v1/auth/broadcast-preferences"
            for general, alerts in [(True, True), (True, False), (False, True)]:
                result=client.put(prefs,headers=auth,json={"email_enabled":True,
                    "telegram_enabled":general,"new_events_enabled":alerts})
                self.assertEqual(result.status_code, 200, result.text)
                self.assertEqual(result.json()["new_events_enabled"], alerts)
                with SessionLocal() as db:
                    self.assertEqual(can_deliver(db, db.get(main.Event,eid), main,tg), general and alerts)
            # Old clients only write the original channels.
            client.put(prefs,headers=auth,json={"email_enabled":True,"telegram_enabled":True,"new_events_enabled":False})
            result=client.put(prefs,headers=auth,json={"email_enabled":False,"telegram_enabled":True})
            self.assertFalse(result.json()["new_events_enabled"])
