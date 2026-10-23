"""Web organizer and global-admin access control.

Global admins MUST be explicitly granted by immutable website account IDs
via GLOBAL_ADMIN_ACCOUNT_IDS. Email alone is NOT proof of identity.
"""
from __future__ import annotations
import csv
import json
import base64
from urllib.parse import urlsplit
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
from sqlalchemy import Column, DateTime, Integer, LargeBinary, String, Text, UniqueConstraint, Boolean, func
from sqlalchemy.orm import Session
from db.base import Base
from demo_geography import DemoEventPlace, place_dict, save_place
from demo_accounts import WebAccount, WebSession, token_hash, safe_csv
from demo_auth_security import guard_rate, record_rate
from demo_publication import EventPublication, state as publication_state, set_publication

class WebAccountRole(Base):
    __tablename__ = "demo_web_account_roles"
    account_id = Column(Integer, primary_key=True)
    role = Column(String(20), nullable=False, default="participant")
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

class OrganizerApplication(Base):
    __tablename__ = "demo_organizer_applications"
    account_id = Column(Integer, primary_key=True)
    status = Column(String(24), nullable=False, default="pending")
    created_at = Column(DateTime(timezone=True), nullable=False,
                        default=lambda: datetime.now(timezone.utc))
    decided_at = Column(DateTime(timezone=True), nullable=True)
    decided_by = Column(Integer, nullable=True)


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


class GlobalAdminDelegation(Base):
    """Audited global-admin grant bound to one *verified* immutable account.

    Neither a matching email nor an unverified signup can claim this grant.
    The granting admin must pass existing privileged MFA checks.
    """
    __tablename__ = "demo_global_admin_delegations"
    account_id = Column(Integer, primary_key=True)
    email = Column(String(255), nullable=False)
    granted_by = Column(Integer, nullable=False)
    granted_at = Column(DateTime(timezone=True), nullable=False,
                        default=lambda: datetime.now(timezone.utc))
    revoked_at = Column(DateTime(timezone=True), nullable=True)


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

class EventMedia(Base):
    """Curated external photo/video links; use object storage for actual uploads."""
    __tablename__ = "demo_event_media"
    event_id = Column(Integer, primary_key=True)
    gallery_json = Column(Text, nullable=False, default="[]")
    video_url = Column(String(2048), nullable=True)


class EventGalleryImage(Base):
    """Bounded gallery storage for early pilots (up to eight images/event).

    For larger media traffic move these objects to dedicated image storage.
    """
    __tablename__ = "demo_event_gallery_images"
    id = Column(Integer, primary_key=True)
    event_id = Column(Integer, nullable=False, index=True)
    content_type = Column(String(32), nullable=False)
    image_bytes = Column(LargeBinary, nullable=True)
    object_key = Column(String(255),nullable=True)
    position = Column(Integer, nullable=False, default=0)
    is_cover = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False,
                        default=lambda: datetime.now(timezone.utc))


class GallerySort(BaseModel):
    ordered_ids: list[int] = Field(min_length=1,max_length=8)
    cover_id: int | None = None


class GalleryUpload(BaseModel):
    data_url: str = Field(min_length=40,max_length=2900000)


def validate_media_urls(gallery_urls, video_url):
    if gallery_urls is not None:
        if len(gallery_urls) > 8:
            raise HTTPException(status_code=422, detail="maximum_eight_gallery_images")
        for url in gallery_urls:
            if len(url) > 2048 or urlsplit(url).scheme != "https" or not urlsplit(url).netloc or "@" in urlsplit(url).netloc:
                raise HTTPException(status_code=422, detail="invalid_gallery_url")
    if video_url is not None and video_url:
        parsed = urlsplit(video_url)
        if len(video_url) > 2048 or parsed.scheme != "https" or not parsed.hostname or parsed.hostname.lower() not in {"youtube.com","www.youtube.com","youtu.be","www.youtu.be","vimeo.com","www.vimeo.com"}:
            raise HTTPException(status_code=422, detail="invalid_video_url")


