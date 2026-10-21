"""Web organizer and global-admin access control.

Global admins MUST be explicitly granted by immutable website account IDs
via GLOBAL_ADMIN_ACCOUNT_IDS. Email alone is NOT proof of identity.
"""
from __future__ import annotations
import csv
import hashlib
import hmac
import io
import os
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from fastapi import Depends, Header, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import Column, DateTime, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Session
from db.base import Base
from demo_geography import DemoEventPlace, place_dict, save_place
from demo_accounts import WebAccount, WebSession, token_hash, safe_csv
from demo_auth_security import guard_rate, record_rate

class WebAccountRole(Base):
    __tablename__ = "demo_web_account_roles"
    account_id = Column(Integer, primary_key=True)
    role = Column(String(20), nullable=False, default="participant")
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

class GlobalAdminBinding(Base):
    """Explicit server-authorized global-admin grants tied to an account and email.

    The email allowlist is permanent Railway configuration. Recreating a deleted
    account requires proving knowledge of the separate recovery key again.
    """
    __tablename__ = "demo_global_admin_bindings"
    email = Column(String(255), primary_key=True)
    account_id = Column(Integer, nullable=False, index=True)
    claimed_at = Column(
        DateTime(timezone=True), nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )


class EventOwnership(Base):
    __tablename__ = "demo_event_ownership"
    event_id = Column(Integer, primary_key=True)
    owner_account_id = Column(Integer, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

class EventModerationLog(Base):
    __tablename__ = "demo_event_moderation_log"
    id = Column(Integer, primary_key=True)
    event_id = Column(Integer, nullable=False, index=True)
    actor_account_id = Column(Integer, nullable=False)
    action = Column(String(30), nullable=False)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

class CreateManageEvent(BaseModel):
    country_code: str = Field(min_length=2, max_length=2)
    city: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=255)
    organizer: str | None = None
    location: str | None = None
    description: str | None = None
    max_participants: int | None = Field(default=None, ge=1)
    price: Decimal = Field(default=Decimal("0"), ge=0)
    currency: str = "CZK"
    starts_at: datetime
    languages: list[str] = Field(min_length=1)
    poster_data_url: str | None = Field(default=None, max_length=5700000)

class UpdateManageEvent(BaseModel):
    country_code: str | None = Field(default=None, max_length=2)
    city: str | None = Field(default=None, max_length=100)
    title: str | None = Field(default=None, min_length=1, max_length=255)
    organizer: str | None = None
    location: str | None = None
    description: str | None = None
    max_participants: int | None = Field(default=None, ge=1)
    price: Decimal | None = Field(default=None, ge=0)
    currency: str | None = None
    starts_at: datetime | None = None
    languages: list[str] | None = None
    poster_data_url: str | None = Field(default=None, max_length=5700000)

class CancelManageEvent(BaseModel):
    reason: str = Field(min_length=8, max_length=1000)

class AssignOwner(BaseModel):
    owner_account_id: int = Field(gt=0)


class GlobalAdminClaim(BaseModel):
    recovery_key: str = Field(min_length=24, max_length=256)

LANGUAGES = {"en","cs","ru","uk"}
CURRENCIES = {"CZK","EUR","USD"}

def global_admin_ids() -> set[int]:
    result = set()
    for piece in os.getenv("GLOBAL_ADMIN_ACCOUNT_IDS","").split(","):
        item = piece.strip()
        if item.isdecimal():
            result.add(int(item))
    return result

def permanent_global_admin_emails() -> set[str]:
    """Email is an eligibility filter, NEVER sufficient authorization."""
    return {
        addr.strip().casefold()
        for addr in os.getenv("GLOBAL_ADMIN_EMAILS", "").split(",")
        if addr.strip() and "@" in addr
    }


def role_for(db: Session, account: WebAccount) -> str:
    if account.id in global_admin_ids():
        return "global_admin"
    normalized_email = (account.email or "").strip().casefold()
    if normalized_email in permanent_global_admin_emails():
        binding = db.query(GlobalAdminBinding).filter(
            GlobalAdminBinding.email == normalized_email,
            GlobalAdminBinding.account_id == account.id,
        ).first()
        if binding is not None:
            return "global_admin"
    record = db.query(WebAccountRole).filter(WebAccountRole.account_id == account.id).first()
    return record.role if record and record.role in {"participant", "organizer"} else "participant"

