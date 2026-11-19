"""Queue one Telegram announcement per public event and eligible bot chat."""

from sqlalchemy import Boolean, Column, ForeignKey, Integer, or_, select
from sqlalchemy.dialects.postgresql import insert

from db.base import Base


class EventAnnouncement(Base):
    __tablename__ = "demo_event_announcement_batches"
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), primary_key=True)
    queued = Column(Boolean, nullable=False, default=False)


class EventAlertOptOut(Base):
    __tablename__ = "demo_event_alert_opt_outs"
    account_id = Column(Integer, ForeignKey("demo_web_accounts.id", ondelete="CASCADE"), primary_key=True)


def track_event(db, event_id, already_public=False):
    db.execute(insert(EventAnnouncement).values(event_id=event_id, queued=already_public)
               .on_conflict_do_nothing(index_elements=["event_id"]))


def recipients(db, main, telegram_id=None):
    from demo_accounts import WebAccount
    from demo_broadcast import BroadcastPreference
    from demo_telegram import DemoTelegramIdentity

    # /start persists the bot language even before a visitor registers.
    ids = select(main.User.telegram_id).union(
        select(main.UserLanguageSetting.telegram_id), select(DemoTelegramIdentity.telegram_id)
    ).subquery()
    blocked = select(DemoTelegramIdentity.telegram_id).join(
        WebAccount, WebAccount.guest_id == DemoTelegramIdentity.guest_id
    ).outerjoin(BroadcastPreference, BroadcastPreference.account_id == WebAccount.id
    ).outerjoin(EventAlertOptOut, EventAlertOptOut.account_id == WebAccount.id).where(
        or_(BroadcastPreference.telegram_enabled.is_(False), EventAlertOptOut.account_id.is_not(None))
    )
    q = db.query(ids.c.telegram_id).filter(ids.c.telegram_id > 0, ids.c.telegram_id.not_in(blocked))
    return q if telegram_id is None else q.filter(ids.c.telegram_id == telegram_id)


def queue_public_events(db, main, now):
    from demo_event_access import EventAccess
    from demo_publication import EventPublication
    from demo_telegram_notifications import PRAGUE, _insert_rows, _recipient_languages

    # Also adopt upcoming scheduled publications created before the rollout.
    future_schedules = select(EventPublication.event_id).where(
        EventPublication.status == "scheduled", EventPublication.publish_at > now)
    db.execute(insert(EventAnnouncement).from_select(["event_id"], future_schedules)
               .on_conflict_do_nothing(index_elements=["event_id"]))
    batches = db.query(EventAnnouncement).join(main.Event, main.Event.id == EventAnnouncement.event_id
    ).outerjoin(EventPublication, EventPublication.event_id == main.Event.id
    ).outerjoin(EventAccess, EventAccess.event_id == main.Event.id).filter(
        EventAnnouncement.queued.is_(False), EventAccess.event_id.is_(None),
        main.Event.is_cancelled.is_not(True),
        main.Event.starts_at > now.astimezone(PRAGUE).replace(tzinfo=None),
        or_(EventPublication.event_id.is_(None), EventPublication.status == "published",
            (EventPublication.status == "scheduled") & (EventPublication.publish_at <= now))
    ).order_by(EventAnnouncement.event_id).limit(20).with_for_update(
        of=EventAnnouncement, skip_locked=True).all()
    if not batches:
        return
    audience = [tg for tg, in recipients(db, main)]
    languages = _recipient_languages(db, audience, main)
    for batch in batches:
        for offset in range(0, len(audience), 400):
            _insert_rows(db, [{
                "event_key": f"tg:new_event:{batch.event_id}:{tg}", "event_id": batch.event_id,
                "kind": "new_event", "telegram_id": tg,
                "language": "cs" if languages.get(tg) == "cs" else "en",
                "state": "pending", "attempts": 0, "next_attempt_at": now,
            } for tg in audience[offset:offset+400]])
        batch.queued = True


def can_deliver(db, event, main, telegram_id):
    from demo_event_access import is_unlisted
    from demo_publication import state
    return (not event.is_cancelled and not main.event_is_past(event) and
            state(db, event.id)["visible"] and not is_unlisted(db, event.id) and
            recipients(db, main, telegram_id).first() is not None)
