"""Authenticated, token-free URLs for event tickets and bookings.

The website passes its HttpOnly web-session cookie through Next.js, while the
Mini App passes Telegram-signed initData. Neither channel needs guest_token in
paths or payloads; all identity mapping is performed server-side.
"""
from __future__ import annotations
import os
from fastapi import BackgroundTasks,Depends,Header,HTTPException
from pydantic import BaseModel,Field
from sqlalchemy.orm import Session


class FreeBooking(BaseModel):
    language: str = Field(default="en",max_length=8)


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
            payload=main.DemoCheckoutCreate(guest_token=guest.access_token,language=payload.language),
            background_tasks=background_tasks,
            db=db,authorization=authorization,
            x_telegram_init_data=x_telegram_init_data)

    @app.post("/demo/me/events/{event_id}/waitlist")
    def waitlist(event_id:int,
                 authorization:str|None=Header(default=None),
                 x_telegram_init_data:str|None=Header(default=None),
                 guest=Depends(guest_for),db:Session=Depends(get_db)):
        return main.join_demo_waitlist(
            event_id=event_id,payload=main.DemoWaitlistCreate(guest_token=guest.access_token),
            db=db,authorization=authorization,x_telegram_init_data=x_telegram_init_data)