def save_media(db, event_id, gallery_urls=None, video_url=None):
    if gallery_urls is None and video_url is None:
        return
    validate_media_urls(gallery_urls, video_url)
    media = db.query(EventMedia).filter(EventMedia.event_id == event_id).first()
    if media is None:
        media = EventMedia(event_id=event_id)
        db.add(media)
    if gallery_urls is not None:
        media.gallery_json = json.dumps(gallery_urls, ensure_ascii=False)
    if video_url is not None:
        media.video_url = video_url or None


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
    gallery_urls: list[str] = Field(default_factory=list)
    video_url: str | None = None
    reminder_minutes: list[int] = Field(default_factory=lambda: [10080, 1440, 180], min_length=1, max_length=4)
    reminder_text: str = Field(default="Your TicketTreat event starts soon.", max_length=1000)

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
    gallery_urls: list[str] | None = None
    video_url: str | None = None
    reminder_text: str | None = Field(default=None, max_length=1000)

class PublicationUpdate(BaseModel):
    status: str = Field(pattern="^(draft|published|scheduled)$")
    publish_at: datetime | None = None


class EventDuplicateOptions(BaseModel):
    starts_at: datetime | None = None


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
    delegation = db.get(GlobalAdminDelegation, account.id)
    if (delegation is not None and delegation.revoked_at is None
            and delegation.email == normalized_email):
        from demo_account_recovery import email_is_verified
        if email_is_verified(db, account.id):
            return "global_admin"
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
    from demo_mfa import require_privileged_mfa
    require_privileged_mfa(db,account,row)
    return account

def ensure_manage(db: Session, account: WebAccount) -> str:
    role = role_for(db, account)
    if role not in {"organizer", "global_admin"}:
        raise HTTPException(status_code=403, detail="organizer_role_required")
    # A self-selected organizer role is not sufficient proof of identity.
    # Enforce email ownership before exposing real participant data.
    if os.getenv("APP_ENV", "development").lower() == "production":
        from demo_account_recovery import email_is_verified
        if not email_is_verified(db, account.id):
            raise HTTPException(status_code=403, detail="email_verification_required")
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

