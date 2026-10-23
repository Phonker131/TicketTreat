"""Production-oriented free-event pilot controls.

All organizer operations are ownership scoped, and check-in staff never receive
participant exports or QR bearer credentials. No self-assigned privileged roles.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from fastapi import Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import Column, DateTime, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Session
from db.base import Base

DEFAULT_REMINDERS = (10080, 1440, 180)


class EventPilotSettings(Base):
    __tablename__ = "demo_event_pilot_settings"
    event_id = Column(Integer, primary_key=True)
    signup_cutoff_minutes = Column(Integer, nullable=False, default=0)
    reminder_minutes_json = Column(String(100), nullable=False, default="[10080,1440,180]")
    waitlist_offer_minutes = Column(Integer, nullable=False, default=0)
    event_duration_minutes = Column(Integer, nullable=False, default=180)


class EventCheckinStaff(Base):
    __tablename__ = "demo_event_checkin_staff"
    __table_args__ = (UniqueConstraint("event_id", "account_id", name="uq_event_checkin_staff"),)
    id = Column(Integer, primary_key=True)
    event_id = Column(Integer, nullable=False, index=True)
    account_id = Column(Integer, nullable=False)
    granted_by = Column(Integer, nullable=False)
    granted_at = Column(DateTime(timezone=True), nullable=False,
                        default=lambda: datetime.now(timezone.utc))


class PilotSettingsUpdate(BaseModel):
    signup_cutoff_minutes: int = Field(ge=0, le=10080)
    reminder_minutes: list[int] = Field(min_length=1, max_length=4)
    reminder_text: str | None = Field(default=None, max_length=1000)
    waitlist_offer_minutes: int = Field(default=0, ge=0, le=1440)
    event_duration_minutes: int = Field(default=180, ge=15, le=1440)


class EventAnnouncementRequest(BaseModel):
    message: str = Field(min_length=20, max_length=1000)
    category: str = Field(pattern="^(access|logistics|schedule)$")


class CheckinGrantRequest(BaseModel):
    email: str = Field(min_length=5, max_length=255)


class StaffScanRequest(BaseModel):
    qr_token: str = Field(min_length=24, max_length=80)


def effective_settings(db: Session, event_id: int) -> dict:
    row = db.get(EventPilotSettings, event_id)
    if row is None:
        return {"signup_cutoff_minutes": 0, "reminder_minutes": list(DEFAULT_REMINDERS), "waitlist_offer_minutes": 0, "event_duration_minutes": 180}
    try:
        offsets = json.loads(row.reminder_minutes_json)
    except (ValueError, TypeError):
        offsets = list(DEFAULT_REMINDERS)
    return {"signup_cutoff_minutes": int(row.signup_cutoff_minutes),
            "reminder_minutes": offsets, "waitlist_offer_minutes": int(row.waitlist_offer_minutes or 0),
            "event_duration_minutes": int(row.event_duration_minutes or 180)}


def validate_reminders(values: list[int]) -> list[int]:
    if not values or len(values) > 4 or any(
        not isinstance(x, int) or isinstance(x, bool) or not 15 <= x <= 10080
        for x in values
    ) or len(set(values)) != len(values):
        raise HTTPException(status_code=422, detail="invalid_reminder_intervals")
    return sorted(values, reverse=True)


def booking_cutoff_reached(db: Session, event) -> bool:
    if event.starts_at is None:
        return True
    minutes = effective_settings(db, event.id)["signup_cutoff_minutes"]
    if not minutes:
        return False
    start = event.starts_at
    if start.tzinfo is None:
        # Legacy Event timestamps are Prague venue-local wall clock times.
        start = start.replace(tzinfo=ZoneInfo("Europe/Prague"))
    return datetime.now(timezone.utc) >= start.astimezone(timezone.utc) - timedelta(minutes=minutes)


def install_pilot_ops(app, get_db, main):
    from demo_roles import account_lookup, ensure_owner, audit, redact_organizer_ticket
    from demo_accounts import WebAccount, normalize_email
    from demo_account_recovery import email_is_verified

    def current(authorization: str | None = Header(default=None),
                db: Session = Depends(get_db)):
        return account_lookup(db, authorization)

    def owner_event(db: Session, event_id: int, account):
        ensure_owner(db, event_id, account)
        event = db.get(main.Event, event_id)
        if event is None:
            raise HTTPException(404, "event_not_found")
        return event

    @app.get("/demo/manage/events/{event_id}/insights")
    def insights(event_id: int, account=Depends(current), db: Session=Depends(get_db)):
        event = owner_event(db, event_id, account)
        # Aggregate on PostgreSQL, never hydrate every attendee into app RAM.
        active = db.query(func.count(main.DemoTicket.id)).filter(
            main.DemoTicket.event_id == event_id,
            main.DemoTicket.ticket_status == "active").scalar() or 0
        checked = db.query(func.count(main.DemoTicket.id)).filter(
            main.DemoTicket.event_id == event_id,
            main.DemoTicket.ticket_status == "active",
            main.DemoTicket.checked_in_at.is_not(None)).scalar() or 0
        cancelled = db.query(func.count(main.DemoTicket.id)).filter(
            main.DemoTicket.event_id == event_id,
            main.DemoTicket.ticket_status == "cancelled").scalar() or 0
        waiting = db.query(func.count(main.DemoWaitlist.id)).filter(
            main.DemoWaitlist.event_id == event_id,
            main.DemoWaitlist.status == "waiting").scalar() or 0
        total = main.get_registered_count(db, event_id)
        source_counts=(db.query(main.DemoTicket.acquisition_source,func.count(main.DemoTicket.id))
            .filter(main.DemoTicket.event_id==event_id,
                    main.DemoTicket.ticket_status=="active")
            .group_by(main.DemoTicket.acquisition_source).all())
        day = func.date(main.DemoTicket.created_at)
        daily = (db.query(day.label("day"), func.count(main.DemoTicket.id))
                 .filter(main.DemoTicket.event_id == event_id)
                 .group_by(day).order_by(day.desc()).limit(90).all())
        end_time = (main.normalize_event_datetime(event.starts_at) +
                    timedelta(minutes=effective_settings(db,event_id)["event_duration_minutes"])) if event.starts_at else None
        finished = end_time is not None and datetime.now(timezone.utc) >= end_time.astimezone(timezone.utc)
        return {
            "event_id": event_id,
            "capacity": event.max_participants,
            "registered": total,
            "active_qr_tickets": active,
            "checked_in": checked,
            "awaiting_checkin": active - checked,
            "waitlist": waiting,
            "cancelled_tickets": cancelled,
            "no_show": (active - checked) if finished else None,
            "event_finished": finished,
            "occupancy_percent": round(100 * total / event.max_participants, 1)
                if event.max_participants else None,
            "attendance_percent": round(100 * checked / active, 1)
                if active and finished else None,
            "channels": [{"source": source or "direct", "registrations": int(count)} for source,count in source_counts],
            "daily_bookings": [{"date": str(date), "count": count}
                               for date, count in reversed(daily)],
            "limitations": ["Legacy bot registrations count towards capacity but do not "
                            "automatically appear as QR tickets or check-in attendance."],
        }

    @app.get("/demo/manage/events/{event_id}/pilot-settings")
    def settings(event_id: int, account=Depends(current), db: Session=Depends(get_db)):
        owner_event(db, event_id, account)
        return effective_settings(db, event_id)

    @app.put("/demo/manage/events/{event_id}/pilot-settings")
    def update_settings(event_id: int, payload: PilotSettingsUpdate,
                        account=Depends(current), db: Session=Depends(get_db)):
        event = owner_event(db, event_id, account)
        if event.is_cancelled:
            raise HTTPException(409, "event_is_cancelled")
        intervals = validate_reminders(payload.reminder_minutes)
        previous_intervals = effective_settings(db, event_id)["reminder_minutes"]
        if 0 < payload.waitlist_offer_minutes < 15:
            raise HTTPException(422, "waitlist_offer_must_be_at_least_15_minutes")
        if payload.reminder_text is not None:
            message = payload.reminder_text.strip()
            if not message:
                raise HTTPException(422, "reminder_message_required")
            event.reminder_text = message
        row = db.get(EventPilotSettings, event_id)
        if row is None:
            row = EventPilotSettings(event_id=event_id)
            db.add(row)
        row.signup_cutoff_minutes = payload.signup_cutoff_minutes
        row.waitlist_offer_minutes = payload.waitlist_offer_minutes
        row.event_duration_minutes = payload.event_duration_minutes
        row.reminder_minutes_json = json.dumps(intervals)
        # The Telegram bot supports one reminder per event; choose the closest
        # organizer-selected interval. Email queues all selected intervals.
        chosen_telegram_offset = min(intervals)
        if event.reminder_minutes_before != chosen_telegram_offset:
            event.reminder_minutes_before = chosen_telegram_offset
            event.reminder_sent = False

        # If only editorial text/cutoffs changed, keep the current queue
        # intact. The worker renders the latest message when sending.
        if intervals != previous_intervals:
            from demo_email import EmailOutbox, queue_event_reminder, ticket_language
            pending_ticket_ids = db.query(main.DemoTicket.id).filter(
                main.DemoTicket.event_id == event_id
            )
            db.query(EmailOutbox).filter(
                EmailOutbox.kind == "reminder", EmailOutbox.state == "pending",
                EmailOutbox.ticket_id.in_(pending_ticket_ids),
            ).update({EmailOutbox.state: "skipped"}, synchronize_session=False)
            db.flush()
            for ticket in db.query(main.DemoTicket).filter(
                    main.DemoTicket.event_id == event_id,
                    main.DemoTicket.ticket_status == "active").all():
                guest = db.get(main.DemoGuest, ticket.guest_id)
                if guest:
                    queue_event_reminder(db, event=event, guest=guest, ticket=ticket,
                                         language=ticket_language(db, ticket.id))
        audit(db, event_id, account.id, "pilot_settings", "cutoff/reminders")
        db.commit()
        return effective_settings(db, event_id)

    @app.post("/demo/manage/events/{event_id}/announcement")
    def send_announcement(event_id: int, payload: EventAnnouncementRequest,
                          account=Depends(current), db: Session=Depends(get_db)):
        """Transactional attendance information, not promotional mailing."""
        event=owner_event(db,event_id,account)
        from demo_publication import state as publication_state
        if event.is_cancelled or main.event_has_started(event) or not publication_state(db,event_id)["visible"]:
            raise HTTPException(409,"event_not_open_for_notice")
        from demo_email import queue_event_notice, configured as email_configured
        from demo_telegram_notifications import configured as telegram_configured
        if not email_configured() and not telegram_configured():
            raise HTTPException(503,"notification_providers_unavailable")
        from demo_auth_security import guard_rate, record_rate
        guard_rate(db,"event_announcement",str(event_id),2,86400)
        record_rate(db,"event_announcement",str(event_id),86400)
        count=queue_event_notice(db,event=event,kind="announcement",
                                 message=f"[{payload.category.upper()}] {payload.message.strip()}")
        audit(db,event_id,account.id,"announcement",f"{payload.category};recipients:{count}")
        db.commit()
        return {"status":"queued","eligible_verified_ticket_holders":count,
                "eligible_notification_deliveries":count}

    @app.get("/demo/manage/events/{event_id}/checkin-staff")
    def list_staff(event_id: int, account=Depends(current), db: Session=Depends(get_db)):
        owner_event(db, event_id, account)
        entries = db.query(EventCheckinStaff).filter(
            EventCheckinStaff.event_id == event_id).order_by(EventCheckinStaff.id).all()
        result = []
        for item in entries:
            person = db.get(WebAccount, item.account_id)
            if person:
                result.append({"account_id": person.id, "email": person.email,
                               "granted_at": item.granted_at})
        return result

    @app.post("/demo/manage/events/{event_id}/checkin-staff", status_code=201)
    def grant_staff(event_id: int, payload: CheckinGrantRequest, account=Depends(current),
                    db: Session=Depends(get_db)):
        owner_event(db, event_id, account)
        person = db.query(WebAccount).filter(
            WebAccount.email == normalize_email(payload.email)).first()
        if person is None or not email_is_verified(db, person.id):
            raise HTTPException(404, "verified_account_not_found")
        existing = db.query(EventCheckinStaff).filter(
            EventCheckinStaff.event_id == event_id,
            EventCheckinStaff.account_id == person.id).first()
        if existing:
            return {"account_id": person.id, "email": person.email, "status": "already_granted"}
        db.add(EventCheckinStaff(event_id=event_id, account_id=person.id,
                                 granted_by=account.id))
        audit(db, event_id, account.id, "checkin_staff_grant", str(person.id))
        db.commit()
        return {"account_id": person.id, "email": person.email, "status": "granted"}

    @app.delete("/demo/manage/events/{event_id}/checkin-staff/{account_id}")
    def revoke_staff(event_id: int, account_id: int, account=Depends(current),
                     db: Session=Depends(get_db)):
        owner_event(db, event_id, account)
        record = db.query(EventCheckinStaff).filter(
            EventCheckinStaff.event_id == event_id,
            EventCheckinStaff.account_id == account_id).first()
        if record is None:
            raise HTTPException(404, "staff_grant_not_found")
        db.delete(record)
        audit(db, event_id, account.id, "checkin_staff_revoke", str(account_id))
        db.commit()
        return {"status": "revoked"}

    @app.post("/demo/manage/events/{event_id}/check-in-by-list/{ticket_id}")
    def owner_checkin_by_list(event_id: int, ticket_id: int,
                              account=Depends(current), db: Session=Depends(get_db)):
        """Audited manual admission for event owners, never delegated scanners."""
        owner_event(db,event_id,account)
        ticket=db.query(main.DemoTicket).filter(
            main.DemoTicket.id==ticket_id,main.DemoTicket.event_id==event_id
        ).with_for_update().first()
        if ticket is None:
            raise HTTPException(404,"ticket_not_found")
        if ticket.ticket_status!="active":
            raise HTTPException(409,"ticket_not_active")
        event=db.get(main.Event,event_id)
        if event is None or event.is_cancelled:
            raise HTTPException(409,"event_cancelled")
        if ticket.checked_in_at is not None:
            return {"status":"already_checked_in",
                    "ticket":redact_organizer_ticket(main.demo_ticket_to_dict(ticket,db))}
        ticket.checked_in_at=datetime.now(timezone.utc)
        from demo_email import queue_email, ticket_language
        guest=db.get(main.DemoGuest,ticket.guest_id)
        queue_email(db,kind="checkin",
            event_key=f"checkin:{ticket.id}:{ticket.checked_in_at.isoformat()}",
            recipient=guest.email if guest else None,guest_id=ticket.guest_id,
            ticket_id=ticket.id,language=ticket_language(db,ticket.id))
        audit(db,event_id,account.id,"checkin_by_list",f"ticket:{ticket.id}")
        db.commit()
        db.refresh(ticket)
        return {"status":"checked_in",
                "ticket":redact_organizer_ticket(main.demo_ticket_to_dict(ticket,db))}

    @app.post("/demo/pilot/check-in")
    def staff_checkin(payload: StaffScanRequest, account=Depends(current),
                      db: Session=Depends(get_db)):
        if not email_is_verified(db, account.id):
            raise HTTPException(403, "email_verification_required")
        # Lock the ticket, so simultaneous device scans cannot both issue a
        # successful first check-in.
        ticket = db.query(main.DemoTicket).filter(
            main.DemoTicket.qr_token == payload.qr_token).with_for_update().first()
        if ticket is None:
            raise HTTPException(404, "ticket_not_found")
        from demo_roles import role_for, EventOwnership
        role = role_for(db, account)
        is_owner = role == "global_admin" or (
            role == "organizer" and db.query(EventOwnership.event_id).filter(
                EventOwnership.event_id == ticket.event_id,
                EventOwnership.owner_account_id == account.id).first() is not None)
        delegated = db.query(EventCheckinStaff.id).filter(
            EventCheckinStaff.event_id == ticket.event_id,
            EventCheckinStaff.account_id == account.id).first() is not None
        if not (is_owner or delegated):
            raise HTTPException(403, "event_checkin_access_denied")
        if ticket.ticket_status != "active":
            raise HTTPException(409, "ticket_not_active")
        event = db.get(main.Event, ticket.event_id)
        if event is None or event.is_cancelled:
            raise HTTPException(409, "event_cancelled")
        if ticket.checked_in_at is not None:
            return {"status": "already_checked_in",
                    "ticket": redact_organizer_ticket(main.demo_ticket_to_dict(ticket, db))}
        ticket.checked_in_at = datetime.now(timezone.utc)
        from demo_email import queue_email, ticket_language
        guest = db.get(main.DemoGuest, ticket.guest_id)
        queue_email(db, kind="checkin",
                    event_key=f"checkin:{ticket.id}:{ticket.checked_in_at.isoformat()}",
                    recipient=guest.email if guest else None,
                    guest_id=ticket.guest_id, ticket_id=ticket.id,
                    language=ticket_language(db, ticket.id))
        audit(db, ticket.event_id, account.id, "checkin",
              f"ticket:{ticket.id}")
        db.commit()
        db.refresh(ticket)
        return {"status": "checked_in",
                "ticket": redact_organizer_ticket(main.demo_ticket_to_dict(ticket, db))}