def require_web_account(
    authorization: str | None = Header(default=None),
    db: Session = Depends(lambda: None),
):
    # Rebound by install() to a proper dependency; placeholder unused.
    raise NotImplementedError

def account_lookup(db: Session, authorization: str | None) -> WebAccount:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="login_required")
    raw = authorization[7:].strip()
    if len(raw) < 30 or len(raw) > 160:
        raise HTTPException(status_code=401, detail="invalid_session")
    row = db.query(WebSession).filter(WebSession.token_hash == token_hash(raw)).first()
    if row is None:
        raise HTTPException(status_code=401, detail="invalid_session")
    exp = row.expires_at
    exp = exp.replace(tzinfo=timezone.utc) if exp.tzinfo is None else exp.astimezone(timezone.utc)
    if exp <= datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="session_expired")
    account = db.query(WebAccount).filter(WebAccount.id == row.account_id).first()
    if account is None:
        raise HTTPException(status_code=401, detail="invalid_session")
    return account

def ensure_manage(db: Session, account: WebAccount) -> str:
    role = role_for(db, account)
    if role not in {"organizer", "global_admin"}:
        raise HTTPException(status_code=403, detail="organizer_role_required")
    return role

def ensure_owner(db: Session, event_id: int, account: WebAccount) -> str:
    role = ensure_manage(db, account)
    if role == "global_admin":
        return role
    record = db.query(EventOwnership).filter(
        EventOwnership.event_id == event_id,
        EventOwnership.owner_account_id == account.id,
    ).first()
    if record is None:
        raise HTTPException(status_code=403, detail="event_not_owned")
    return role

def audit(db: Session, event_id: int, actor: int, action: str, details: str = "") -> None:
    db.add(EventModerationLog(
        event_id=event_id, actor_account_id=actor, action=action,
        details=details[:3000],
    ))

def event_data(event, db, main) -> dict[str,Any]:
    data=main.event_to_dict(event,db=db,registered_count=main.get_registered_count(db,event.id))
    owner=db.query(EventOwnership).filter(EventOwnership.event_id==event.id).first()
    data["owner_account_id"]=owner.owner_account_id if owner else None
    return data

def validate_payload(languages: list[str]|None, currency: str|None) -> None:
    if languages is not None and (not languages or any(x not in LANGUAGES for x in languages)):
        raise HTTPException(status_code=422,detail="invalid_event_languages")
    if currency is not None and currency not in CURRENCIES:
        raise HTTPException(status_code=422,detail="invalid_currency")

def poster_setup(db, main, request, event, data_url: str):
    ctype,blob=main.decode_demo_poster(data_url)
    item=db.query(main.DemoEventPoster).filter(main.DemoEventPoster.event_id==event.id).first()
    if item is None:
        item=main.DemoEventPoster(event_id=event.id,content_type=ctype,image_bytes=blob)
        db.add(item)
    else:
        item.content_type=ctype
        item.image_bytes=blob
    public_base=os.getenv("DEMO_PUBLIC_API_URL","").rstrip("/") or str(request.base_url).rstrip("/")
    event.image_url=f"{public_base}/demo/events/{event.id}/poster"

