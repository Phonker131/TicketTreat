"""Non-destructive reconciliation of legacy Telegram registrations.

A legacy registration remains as an audit/source record; only a FREE upcoming
registration from a verified Telegram ID may become a QR ticket automatically.
The canonical capacity counter excludes rows documented by a claim. Payments,
past events and conflicting registrations remain unchanged and visible as
legacy records for manual review.
"""
from __future__ import annotations

import secrets
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from db.base import Base


class LegacyTicketClaim(Base):
    __tablename__ = "demo_legacy_ticket_claims"
    registration_id = Column(Integer, primary_key=True)
    event_id = Column(Integer, nullable=False, index=True)
    ticket_id = Column(Integer, nullable=False, unique=True)
    claimed_at = Column(DateTime(timezone=True), nullable=False,
                        default=lambda: datetime.now(timezone.utc))
    source = Column(String(24), nullable=False, default="telegram")


def reconcile_free_legacy(db: Session, main, telegram_id: int, guest_id: int) -> dict:
    user=db.query(main.User).filter(main.User.telegram_id==telegram_id).first()
    if user is None:
        return {"converted":0,"held_for_review":0}
    registrations=(db.query(main.Registration)
        .filter(main.Registration.user_id==user.id)
        .order_by(main.Registration.event_id,main.Registration.id).all())
    converted=0
    held=0
    for reg in registrations:
        if db.get(LegacyTicketClaim,reg.id):
            continue
        # All writers to capacity take the same event lock.
        event=(db.query(main.Event).filter(main.Event.id==reg.event_id)
               .with_for_update().first())
        if event is None or getattr(event,"is_cancelled",False):
            held+=1;continue
        if event.starts_at is None or main.event_has_started(event):
            held+=1;continue
        if main.price_decimal(event.price)>0:
            # Do not issue paid tickets based on an unverified legacy payment.
            held+=1;continue
        existing=(db.query(main.DemoTicket)
                  .filter(main.DemoTicket.event_id==reg.event_id,
                          main.DemoTicket.guest_id==guest_id).first())
        if existing:
            # Duplicate entries require explicit manual reconciliation.
            held+=1;continue
        ticket=main.DemoTicket(event_id=reg.event_id,guest_id=guest_id,
            qr_token=secrets.token_urlsafe(32),ticket_status="active",
            payment_status="not_required",payment_provider="legacy_free",
            payment_amount="0",currency=getattr(event,"currency",None) or "CZK")
        db.add(ticket);db.flush()
        db.add(LegacyTicketClaim(registration_id=reg.id,event_id=reg.event_id,ticket_id=ticket.id))
        db.flush()
        converted+=1
    db.commit()
    return {"converted":converted,"held_for_review":held}


def unresolved_bot_registrations(db: Session, telegram_id: int, main) -> list[dict]:
    source=main.get_user_events(telegram_id,include_past=True,db=db)
    user=db.query(main.User).filter(main.User.telegram_id==telegram_id).first()
    if user is None:return source
    rows=db.query(main.Registration.id,main.Registration.event_id).filter(
        main.Registration.user_id==user.id).all()
    migrated={event_id for rid,event_id in rows if db.get(LegacyTicketClaim,rid)}
    return [entry for entry in source if entry.get("id") not in migrated]
