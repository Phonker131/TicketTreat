# TICKETTREAT CRITICAL — OWNER REVIEW REQUIRED
# Server-derived ticket ownership across browser/Telegram. Never treat guessed guest tokens as authority.
# Do not change casually: open a PR, obtain @Phonker131 approval, run
# relevant security/DB tests and document rollback or migration risk.
# See docs/CRITICAL_CODE_AREAS.md. Comments do not enforce permissions.
"""Authenticated, token-free URLs for event tickets and bookings.

The website passes its HttpOnly web-session cookie through Next.js, while the
Mini App passes Telegram-signed initData. Neither channel needs guest_token in
paths or payloads; all identity mapping is performed server-side.
"""
from __future__ import annotations
import os
from fastapi import BackgroundTasks,Depends,Header,HTTPException,Response
from pydantic import BaseModel,Field
from sqlalchemy.orm import Session


class FreeBooking(BaseModel):
    language: str = Field(default="en",max_length=8)
    source: str = Field(default="direct",pattern=r"^[a-z0-9_-]{1,40}$")


def install_principal_api(app,get_db,main):
    def guest_for(
        authorization: str | None = Header(default=None),
        x_telegram_init_data: str | None = Header(default=None),
        db: Session=Depends(get_db),
    ):
        if x_telegram_init_data:
            from demo_telegram import verified_telegram_user,DemoTelegramIdentity
            tg=verified_telegram_user(
                x_telegram_init_data,os.getenv("TELEGRAM_MINIAPP_BOT_TOKEN","").strip())
            identity=db.query(DemoTelegramIdentity).filter(
                DemoTelegramIdentity.telegram_id==tg["id"]).first()
            if identity is None:
                raise HTTPException(401,"telegram_login_required")
            guest=db.query(main.DemoGuest).filter(
                main.DemoGuest.id==identity.guest_id).first()
        else:
            from demo_mfa import session_for
            from demo_account_recovery import email_is_verified
            account,_=session_for(db,authorization)
            if not email_is_verified(db,account.id):
                raise HTTPException(403,"email_verification_required")
            guest=db.query(main.DemoGuest).filter(
                main.DemoGuest.id==account.guest_id).first()
        if guest is None:
            raise HTTPException(404,"identity_profile_missing")
        return guest

    @app.post("/demo/me/events/{event_id}/paid-reservations",status_code=201)
    def create_paid_reservation(event_id:int,payload:FreeBooking,
             guest=Depends(guest_for),db:Session=Depends(get_db)):
        from demo_paid_reservations import apply
        return apply(db,main,event_id,guest,payload.language,payload.source)

    @app.get("/demo/me/events/{event_id}/paid-reservations")
    def own_paid_reservation(event_id:int,guest=Depends(guest_for),
                             db:Session=Depends(get_db)):
        from demo_paid_reservations import get_own
        return get_own(db,main,event_id,guest)

    from demo_loyalty import install_loyalty_api
    install_loyalty_api(app, get_db, main, guest_for)

    @app.get("/demo/me/attendance")
    def own_attendance(guest=Depends(guest_for), db:Session=Depends(get_db)):
        """Privacy-scoped history; never exposes other guests or QR secrets."""
        rows = (db.query(main.DemoTicket)
                .filter(main.DemoTicket.guest_id == guest.id,
                        main.DemoTicket.checked_in_at.is_not(None))
                .order_by(main.DemoTicket.checked_in_at.desc()).limit(100).all())
        records = []
        for ticket in rows:
            event = db.get(main.Event, ticket.event_id)
            records.append({
                "event_id": ticket.event_id,
                "title": event.title if event else "Deleted event",
                "checked_in_at": ticket.checked_in_at,
                "location": event.location if event else None,
            })
        return {"visit_count": len(records), "history": records,
                "limited_to": 100}

    @app.get("/demo/me/tickets")
    def own_tickets(guest=Depends(guest_for),db:Session=Depends(get_db)):
        rows=(db.query(main.DemoTicket)
              .filter(main.DemoTicket.guest_id==guest.id)
              .order_by(main.DemoTicket.created_at.desc()).all())
        return [main.demo_ticket_to_dict(x,db) for x in rows]

    @app.get("/demo/me/tickets/{ticket_id}")
    def own_ticket(ticket_id:int,guest=Depends(guest_for),
                   db:Session=Depends(get_db)):
        ticket=db.query(main.DemoTicket).filter(
            main.DemoTicket.id==ticket_id,
            main.DemoTicket.guest_id==guest.id).first()
        if ticket is None:raise HTTPException(404,"ticket_not_found")
        return main.demo_ticket_to_dict(ticket,db)

    @app.get("/demo/wallet/status")
    def wallet_status():
        from demo_wallet import configured
        return {"enabled": configured()}

    @app.get("/demo/me/tickets/{ticket_id}/wallet")
    def download_wallet(ticket_id:int,guest=Depends(guest_for),db:Session=Depends(get_db)):
        from demo_wallet import build_pass
        ticket=db.query(main.DemoTicket).filter(
            main.DemoTicket.id==ticket_id,
            main.DemoTicket.guest_id==guest.id).first()
        if ticket is None:raise HTTPException(404,"ticket_not_found")
        event=db.get(main.Event,ticket.event_id)
        package=build_pass(ticket,event)
        return Response(package,media_type="application/vnd.apple.pkpass",
            headers={"Content-Disposition":f'attachment; filename="tickettreat-{ticket_id}.pkpass"',
                     "Cache-Control":"private, no-store"})

    @app.delete("/demo/me/tickets/{ticket_id}")
    def cancel_own_ticket(ticket_id:int,
                          authorization:str|None=Header(default=None),
                          x_telegram_init_data:str|None=Header(default=None),
                          guest=Depends(guest_for),db:Session=Depends(get_db)):
        return main.cancel_demo_ticket(
            guest_token=guest.access_token,ticket_id=ticket_id,db=db,
            authorization=authorization,x_telegram_init_data=x_telegram_init_data)

    @app.post("/demo/me/events/{event_id}/checkout")
    def checkout(event_id:int,payload:FreeBooking,
                 background_tasks:BackgroundTasks,
                 authorization:str|None=Header(default=None),
                 x_telegram_init_data:str|None=Header(default=None),
                 guest=Depends(guest_for),db:Session=Depends(get_db)):
        return main.demo_checkout(
            event_id=event_id,
            payload=main.DemoCheckoutCreate(guest_token=guest.access_token,language=payload.language,source=payload.source),
            background_tasks=background_tasks,
            db=db,authorization=authorization,
            x_telegram_init_data=x_telegram_init_data)

    @app.get("/demo/me/events/{event_id}/waitlist/status")
    def waitlist_status(event_id:int,guest=Depends(guest_for),db:Session=Depends(get_db)):
        from demo_waitlist_offers import ensure_available_offer, expire_for_event, maybe_offer_next
        event=db.query(main.Event).filter(main.Event.id==event_id).with_for_update().first()
        if event is None:raise HTTPException(404,"event_not_found")
        expire_for_event(db,event_id)
        maybe_offer_next(db,event,main.get_registered_count(db,event_id))
        offer=ensure_available_offer(db,event,guest)
        entry=db.query(main.DemoWaitlist).filter(
            main.DemoWaitlist.event_id==event_id,
            main.DemoWaitlist.guest_id==guest.id).first()
        position=None
        if entry and entry.status=="waiting":
            from sqlalchemy import func
            position=db.query(func.count(main.DemoWaitlist.id)).filter(
                main.DemoWaitlist.event_id==event_id,
                main.DemoWaitlist.status=="waiting",
                main.DemoWaitlist.created_at<=entry.created_at).scalar()
        db.commit()
        return {"status":"offered" if offer else entry.status if entry else "not_joined",
                "expires_at":offer.expires_at.isoformat() if offer else None,
                "position":int(position) if position else None}

    @app.post("/demo/me/events/{event_id}/waitlist/claim")
    def claim_waitlist_offer(event_id:int,payload:FreeBooking,
                            background_tasks:BackgroundTasks,
                            authorization:str|None=Header(default=None),
                            x_telegram_init_data:str|None=Header(default=None),
                            guest=Depends(guest_for),db:Session=Depends(get_db)):
        from demo_waitlist_offers import ensure_available_offer, expire_for_event
        event=db.query(main.Event).filter(main.Event.id==event_id).with_for_update().first()
        if event is None:raise HTTPException(404,"event_not_found")
        expire_for_event(db,event_id)
        if ensure_available_offer(db,event,guest) is None:
            raise HTTPException(409,"waitlist_offer_unavailable_or_expired")
        return main.demo_checkout(event_id=event_id,
            payload=main.DemoCheckoutCreate(guest_token=guest.access_token,language=payload.language),
            background_tasks=background_tasks,db=db,authorization=authorization,
            x_telegram_init_data=x_telegram_init_data)

    @app.post("/demo/me/events/{event_id}/waitlist/decline")
    def decline_waitlist_offer(event_id:int,guest=Depends(guest_for),
                               db:Session=Depends(get_db)):
        from demo_waitlist_offers import ensure_available_offer, maybe_offer_next
        event=db.query(main.Event).filter(main.Event.id==event_id).with_for_update().first()
        if event is None:raise HTTPException(404,"event_not_found")
        offer=ensure_available_offer(db,event,guest)
        if offer is None:raise HTTPException(409,"waitlist_offer_unavailable_or_expired")
        offer.status="declined"
        entry=db.get(main.DemoWaitlist,offer.waitlist_id)
        if entry is not None:entry.status="declined"
        db.flush()
        maybe_offer_next(db,event,main.get_registered_count(db,event_id))
        db.commit()
        return {"status":"declined"}

    @app.post("/demo/me/events/{event_id}/waitlist")
    def waitlist(event_id:int,
                 authorization:str|None=Header(default=None),
                 x_telegram_init_data:str|None=Header(default=None),
                 guest=Depends(guest_for),db:Session=Depends(get_db)):
        return main.join_demo_waitlist(
            event_id=event_id,payload=main.DemoWaitlistCreate(guest_token=guest.access_token),
            db=db,authorization=authorization,x_telegram_init_data=x_telegram_init_data)