def install_demo_roles(app, get_db, main):
    def current(
        authorization: str | None = Header(default=None),
        db: Session = Depends(get_db),
    ) -> WebAccount:
        return account_lookup(db,authorization)

    def managing(
        account: WebAccount = Depends(current),
        db: Session = Depends(get_db),
    ) -> WebAccount:
        ensure_manage(db,account)
        return account

    @app.get("/demo/manage/me")
    def whoami(account: WebAccount=Depends(current),db: Session=Depends(get_db)):
        return {
            "account_id":account.id,"email":account.email,
            "role":role_for(db,account),
        }

    @app.get("/demo/manage/events")
    def my_events(account: WebAccount=Depends(managing),db: Session=Depends(get_db)):
        q=db.query(main.Event)
        if role_for(db,account) != "global_admin":
            q=q.join(EventOwnership,EventOwnership.event_id == main.Event.id).filter(EventOwnership.owner_account_id==account.id)
        events=q.order_by(main.Event.id.desc()).all()
        return [event_data(event,db,main) for event in events]

    @app.get("/demo/manage/events/{event_id}")
    def my_event(event_id: int,account: WebAccount=Depends(managing),db: Session=Depends(get_db)):
        ensure_owner(db,event_id,account)
        event=db.query(main.Event).filter(main.Event.id==event_id).first()
        if event is None:
            raise HTTPException(status_code=404,detail="event_not_found")
        return event_data(event,db,main)

    @app.post("/demo/manage/events",status_code=201)
    def new_event(
        payload: CreateManageEvent,request: Request,
        account: WebAccount=Depends(managing),db: Session=Depends(get_db),
    ):
        validate_payload(payload.languages,payload.currency)
        if payload.starts_at is None:
            raise HTTPException(status_code=422,detail="date_required")
        # Existing bot event-creation logic remains the source of truth.
        values=payload.model_dump(exclude={"poster_data_url","country_code","city"})
        from main import EventCreate
        values["payment_instructions"]="DEMO PAYMENT — automatically confirmed"
        values["reminder_minutes_before"]=180
        values["reminder_text"]="Your Crowdly event starts soon."
        created=main.create_event(EventCreate(**values),db=db)
        if not isinstance(created,dict) or "id" not in created:
            raise HTTPException(status_code=422,detail=created.get("error","create_failed") if isinstance(created,dict) else "create_failed")
        eid=created["id"]
        event=db.query(main.Event).filter(main.Event.id==eid).first()
        db.add(EventOwnership(event_id=eid,owner_account_id=account.id))
        save_place(db, DemoEventPlace, "event_id", eid, payload.country_code, payload.city)
        if payload.poster_data_url:
            poster_setup(db,main,request,event,payload.poster_data_url)
        audit(db,eid,account.id,"create")
        db.commit()
        db.refresh(event)
        return event_data(event,db,main)

    @app.patch("/demo/manage/events/{event_id}")
    def modify_event(
        event_id: int,payload: UpdateManageEvent,request:Request,
        account:WebAccount=Depends(managing),db:Session=Depends(get_db),
    ):
        ensure_owner(db,event_id,account)
        event=db.query(main.Event).filter(main.Event.id==event_id).first()
        if event is None:
            raise HTTPException(status_code=404,detail="event_not_found")
        if event.is_cancelled:
            raise HTTPException(status_code=409,detail="event_is_cancelled")
        values=payload.model_dump(exclude_unset=True)
        poster=values.pop("poster_data_url",None)
        geo_country=values.pop("country_code",None)
        geo_city=values.pop("city",None)
        if not values and poster is None and geo_country is None and geo_city is None:
            raise HTTPException(status_code=422,detail="no_changes")
        validate_payload(values.get("languages"),values.get("currency"))
        cap=values.get("max_participants",event.max_participants)
        if cap is not None and cap < main.get_registered_count(db,event_id):
            raise HTTPException(status_code=409,detail="capacity_below_registration_count")
        if "starts_at" in values and values["starts_at"] is None:
            raise HTTPException(status_code=422,detail="date_required")
        if "price" in values and values["price"] is None:
            raise HTTPException(status_code=422,detail="invalid_price")
        if poster:
            main.decode_demo_poster(poster)  # fail before updating event
        if values:
            from main import EventUpdate
            outcome=main.update_event(event_id,EventUpdate(**values),db=db)
            if isinstance(outcome,dict) and outcome.get("error"):
                raise HTTPException(status_code=422,detail=outcome["error"])
        if geo_country is not None or geo_city is not None:
            previous=db.query(DemoEventPlace).filter(DemoEventPlace.event_id==event_id).first()
            country=geo_country if geo_country is not None else (previous.country_code if previous else None)
            city=geo_city if geo_city is not None else (previous.city if previous else None)
            save_place(db, DemoEventPlace, "event_id", event_id, country, city)
        if poster:
            poster_setup(db,main,request,event,poster)
        audit(db,event_id,account.id,"edit",",".join(values.keys())+(",poster" if poster else "")+(",geography" if geo_country is not None or geo_city is not None else ""))
        db.commit()
        db.refresh(event)
        return event_data(event,db,main)

    @app.post("/demo/manage/events/{event_id}/cancel")
    def cancel_event(
        event_id:int,payload:CancelManageEvent,
        account:WebAccount=Depends(managing),db:Session=Depends(get_db),
    ):
        ensure_owner(db,event_id,account)
        event=db.query(main.Event).filter(main.Event.id==event_id).first()
        if event is None:
            raise HTTPException(status_code=404,detail="event_not_found")
        if event.is_cancelled:
            raise HTTPException(status_code=409,detail="already_cancelled")
        reason=payload.reason.strip()
        if len(reason)<8:
            raise HTTPException(status_code=422,detail="cancellation_reason_required")
        event.is_cancelled=True
        event.cancellation_reason=reason
        event.cancelled_at=datetime.now(timezone.utc).replace(tzinfo=None)
        # Cancel every active demo ticket: QR check-in must no longer be valid.
        db.query(main.DemoTicket).filter(
            main.DemoTicket.event_id==event_id,
            main.DemoTicket.ticket_status=="active",
        ).update({
            main.DemoTicket.ticket_status:"cancelled",
            main.DemoTicket.payment_status:"refunded_demo",
            main.DemoTicket.cancelled_at:datetime.now(timezone.utc).replace(tzinfo=None),
        }, synchronize_session=False)
        audit(db,event_id,account.id,"cancel",reason)
        db.commit()
        db.refresh(event)
        return event_data(event,db,main)

    @app.get("/demo/manage/events/{event_id}/participants")
    def event_participants(event_id:int,account:WebAccount=Depends(managing),db:Session=Depends(get_db)):
        ensure_owner(db,event_id,account)
        # Existing ticket serialization preserved and scoped.
        return main.demo_admin_event_tickets(event_id,_admin_key="",db=db)

    @app.get("/demo/manage/events/{event_id}/participants.csv")
    def participant_export(event_id:int,account:WebAccount=Depends(managing),db:Session=Depends(get_db)):
        ensure_owner(db,event_id,account)
        route=next((r for r in app.routes if getattr(r,"path","")=="/demo/admin/events/{event_id}/participants.csv"),None)
        if route is None:
            raise HTTPException(status_code=500,detail="csv_export_not_available")
        # Directly delegate ONLY after server-side ownership authorization.
        return route.endpoint(event_id=event_id,_admin_key="",db=db)

    @app.post("/demo/manage/check-in/{qr_token}")
    def check_in(qr_token:str,account:WebAccount=Depends(managing),db:Session=Depends(get_db)):
        ticket=db.query(main.DemoTicket).filter(main.DemoTicket.qr_token==qr_token).first()
        if ticket is None:
            raise HTTPException(status_code=404,detail="ticket_not_found")
        ensure_owner(db,ticket.event_id,account)
        return main.demo_admin_check_in(qr_token,_admin_key="",db=db)

    @app.get("/demo/manage/organizers")
    def list_organizers(account:WebAccount=Depends(managing),db:Session=Depends(get_db)):
        if role_for(db,account)!="global_admin":
            raise HTTPException(status_code=403,detail="global_admin_only")
        rows=db.query(WebAccount,WebAccountRole).join(
            WebAccountRole,WebAccountRole.account_id==WebAccount.id
        ).filter(WebAccountRole.role=="organizer").order_by(WebAccount.id).all()
        return [{"account_id":a.id,"name":f"{a.first_name} {a.last_name}","email":a.email} for a,_ in rows]

    @app.put("/demo/manage/events/{event_id}/owner")
    def assign_owner(event_id:int,payload:AssignOwner,account:WebAccount=Depends(managing),db:Session=Depends(get_db)):
        if role_for(db,account)!="global_admin":
            raise HTTPException(status_code=403,detail="global_admin_only")
        event=db.query(main.Event).filter(main.Event.id==event_id).first()
        owner=db.query(WebAccount).filter(WebAccount.id==payload.owner_account_id).first()
        if event is None or owner is None:
            raise HTTPException(status_code=404,detail="event_or_organizer_not_found")
        if role_for(db,owner)!="organizer":
            raise HTTPException(status_code=422,detail="target_must_be_organizer")
        record=db.query(EventOwnership).filter(EventOwnership.event_id==event_id).first()
        if record is None:
            record=EventOwnership(event_id=event_id,owner_account_id=owner.id)
            db.add(record)
        else:
            record.owner_account_id=owner.id
        audit(db,event_id,account.id,"assign_owner",str(owner.id))
        db.commit()
        return event_data(event,db,main)

    @app.get("/demo/manage/events/{event_id}/audit")
    def audit_log(event_id:int,account:WebAccount=Depends(managing),db:Session=Depends(get_db)):
        if role_for(db,account)!="global_admin":
            raise HTTPException(status_code=403,detail="global_admin_only")
        records=db.query(EventModerationLog).filter(EventModerationLog.event_id==event_id).order_by(EventModerationLog.id.desc()).limit(100).all()
        return [{"action":r.action,"details":r.details,"actor_account_id":r.actor_account_id,"at":r.created_at} for r in records]

