"""Organizer-direct payment holds. No payment is collected or processed by TicketTreat.

A pending application blocks one seat for up to 24h; only the event owner
with an authenticated, MFA-authorized session may mark external money received.
All transitions are serialized on the Event row in PostgreSQL.
"""
from __future__ import annotations
import logging
import os
import threading
import time
import secrets
import hashlib
from datetime import datetime, timezone, timedelta
from sqlalchemy import Column, Integer, String, DateTime, UniqueConstraint, func
from sqlalchemy.orm import Session
from fastapi import BackgroundTasks, Depends, Header, HTTPException
from db.base import Base

LOGGER = logging.getLogger("tickettreat.paid_holds")
HOLD_HOURS = 24

class PaidReservation(Base):
    __tablename__ = "demo_paid_reservations"
    __table_args__ = (UniqueConstraint("event_id","guest_id",name="uq_paid_reservation_event_guest"),)
    id = Column(Integer, primary_key=True)
    event_id = Column(Integer, nullable=False, index=True)
    guest_id = Column(Integer, nullable=False, index=True)
    status = Column(String(24), nullable=False, default="pending", index=True)
    created_at = Column(DateTime(timezone=True), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    confirmed_at = Column(DateTime(timezone=True), nullable=True)
    confirmed_by = Column(Integer, nullable=True)
    language = Column(String(2), nullable=False, default="en")
    source = Column(String(40), nullable=False, default="direct")

def now_utc():
    return datetime.now(timezone.utc)

def aware(dt):
    if dt is None:return None
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)

def pending_count(db,event_id):
    """Expiry takes effect for capacity immediately, even if no worker runs."""
    return int(db.query(func.count(PaidReservation.id)).filter(
        PaidReservation.event_id==event_id,
        PaidReservation.status=="pending",
        PaidReservation.expires_at>now_utc(),
    ).scalar() or 0)

def expire_for_event(db,event_id):
    """Under event-row lock. Preserve expired history for auditing."""
    rows=db.query(PaidReservation).filter(
        PaidReservation.event_id==event_id,
        PaidReservation.status=="pending",
        PaidReservation.expires_at<=now_utc(),
    ).all()
    for row in rows:row.status="expired"
    return len(rows)

def public_row(row, include_person=False, guest=None):
    result={"id":row.id,"event_id":row.event_id,"status":row.status,
            "created_at":aware(row.created_at).isoformat(),
            "expires_at":aware(row.expires_at).isoformat(),
            "confirmed_at":aware(row.confirmed_at).isoformat() if row.confirmed_at else None}
    if include_person and guest is not None:
        result["guest"]={"first_name":guest.first_name,"last_name":guest.last_name,
                         "email":guest.email}
    return result

def _lock_event(db,main,event_id):
    event=db.query(main.Event).filter(main.Event.id==event_id).with_for_update().first()
    if event is None:raise HTTPException(404,"event_not_found")
    expire_for_event(db,event_id)
    return event

