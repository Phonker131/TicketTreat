"""Group verified access denials and enqueue private administrator notifications."""
from datetime import datetime, timedelta, timezone
import logging

from sqlalchemy import Column, DateTime, Index, Integer, String, select, func
from db.base import Base

LOG = logging.getLogger("tickettreat.security_alerts")
WINDOW = timedelta(minutes=10)
KINDS = {"admin_denials", "banned_actor", "delivery_check"}
LABELS = {
    "admin_denials": "Access denied on different administrative operations",
    "banned_actor": "A verified blocked account attempted a protected action",
    "delivery_check": "TEST · Security alert delivery check",
}
ROLE_DENIALS = {"organizer_role_required", "global_admin_only", "event_not_owned",
                "cannot_ban_global_admin", "cannot_change_global_admin", "protected_global_admin"}


class SecurityAlertWindow(Base):
    __tablename__ = "demo_security_alert_windows"
    __table_args__ = (Index("ix_security_alert_actor_kind_start", "actor_id", "kind", "started_at"),)
    id = Column(Integer, primary_key=True)
    actor_id = Column(Integer, nullable=False)
    kind = Column(String(24), nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=False)
    first_operation = Column(String(255), nullable=False)
    alerted_at = Column(DateTime(timezone=True))
    request_id = Column(String(32), unique=True)


def record_denial(db, kind, actor_id, operation, request_id):
    """Called in a dedicated transaction. Zero is reserved for operator delivery checks."""
    from demo_admin_telegram_alerts import enqueue_admin_alert
    if kind not in KINDS or (actor_id == 0) != (kind == "delivery_check") or actor_id < 0:
        raise ValueError("invalid_security_alert")
    # Serialize creation and enqueueing across workers, including the first denial.
    db.execute(select(func.pg_advisory_xact_lock(1485271407, actor_id)))
    now = datetime.now(timezone.utc)
    row = db.scalars(select(SecurityAlertWindow).where(
        SecurityAlertWindow.kind == kind, SecurityAlertWindow.actor_id == actor_id
    ).order_by(SecurityAlertWindow.started_at.desc()).limit(1)).first()
    if row and row.alerted_at and row.alerted_at > now - WINDOW:
        return row
    if row is None or row.alerted_at is not None or row.started_at <= now - WINDOW:
        row = SecurityAlertWindow(actor_id=actor_id, kind=kind, first_operation=operation,
                                  started_at=now)
        db.add(row)
        db.flush()
    if kind == "admin_denials" and operation == row.first_operation:
        return row
    if enqueue_admin_alert(db, kind="admin_security", object_id=row.id, notification_id=row.id):
        row.alerted_at = now
        row.request_id = request_id
    return row


def record_in_separate_transaction(session_factory, kind, actor_id, operation, request_id):
    # A notification failure must never change the authorization response.
    try:
        with session_factory.begin() as db:
            record_denial(db, kind, actor_id, operation, request_id)
    except Exception:
        LOG.error("security alert persistence failed request_id=%s", request_id)


def render_security_alert(db, window_id):
    row = db.get(SecurityAlertWindow, window_id)
    if row is None or row.kind not in LABELS or not row.alerted_at or not row.request_id:
        return None
    stamp = row.alerted_at.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    text = f"{LABELS[row.kind]}\n{stamp}\nrequest_id: <code>{row.request_id}</code>"
    return text, {"inline_keyboard": []}