class AccountRoleChange(BaseModel):
    role: str = Field(pattern="^(participant|organizer)$")


def install_account_moderation(app, get_db):
    @app.post("/demo/auth/admin-claim")
    def claim_global_admin(
        payload: GlobalAdminClaim,
        request: Request,
        authorization: str | None = Header(default=None),
        db: Session = Depends(get_db),
    ):
        """Recover privileges with a server-side email allowlist AND secret.

        Never grant admin purely based on self-declared, unverified signup email.
        """
        account = account_lookup(db, authorization)
        email = (account.email or "").strip().casefold()
        claim_ip = request.client.host if request.client else "unknown"
        guard_rate(db, "admin_claim_ip", claim_ip, 15, 3600)
        guard_rate(db, "admin_claim_account", str(account.id), 6, 3600)
        record_rate(db, "admin_claim_ip", claim_ip, 3600)
        record_rate(db, "admin_claim_account", str(account.id), 3600)
        allowed_emails = permanent_global_admin_emails()
        configured_secret = os.getenv("GLOBAL_ADMIN_RECOVERY_SECRET", "")
        if (
            email not in allowed_emails
            or len(configured_secret) < 32
            or not hmac.compare_digest(
                configured_secret.encode("utf-8"),
                payload.recovery_key.encode("utf-8"),
            )
        ):
            raise HTTPException(status_code=403, detail="admin_recovery_denied")

        grant = db.query(GlobalAdminBinding).filter(
            GlobalAdminBinding.email == email
        ).first()
        if grant is None:
            db.add(GlobalAdminBinding(email=email, account_id=account.id))
        else:
            grant.account_id = account.id
            grant.claimed_at = datetime.now(timezone.utc)
        db.commit()
        return {"role": "global_admin", "account_id": account.id}

    def admin_account(
        authorization: str | None = Header(default=None),
        db: Session = Depends(get_db),
    ) -> WebAccount:
        account=account_lookup(db,authorization)
        if role_for(db,account)!="global_admin":
            raise HTTPException(status_code=403,detail="global_admin_only")
        return account

    @app.get("/demo/manage/accounts")
    def accounts(
        _admin: WebAccount=Depends(admin_account),
        db: Session=Depends(get_db),
    ):
        rows=db.query(WebAccount).order_by(WebAccount.id.desc()).limit(300).all()
        return [{
            "account_id":a.id,"email":a.email,
            "name":f"{a.first_name} {a.last_name}",
            "role":role_for(db,a),
        } for a in rows]

    @app.put("/demo/manage/accounts/{account_id}/role")
    def change_role(
        account_id:int,payload:AccountRoleChange,
        _admin:WebAccount=Depends(admin_account),
        db:Session=Depends(get_db),
    ):
        target=db.query(WebAccount).filter(WebAccount.id==account_id).first()
        if target is None:
            raise HTTPException(status_code=404,detail="account_not_found")
        if account_id in global_admin_ids():
            raise HTTPException(status_code=403,detail="cannot_change_global_admin")
        if payload.role=="participant":
            owns=db.query(EventOwnership).filter(EventOwnership.owner_account_id==account_id).first()
            if owns:
                raise HTTPException(status_code=409,detail="organizer_still_owns_events")
        record=db.query(WebAccountRole).filter(WebAccountRole.account_id==account_id).first()
        if record:
            record.role=payload.role
        else:
            db.add(WebAccountRole(account_id=account_id,role=payload.role))
        db.commit()
        return {"account_id":account_id,"role":payload.role}