def redact_organizer_ticket(ticket: dict[str,Any]) -> dict[str,Any]:
    """Never expose attendance bearer credentials to organizer dashboards.

    The check-in endpoint accepts a QR scanned from the attendee, not a list
    of all ticket secrets. Keep public ticket code and nonsecret status.
    """
    safe=dict(ticket)
    safe.pop("qr_token",None)
    guest=safe.get("guest")
    if isinstance(guest,dict):
        identity=dict(guest)
        identity.pop("access_token",None)
        safe["guest"]=identity
    return safe


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
    # Same-origin public gateway. Do not expose the internal Railway API host.
    event.image_url=f"/api/gateway/demo/events/{event.id}/poster"

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
        from demo_pilot_ops import EventPilotSettings, validate_reminders
        reminder_intervals = validate_reminders(payload.reminder_minutes)
        reminder_message = payload.reminder_text.strip()
        if not reminder_message:
            raise HTTPException(422, "reminder_message_required")
        if payload.starts_at is None:
            raise HTTPException(status_code=422,detail="date_required")
        # Existing bot event-creation logic remains the source of truth.
        values=payload.model_dump(exclude={"poster_data_url","country_code","city","gallery_urls","video_url","reminder_minutes"})
        validate_media_urls(payload.gallery_urls,payload.video_url)
        from main import EventCreate
        values["payment_instructions"]="DEMO PAYMENT — automatically confirmed" if payload.price > 0 else ""
        # The Telegram bot currently delivers one reminder, at the closest
        # configured offset. Email can deliver all configured offsets.
        values["reminder_minutes_before"]=min(reminder_intervals)
        values["reminder_text"]=reminder_message
        created=main.create_event(EventCreate(**values),db=db)
        if not isinstance(created,dict) or "id" not in created:
            raise HTTPException(status_code=422,detail=created.get("error","create_failed") if isinstance(created,dict) else "create_failed")
        eid=created["id"]
        event=db.query(main.Event).filter(main.Event.id==eid).first()
        db.add(EventPilotSettings(event_id=eid,reminder_minutes_json=json.dumps(reminder_intervals)))
        db.add(EventOwnership(event_id=eid,owner_account_id=account.id))
        set_publication(db,eid,"draft")
        save_place(db, DemoEventPlace, "event_id", eid, payload.country_code, payload.city)
        if payload.poster_data_url:
            poster_setup(db,main,request,event,payload.poster_data_url)
        save_media(db,eid,payload.gallery_urls,payload.video_url)
        audit(db,eid,account.id,"create")
        db.commit()
        db.refresh(event)
        return event_data(event,db,main)

    @app.put("/demo/manage/events/{event_id}/publication")
    def change_publication(event_id:int,payload:PublicationUpdate,
                           account:WebAccount=Depends(managing),
                           db:Session=Depends(get_db)):
        ensure_owner(db,event_id,account)
        event=db.query(main.Event).filter(
            main.Event.id==event_id
        ).with_for_update().first()
        if event is None:
            raise HTTPException(404,"event_not_found")
        if event.is_cancelled:
            raise HTTPException(409,"event_is_cancelled")
        if payload.status=="draft":
            # Hiding events with issued passes or waiting attendees breaks
            # existing users' links. Cancellation is a separate audited flow.
            has_tickets=db.query(main.DemoTicket.id).filter(
                main.DemoTicket.event_id==event_id,
                main.DemoTicket.ticket_status=="active",
            ).first()
            has_waiters=db.query(main.DemoWaitlist.id).filter(
                main.DemoWaitlist.event_id==event_id,
                main.DemoWaitlist.status=="waiting",
            ).first()
            if has_tickets or has_waiters or main.get_registered_count(db,event_id)>0:
                raise HTTPException(409,"cannot_unpublish_with_attendees")
        else:
            if not event.title or not event.title.strip() or not event.description or not event.description.strip():
                raise HTTPException(422,"publish_requires_title_and_description")
            if not event.location or not event.location.strip():
                raise HTTPException(422,"publish_requires_venue")
            place=db.query(DemoEventPlace).filter(DemoEventPlace.event_id==event_id).first()
            if not place or not place.country_code or not place.city:
                raise HTTPException(422,"publish_requires_country_and_city")
            if not event.starts_at or main.event_is_past(event):
                raise HTTPException(422,"publish_requires_future_start")
            if not event.max_participants or event.max_participants<1:
                raise HTTPException(422,"publish_requires_capacity")
            if not main.get_event_languages(db,event_id):
                raise HTTPException(422,"publish_requires_languages")
            if main.price_decimal(event.price)>0:
                raise HTTPException(409,"paid_event_publication_disabled")
            if payload.status=="scheduled":
                if payload.publish_at is None or payload.publish_at.tzinfo is None:
                    raise HTTPException(422,"publish_at_timezone_required")
                now=datetime.now(timezone.utc)
                from demo_publication import utc
                publish_at=utc(payload.publish_at)
                event_start=main.normalize_event_datetime(event.starts_at).astimezone(timezone.utc)
                if not now < publish_at < event_start:
                    raise HTTPException(422,"publish_at_must_precede_event")
            elif payload.publish_at is not None:
                raise HTTPException(422,"publish_at_only_for_scheduled")
        set_publication(db,event_id,payload.status,payload.publish_at)
        audit(db,event_id,account.id,"publication",payload.status)
        db.commit()
        db.refresh(event)
        return event_data(event,db,main)

    @app.post("/demo/manage/events/{event_id}/duplicate",status_code=201)
    def duplicate_event(event_id:int,payload:EventDuplicateOptions,request:Request,
                        account:WebAccount=Depends(managing),
                        db:Session=Depends(get_db)):
        ensure_owner(db,event_id,account)
        source=db.query(main.Event).filter(main.Event.id==event_id).first()
        if source is None:
            raise HTTPException(404,"event_not_found")
        place=db.query(DemoEventPlace).filter(DemoEventPlace.event_id==event_id).first()
        if place is None or not place.city or not place.country_code:
            raise HTTPException(422,"set_source_country_and_city_first")
        original=db.query(EventMedia).filter(EventMedia.event_id==event_id).first()
        external=json.loads(original.gallery_json or "[]") if original else []
        video=original.video_url if original else None
        source_poster=db.query(main.DemoEventPoster).filter(
            main.DemoEventPoster.event_id==event_id,
        ).first()
        poster=None
        if source_poster is not None:
            poster="data:"+source_poster.content_type+";base64,"+base64.b64encode(
                source_poster.image_bytes).decode("ascii")
        languages=main.get_event_languages(db,event_id)
        if not languages:
            raise HTTPException(422,"source_languages_missing")
        data=CreateManageEvent(
            title=(source.title[:240]+" (копия)") if len(source.title)<241 else source.title[:255],
            organizer=source.organizer,location=source.location,
            description=source.description,max_participants=source.max_participants,
            price=source.price or Decimal("0"),currency=source.currency or "CZK",
            starts_at=payload.starts_at or source.starts_at,
            languages=languages,country_code=place.country_code,city=place.city,
            gallery_urls=external,video_url=video,poster_data_url=poster,
            reminder_minutes=__import__("demo_pilot_ops").effective_settings(db, source.id)["reminder_minutes"],
            reminder_text=(source.reminder_text or "Your TicketTreat event starts soon."),
        )
        # Copy only editorial media; fail before creating the new event if limits have changed.
        source_images=db.query(EventGalleryImage).filter(
            EventGalleryImage.event_id==event_id,
        ).order_by(EventGalleryImage.id).all()
        if len(source_images)+len(external)>8:
            raise HTTPException(409,"gallery_limit_reached")
        result=new_event(data,request,account,db)
        for image in source_images:
            db.add(EventGalleryImage(event_id=result["id"],
                                     content_type=image.content_type,
                                     image_bytes=image.image_bytes))
        audit(db,result["id"],account.id,"duplicate",f"from:{event_id}")
        db.commit()
        return event_data(db.get(main.Event,result["id"]),db,main)

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
        gallery=values.pop("gallery_urls",None)
        video=values.pop("video_url",None)
        geo_country=values.pop("country_code",None)
        geo_city=values.pop("city",None)
        if not values and poster is None and gallery is None and video is None and geo_country is None and geo_city is None:
            raise HTTPException(status_code=422,detail="no_changes")
        validate_payload(values.get("languages"),values.get("currency"))
        if "reminder_text" in values:
            values["reminder_text"] = (values["reminder_text"] or "").strip() or "Your TicketTreat event starts soon."
        cap=values.get("max_participants",event.max_participants)
        if cap is not None and cap < main.get_registered_count(db,event_id):
            raise HTTPException(status_code=409,detail="capacity_below_registration_count")
        if "starts_at" in values and values["starts_at"] is None:
            raise HTTPException(status_code=422,detail="date_required")
        if "price" in values and values["price"] is None:
            raise HTTPException(status_code=422,detail="invalid_price")
        validate_media_urls(gallery, video)
        if gallery is not None:
            uploaded = db.query(EventGalleryImage).filter(
                EventGalleryImage.event_id == event_id
            ).count()
            if len(gallery)+uploaded > 8:
                raise HTTPException(409,"gallery_limit_reached")
        if poster:
            main.decode_demo_poster(poster)  # fail before updating event
        original_start=event.starts_at
        original_location=event.location
        if values:
            from main import EventUpdate
            outcome=main.update_event(event_id,EventUpdate(**values),db=db,commit=False)
            if isinstance(outcome,dict) and outcome.get("error"):
                raise HTTPException(status_code=422,detail=outcome["error"])
        if geo_country is not None or geo_city is not None:
            previous=db.query(DemoEventPlace).filter(DemoEventPlace.event_id==event_id).first()
            country=geo_country if geo_country is not None else (previous.country_code if previous else None)
            city=geo_city if geo_city is not None else (previous.city if previous else None)
            save_place(db, DemoEventPlace, "event_id", event_id, country, city)
        if poster:
            poster_setup(db,main,request,event,poster)
        save_media(db,event_id,gallery,video)
        # Transactional service messages for material changes only.
        changes=[]
        if event.starts_at != original_start:
            changes.append("Date/time: "+str(event.starts_at))
            # Suppress obsolete reminders for the old start time and
            # enqueue fresh reminders only for verified active holders.
            from demo_email import EmailOutbox, queue_event_reminder, ticket_language
            db.query(EmailOutbox).filter(
                EmailOutbox.kind=="reminder",
                EmailOutbox.state=="pending",
                EmailOutbox.ticket_id.in_(
                    db.query(main.DemoTicket.id).filter(
                        main.DemoTicket.event_id==event_id
                    )
                ),
            ).update({EmailOutbox.state:"skipped"},synchronize_session=False)
            for ticket in db.query(main.DemoTicket).filter(
                main.DemoTicket.event_id==event_id,
                main.DemoTicket.ticket_status=="active",
            ).all():
                guest=db.get(main.DemoGuest,ticket.guest_id)
                if guest is not None:
                    queue_event_reminder(db,event=event,guest=guest,ticket=ticket,
                                         language=ticket_language(db,ticket.id))
        if event.location != original_location:
            changes.append("Location: "+str(event.location or "Not specified"))
        if changes:
            from demo_email import queue_event_notice
            queue_event_notice(db,event=event,kind="change",message="; ".join(changes))
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
        # The notice is queued BEFORE entries become invalid; no unverified
        # addresses are contacted. Delivery awaits a configured mail provider.
        from demo_email import queue_event_notice
        queue_event_notice(db,event=event,kind="cancel",message=reason)
        for ticket in db.query(main.DemoTicket).filter(
            main.DemoTicket.event_id==event_id,
            main.DemoTicket.ticket_status=="active",
        ).all():
            ticket.ticket_status="cancelled"
            ticket.payment_status=("not_required" if ticket.payment_provider in {"free","legacy_free"}
                                   else "cancelled_demo")
            ticket.cancelled_at=event.cancelled_at
        audit(db,event_id,account.id,"cancel",reason)
        db.commit()
        db.refresh(event)
        return event_data(event,db,main)

    @app.get("/demo/events/{event_id}/gallery/{image_id}")
    def public_gallery_image(event_id:int,image_id:int,db:Session=Depends(get_db),
                             authorization:str|None=Header(default=None)):
        if not publication_state(db,event_id)["visible"]:
            ensure_owner(db,event_id,account_lookup(db,authorization))
        image=db.query(EventGalleryImage).filter(
            EventGalleryImage.id==image_id,
            EventGalleryImage.event_id==event_id,
        ).first()
        if image is None:
            raise HTTPException(404,"gallery_image_not_found")
        if image.object_key:
            from demo_media_store import load
            content=load(image.object_key)
        else:
            content=image.image_bytes
        return Response(content=content,media_type=image.content_type,
                        headers={"Cache-Control":"public, max-age=3600",
                                 "X-Content-Type-Options":"nosniff"})

    @app.post("/demo/manage/events/{event_id}/gallery",status_code=201)
    def upload_gallery(event_id:int,payload:GalleryUpload,
                       account:WebAccount=Depends(managing),db:Session=Depends(get_db)):
        ensure_owner(db,event_id,account)
        event=db.query(main.Event).filter(main.Event.id==event_id).with_for_update().first()
        if event is None:raise HTTPException(404,"event_not_found")
        if event.is_cancelled:raise HTTPException(409,"event_is_cancelled")
        media=db.get(EventMedia,event_id)
        urls=json.loads(media.gallery_json or "[]") if media else []
        uploaded=db.query(EventGalleryImage).filter(EventGalleryImage.event_id==event_id).count()
        if len(urls)+uploaded>=8:raise HTTPException(409,"gallery_limit_reached")
        content_type,blob=main.decode_demo_poster(payload.data_url)
        if len(blob)>2*1024*1024:raise HTTPException(413,"gallery_image_too_large")
        from demo_media_store import configured,store
        object_key=None
        if configured():
            object_key,content_type=store(event_id,blob)
            blob=None
        image=EventGalleryImage(event_id=event_id,content_type=content_type,image_bytes=blob,
                                object_key=object_key,position=uploaded,is_cover=(uploaded==0))
        db.add(image)
        db.flush()
        audit(db,event_id,account.id,"gallery_upload",f"image:{image.id}")
        db.commit()
        return {"id":image.id,"url":f"/api/gateway/demo/events/{event_id}/gallery/{image.id}"}

    @app.delete("/demo/manage/events/{event_id}/gallery/{image_id}")
    def delete_gallery(event_id:int,image_id:int,account:WebAccount=Depends(managing),
                       db:Session=Depends(get_db)):
        ensure_owner(db,event_id,account)
        image=db.query(EventGalleryImage).filter(
            EventGalleryImage.id==image_id,EventGalleryImage.event_id==event_id
        ).first()
        if image is None:raise HTTPException(404,"gallery_image_not_found")
        key=image.object_key
        db.delete(image)
        audit(db,event_id,account.id,"gallery_delete",f"image:{image_id}")
        db.commit()
        if key:
            from demo_media_store import remove
            remove(key)
        return {"status":"deleted","id":image_id}

    @app.put("/demo/manage/events/{event_id}/gallery/order")
    def gallery_order(event_id:int,payload:GallerySort,
                      account:WebAccount=Depends(managing),db:Session=Depends(get_db)):
        ensure_owner(db,event_id,account)
        images=db.query(EventGalleryImage).filter(EventGalleryImage.event_id==event_id).all()
        actual={image.id for image in images}
        if len(set(payload.ordered_ids))!=len(payload.ordered_ids) or set(payload.ordered_ids)!=actual:
            raise HTTPException(422,"gallery_order_mismatch")
        if payload.cover_id is not None and payload.cover_id not in actual:
            raise HTTPException(422,"gallery_cover_not_in_event")
        selected=payload.cover_id if payload.cover_id is not None else payload.ordered_ids[0]
        ordered={id:i for i,id in enumerate(payload.ordered_ids)}
        for image in images:
            image.position=ordered[image.id]
            image.is_cover=image.id==selected
        audit(db,event_id,account.id,"gallery_sort",str(payload.ordered_ids))
        db.commit()
        return {"ordered_ids":payload.ordered_ids,"cover_id":selected}

    @app.get("/demo/manage/events/{event_id}/email-status")
    def email_status(event_id:int,account:WebAccount=Depends(managing),
                     db:Session=Depends(get_db)):
        ensure_owner(db,event_id,account)
        from demo_accounts import WebAccount
        from demo_account_recovery import VerifiedEmail
        from demo_email import EmailOutbox, configured
        verified=db.query(func.count(func.distinct(WebAccount.id))).select_from(
            main.DemoTicket
        ).join(WebAccount,WebAccount.guest_id==main.DemoTicket.guest_id).join(
            VerifiedEmail,VerifiedEmail.account_id==WebAccount.id
        ).filter(main.DemoTicket.event_id==event_id,
                 main.DemoTicket.ticket_status=="active").scalar() or 0
        states=db.query(EmailOutbox.state,func.count(EmailOutbox.id)).join(
            main.DemoTicket,main.DemoTicket.id==EmailOutbox.ticket_id
        ).filter(main.DemoTicket.event_id==event_id).group_by(EmailOutbox.state).all()
        from demo_telegram_notifications import (
            TelegramNotificationOutbox, configured as telegram_configured, recipient_ids,
        )
        # Owner-scoped aggregate telemetry; no Telegram IDs exposed.
        telegram_users = len(recipient_ids(db,event_id,main)) if telegram_configured() else 0
        telegram_states = db.query(
            TelegramNotificationOutbox.state,func.count(TelegramNotificationOutbox.id)
        ).filter(
            TelegramNotificationOutbox.event_id == event_id
        ).group_by(TelegramNotificationOutbox.state).all()
        return {"email_enabled":configured(),"verified_ticket_holders":verified,
                "message_states":{state:count for state,count in states},
                "telegram_enabled":telegram_configured(),
                "telegram_recipients":telegram_users,
                "telegram_message_states":{state:count for state,count in telegram_states},
                "scope":"operational event notifications only; marketing requires consent"}

    @app.get("/demo/manage/events/{event_id}/participants")
    def event_participants(event_id:int,account:WebAccount=Depends(managing),db:Session=Depends(get_db)):
        ensure_owner(db,event_id,account)
        # Existing ticket serialization preserved and scoped.
        result=main.demo_admin_event_tickets(event_id,_admin_key="",db=db)
        return {
            **result,
            "tickets":[redact_organizer_ticket(t) for t in result["tickets"]],
            "waitlist":[{
                **w,
                "guest":{k:v for k,v in w.get("guest",{}).items()
                         if k!="access_token"},
            } for w in result["waitlist"]],
        }

    @app.get("/demo/manage/events/{event_id}/participants.csv")
    def participant_export(event_id:int,account:WebAccount=Depends(managing),db:Session=Depends(get_db)):
        ensure_owner(db,event_id,account)
        route=next((r for r in app.routes if getattr(r,"path","")=="/demo/admin/events/{event_id}/participants.csv"),None)
        if route is None:
            raise HTTPException(status_code=500,detail="csv_export_not_available")
        # Directly delegate ONLY after server-side ownership authorization.
        return route.endpoint(event_id=event_id,_admin_key="",db=db)

    def _secure_checkin(qr_token: str, account: WebAccount, db: Session):
        ticket=db.query(main.DemoTicket).filter(main.DemoTicket.qr_token==qr_token).first()
        if ticket is None:
            raise HTTPException(status_code=404,detail="ticket_not_found")
        ensure_owner(db,ticket.event_id,account)
        first_checkin=ticket.checked_in_at is None
        result=main.demo_admin_check_in(qr_token,_admin_key="",db=db)
        if first_checkin and result.get("status")=="checked_in":
            audit(db,ticket.event_id,account.id,"checkin",f"ticket:{ticket.id}")
            db.commit()
        return {**result,"ticket":redact_organizer_ticket(result["ticket"])}

    @app.post("/demo/manage/check-in")
    def secure_check_in(payload: ScanTicketPayload,account:WebAccount=Depends(managing),
                        db:Session=Depends(get_db)):
        # QR proof is in the POST body so edge/router access logs do not
        # persist ticket bearer credentials as part of the URL.
        return _secure_checkin(payload.qr_token,account,db)

    @app.post("/demo/manage/check-in/{qr_token}")
    def check_in(qr_token:str,account:WebAccount=Depends(managing),
                 db:Session=Depends(get_db)):
        # Existing link shape remains available in development only.
        if os.getenv("APP_ENV","development").strip().lower()=="production":
            raise HTTPException(status_code=410,detail="use_body_based_checkin")
        return _secure_checkin(qr_token,account,db)

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