def apply(db,main,event_id,guest,language="en",source="direct"):
    event=_lock_event(db,main,event_id)
    from demo_publication import require_published
    from demo_pilot_ops import booking_cutoff_reached
    if main.price_decimal(event.price)<=0:raise HTTPException(409,"paid_reservation_not_required")
    require_published(db,event_id)
    if event.is_cancelled or event.starts_at is None or main.event_has_started(event):
        raise HTTPException(409,"event_unavailable")
    if booking_cutoff_reached(db,event):raise HTTPException(409,"event_registration_closed")
    instructions=main.get_payment_settings(db,event_id)
    if instructions is None or not instructions.payment_instructions.strip():
        raise HTTPException(409,"organizer_payment_instructions_missing")
    existing_ticket=db.query(main.DemoTicket).filter(main.DemoTicket.event_id==event_id,
                        main.DemoTicket.guest_id==guest.id,
                        main.DemoTicket.ticket_status=="active").first()
    if existing_ticket is not None:raise HTTPException(409,"already_has_ticket")
    if main.telegram_guest_has_bot_registration(db,guest,event_id):
        raise HTTPException(409,"already_registered_via_bot")
    row=db.query(PaidReservation).filter(PaidReservation.event_id==event_id,
                                        PaidReservation.guest_id==guest.id).first()
    if row is not None and row.status in ("pending","confirmed"):
        return {"reservation":public_row(row),"payment_instructions":instructions.payment_instructions if row.status=="pending" else None}
    active=main.get_registered_count(db,event_id)
    from demo_waitlist_offers import offer_count
    if event.max_participants is not None and (
        active+offer_count(db,event_id,guest_id=guest.id)>=event.max_participants
    ):raise HTTPException(409,"event_full")
    now=now_utc()
    start=main.normalize_event_datetime(event.starts_at).astimezone(timezone.utc)
    expires=min(now+timedelta(hours=HOLD_HOURS),start)
    if expires<=now:raise HTTPException(409,"event_already_started")
    if row is None:
        row=PaidReservation(event_id=event_id,guest_id=guest.id,
                            status="pending",created_at=now,expires_at=expires)
        db.add(row)
    else:
        row.status="pending";row.created_at=now;row.expires_at=expires
        row.confirmed_at=None;row.confirmed_by=None
    row.language=language if language in {"en","ru","cs","uk"} else "en"
    row.source=source if source and len(source)<=40 else "direct"
    db.flush()
    db.commit()
    return {"reservation":public_row(row),"payment_instructions":instructions.payment_instructions}

def get_own(db,main,event_id,guest):
    row=db.query(PaidReservation).filter(PaidReservation.event_id==event_id,
                                        PaidReservation.guest_id==guest.id).first()
    if row is None:return {"status":"not_joined","reservation":None,"payment_instructions":None}
    if row.status=="pending" and aware(row.expires_at)<=now_utc():
        event=_lock_event(db,main,event_id)
        db.commit()
        db.refresh(row)
    settings=main.get_payment_settings(db,event_id) if row.status=="pending" else None
    return {"status":row.status,"reservation":public_row(row),
            "payment_instructions":settings.payment_instructions if settings else None}

def admin_list(db,main,event_id,account):
    from demo_roles import ensure_owner
    ensure_owner(db,event_id,account)
    _lock_event(db,main,event_id)
    rows=db.query(PaidReservation).filter(PaidReservation.event_id==event_id).order_by(
        PaidReservation.created_at.desc()).limit(200).all()
    result=[public_row(row,True,db.get(main.DemoGuest,row.guest_id)) for row in rows]
    db.commit()
    return result

