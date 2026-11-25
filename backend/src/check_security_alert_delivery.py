"""Operator-only Telegram delivery check. Run inside the API container, never over HTTP."""
import argparse
import json
import time
import uuid
from collections import Counter

from db.session import SessionLocal
from demo_security_alerts import record_denial, SecurityAlertWindow
from demo_telegram_notifications import TelegramNotificationOutbox


def check_delivery(request_id):
    with SessionLocal.begin() as db:
        previous = db.query(SecurityAlertWindow).filter_by(kind="delivery_check", request_id=request_id).first()
        row = previous or record_denial(db, "delivery_check", 0, "operator check", request_id)
        if not row.request_id:
            raise SystemExit("No control message queued. Check configured Telegram recipients.")
        trace, notice_id = row.request_id, row.id
        print(json.dumps({"event": "security_delivery_check", "request_id": trace}), flush=True)
    deadline = time.monotonic() + 120
    while True:
        with SessionLocal() as db:
            outbox = db.query(TelegramNotificationOutbox.state).filter_by(
                kind="admin_security", notice_id=notice_id).all()
        counts = Counter(state for (state,) in outbox)
        if not counts.get("pending") or time.monotonic() >= deadline:
            print(json.dumps({"request_id": trace, "recipients": len(outbox), "states": counts}), flush=True)
            return bool(outbox) and counts["sent"] == len(outbox)
        time.sleep(2)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("request_id", type=uuid.UUID, help="Reuse this UUID when retrying the same check")
    args = parser.parse_args()
    raise SystemExit(0 if check_delivery(args.request_id.hex) else 1)