class AccountAdminAudit(Base):
    """Non-secret audit trail of privileged changes, retained for review."""
    __tablename__ = "demo_account_admin_audit"
    id = Column(Integer, primary_key=True)
    actor_account_id = Column(Integer, nullable=False, index=True)
    target_account_id = Column(Integer, nullable=False, index=True)
    action = Column(String(48), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))


class OrganizerDecision(BaseModel):
    approve: bool


class ScanTicketPayload(BaseModel):
    qr_token: str = Field(min_length=24,max_length=80)


class GlobalAdminGrantRequest(BaseModel):
    email: str = Field(min_length=5, max_length=255)


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
        from demo_account_recovery import email_is_verified
        if not email_is_verified(db, account.id):
            raise HTTPException(status_code=403, detail="email_verification_required")
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
        db.add(AccountAdminAudit(actor_account_id=account.id,target_account_id=account.id,
                                 action="admin_recovery_claim"))
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


    @app.get("/demo/manage/global-admins")
    def list_global_admin_delegations(
        _admin: WebAccount = Depends(admin_account),
        db: Session = Depends(get_db),
    ):
        rows = db.query(GlobalAdminDelegation).filter(
            GlobalAdminDelegation.revoked_at.is_(None),
        ).order_by(GlobalAdminDelegation.granted_at.asc()).all()
        return [{"account_id":r.account_id,"email":r.email,"granted_at":r.granted_at}
                for r in rows]

    @app.post("/demo/manage/global-admins/grant")
    def grant_global_admin(
        payload: GlobalAdminGrantRequest,
        admin: WebAccount = Depends(admin_account),
        db: Session = Depends(get_db),
    ):
        """Grant only to an existing account with independently verified email."""
        from demo_accounts import normalize_email
        from demo_account_recovery import email_is_verified
        email = normalize_email(payload.email)
        target = db.query(WebAccount).filter(WebAccount.email == email).with_for_update().first()
        if target is None:
            raise HTTPException(404, "account_not_found_sign_up_first")
        if not email_is_verified(db, target.id):
            raise HTTPException(403, "target_email_verification_required")
        if target.id in global_admin_ids():
            return {"account_id":target.id,"email":email,"role":"global_admin"}
        # Never treat the address alone as an authorization secret.
        delegation = db.get(GlobalAdminDelegation,target.id)
        if delegation is None:
            delegation = GlobalAdminDelegation(account_id=target.id,email=email,
                                               granted_by=admin.id)
            db.add(delegation)
        else:
            delegation.email=email
            delegation.granted_by=admin.id
            delegation.granted_at=datetime.now(timezone.utc)
            delegation.revoked_at=None
        db.add(AccountAdminAudit(actor_account_id=admin.id,
                                  target_account_id=target.id,
                                  action="global_admin_granted"))
        db.commit()
        return {"account_id":target.id,"email":email,"role":"global_admin",
                "mfa_setup_required":True}

    @app.delete("/demo/manage/global-admins/{account_id}")
    def revoke_global_admin(
        account_id: int,
        admin: WebAccount = Depends(admin_account),
        db: Session = Depends(get_db),
    ):
        if account_id == admin.id or account_id in global_admin_ids():
            raise HTTPException(403, "protected_global_admin")
        delegation = db.query(GlobalAdminDelegation).filter(
            GlobalAdminDelegation.account_id == account_id
        ).with_for_update().first()
        if delegation is None or delegation.revoked_at is not None:
            raise HTTPException(404,"active_delegation_not_found")
        delegation.revoked_at=datetime.now(timezone.utc)
        db.add(AccountAdminAudit(actor_account_id=admin.id,
                                  target_account_id=account_id,
                                  action="global_admin_revoked"))
        db.commit()
        return {"status":"revoked","account_id":account_id}


    @app.post("/demo/auth/organizer-application",status_code=202)
    def request_organizer(authorization:str|None=Header(default=None),
                          db:Session=Depends(get_db)):
        from demo_account_recovery import email_is_verified
        account=account_lookup(db,authorization)
        if role_for(db,account)!="participant":
            raise HTTPException(409,"already_privileged")
        if not email_is_verified(db,account.id):
            raise HTTPException(403,"email_verification_required")
        row=db.get(OrganizerApplication,account.id)
        if row is None:
            db.add(OrganizerApplication(account_id=account.id,status="pending"))
        elif row.status=="rejected":
            row.status="pending";row.decided_at=None;row.decided_by=None
        db.commit()
        return {"status":"pending"}

    @app.get("/demo/auth/organizer-application")
    def organizer_status(authorization:str|None=Header(default=None),
                         db:Session=Depends(get_db)):
        account=account_lookup(db,authorization)
        row=db.get(OrganizerApplication,account.id)
        return {"status":row.status if row else "none",
                "role":role_for(db,account)}

    @app.get("/demo/manage/organizer-applications")
    def pending_organizers(admin:WebAccount=Depends(admin_account),
                           db:Session=Depends(get_db)):
        results=db.query(OrganizerApplication,WebAccount).join(
            WebAccount,WebAccount.id==OrganizerApplication.account_id
        ).filter(OrganizerApplication.status=="pending").order_by(
            OrganizerApplication.created_at.asc()).limit(100).all()
        return [{"account_id":a.id,"email":a.email,"created_at":req.created_at}
                for req,a in results]

    @app.post("/demo/manage/organizer-applications/{account_id}/decision")
    def decide_organizer(account_id:int,payload:OrganizerDecision,
                         admin:WebAccount=Depends(admin_account),
                         db:Session=Depends(get_db)):
        from demo_account_recovery import email_is_verified
        application=db.query(OrganizerApplication).filter(
            OrganizerApplication.account_id==account_id).with_for_update().first()
        if application is None or application.status!="pending":
            raise HTTPException(404,"pending_application_not_found")
        target=db.query(WebAccount).filter(WebAccount.id==account_id).first()
        if target is None or (payload.approve and not email_is_verified(db,target.id)):
            raise HTTPException(409,"account_or_verification_missing")
        application.status="approved" if payload.approve else "rejected"
        application.decided_at=datetime.now(timezone.utc);application.decided_by=admin.id
        if payload.approve:
            role=db.get(WebAccountRole,target.id)
            if role is None:db.add(WebAccountRole(account_id=target.id,role="organizer"))
            else:role.role="organizer"
        db.add(AccountAdminAudit(actor_account_id=admin.id,
            target_account_id=account_id,action="organizer_approved" if payload.approve else "organizer_rejected"))
        db.commit()
        return {"status":application.status,"account_id":account_id}

    @app.get("/demo/manage/account-audit")
    def account_audit(
        _admin: WebAccount = Depends(admin_account),
        db: Session = Depends(get_db),
    ):
        records=db.query(AccountAdminAudit).order_by(AccountAdminAudit.id.desc()).limit(100).all()
        return [{"actor_account_id":r.actor_account_id,
                 "target_account_id":r.target_account_id,
                 "action":r.action,"created_at":r.created_at} for r in records]


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
        db.add(AccountAdminAudit(actor_account_id=_admin.id,target_account_id=target.id,
                                 action="grant_"+payload.role))
        db.commit()
        return {"account_id":account_id,"role":payload.role}