def decision(db,main,event_id,reservation_id,account,approve,background_tasks):
    from demo_roles import ensure_owner,audit
    ensure_owner(db,event_id,account)
    event=_lock_event(db,main,event_id)
    row=db.query(PaidReservation).filter(PaidReservation.id==reservation_id,
                                        PaidReservation.event_id==event_id).first()
    if row is None:raise HTTPException(404,"reservation_not_found")
    if row.status=="confirmed":
        if approve:return {"status":"confirmed","reservation":public_row(row)}
        raise HTTPException(409,"already_confirmed")
    if row.status!="pending":raise HTTPException(409,"reservation_not_pending")
    if aware(row.expires_at)<=now_utc():
        row.status="expired";db.commit()
        raise HTTPException(409,"payment_deadline_expired")
    if event.is_cancelled or main.event_has_started(event):
        raise HTTPException(409,"event_unavailable")
    if not approve:
        row.status="declined"
        audit(db,event_id,account.id,"paid_reservation_declined",str(reservation_id))
        db.commit()
        return {"status":"declined","reservation":public_row(row)}
    guest=db.get(main.DemoGuest,row.guest_id)
    if guest is None:raise HTTPException(404,"guest_not_found")
    # Capacity already includes the reservation, so it must be excluded
    # when the ticket changes from a pending seat hold into an active pass.
    ticket=db.query(main.DemoTicket).filter(main.DemoTicket.event_id==event_id,
                                           main.DemoTicket.guest_id==guest.id).first()
    if ticket and ticket.ticket_status=="active":
        raise HTTPException(409,"already_has_ticket")
    if ticket is None:
        ticket=main.DemoTicket(event_id=event_id,guest_id=guest.id,
                               qr_token=secrets.token_urlsafe(32),
                               ticket_status="active",payment_status="paid",
                               payment_provider="organizer_direct",
                               payment_amount=str(main.price_decimal(event.price)),
                               currency=getattr(event,"currency",None) or "CZK",
                               acquisition_source=row.source)
        db.add(ticket)
    else:
        ticket.qr_token=secrets.token_urlsafe(32)
        ticket.ticket_status="active";ticket.payment_status="paid"
        ticket.payment_provider="organizer_direct"
        ticket.payment_amount=str(main.price_decimal(event.price))
        ticket.currency=getattr(event,"currency",None) or "CZK"
        ticket.checked_in_at=None;ticket.cancelled_at=None
    row.status="confirmed";row.confirmed_at=now_utc();row.confirmed_by=account.id
    db.flush()
    from demo_email import queue_email,queue_event_reminder
    queue_email(db,kind="ticket",
                event_key=f"ticket:{ticket.id}:issue:{hashlib.sha256(ticket.qr_token.encode()).hexdigest()[:20]}",
                recipient=guest.email,guest_id=guest.id,ticket_id=ticket.id,
                language=row.language)
    queue_event_reminder(db,event=event,guest=guest,ticket=ticket,language=row.language)
    audit(db,event_id,account.id,"paid_reservation_confirmed",str(reservation_id))
    db.commit()
    from demo_telegram import verified_telegram_id_for_guest, send_miniapp_ticket_notice
    telegram_id=verified_telegram_id_for_guest(db,guest.id)
    if telegram_id:
        background_tasks.add_task(send_miniapp_ticket_notice,telegram_id,event.title,ticket.id,False,row.language)
    return {"status":"confirmed","reservation":public_row(row),"ticket_id":ticket.id}

def install_paid_admin_api(app,get_db,main):
    from demo_roles import account_lookup
    def manager(authorization:str|None=Header(default=None),db:Session=Depends(get_db)):
        return account_lookup(db,authorization)
    @app.get("/demo/manage/events/{event_id}/paid-reservations")
    def list_pending(event_id:int,account=Depends(manager),db:Session=Depends(get_db)):
        return {"reservations":admin_list(db,main,event_id,account)}
    @app.post("/demo/manage/events/{event_id}/paid-reservations/{reservation_id}/confirm")
    def confirm(event_id:int,reservation_id:int,background_tasks:BackgroundTasks,
                account=Depends(manager),db:Session=Depends(get_db)):
        return decision(db,main,event_id,reservation_id,account,True,background_tasks)
    @app.post("/demo/manage/events/{event_id}/paid-reservations/{reservation_id}/decline")
    def decline(event_id:int,reservation_id:int,background_tasks:BackgroundTasks,
                account=Depends(manager),db:Session=Depends(get_db)):
        return decision(db,main,event_id,reservation_id,account,False,background_tasks)

def install_paid_expiry_worker(app,session_factory,main):
    """Enable on exactly one Demo API instance; routes also expire lazily."""
    if os.getenv("PAID_RESERVATION_WORKER_ENABLED","").strip().lower() not in {"1","true","yes"}:
        return
    @app.on_event("startup")
    def start_paid_expiry():
        def run():
            while True:
                try:
                    with session_factory() as db:
                        events=[item[0] for item in db.query(PaidReservation.event_id).filter(
                            PaidReservation.status=="pending",
                            PaidReservation.expires_at<=now_utc()).distinct().limit(100).all()]
                    for event_id in events:
                        with session_factory() as db:
                            event=db.query(main.Event).filter(main.Event.id==event_id).with_for_update(skip_locked=True).first()
                            if event is not None:
                                expire_for_event(db,event_id)
                                db.commit()
                except Exception:
                    LOGGER.exception("paid_reservation_expiry_failed")
                time.sleep(60)
        threading.Thread(target=run,daemon=True,name="paid-reservations-expiry").start()
