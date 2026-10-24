"""Public opt-in organizer pages. No private account, attendee or ticket fields."""
from __future__ import annotations

import re
from datetime import datetime, timezone
from urllib.parse import urlsplit
from fastapi import Depends, Header, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, LargeBinary, String, Text, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from db.base import Base
from demo_accounts import WebAccount
from demo_roles import EventOwnership, account_lookup, ensure_manage, role_for
from demo_publication import state as publication_state


class OrganizerPublicProfile(Base):
    __tablename__ = "tt_organizer_public_profiles"
    account_id = Column(Integer, ForeignKey("demo_web_accounts.id"), primary_key=True)
    slug = Column(String(75), nullable=False, unique=True, index=True)
    display_name = Column(String(100), nullable=False)
    bio = Column(Text, nullable=False, default="")
    city = Column(String(100), nullable=False, default="")
    website_url = Column(String(400), nullable=False, default="")
    instagram = Column(String(32), nullable=False, default="")
    published = Column(Boolean, nullable=False, default=False, server_default="false")
    logo_type = Column(String(32), nullable=True)
    logo_bytes = Column(LargeBinary, nullable=True)
    cover_type = Column(String(32), nullable=True)
    cover_bytes = Column(LargeBinary, nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))


SLUG = re.compile(r"^[a-z0-9](?:[a-z0-9-]{1,69}[a-z0-9])?$")
HANDLE = re.compile(r"^[A-Za-z0-9._]{1,30}$")
RESERVED = {"admin", "support", "tickettreat", "official", "tickets", "events", "profile"}


class ProfileUpdate(BaseModel):
    slug: str = Field(min_length=3, max_length=75)
    display_name: str = Field(min_length=2, max_length=100)
    bio: str = Field(default="", max_length=2000)
    city: str = Field(default="", max_length=100)
    website_url: str = Field(default="", max_length=400)
    instagram: str = Field(default="", max_length=32)
    published: bool = False

    @field_validator("slug")
    @classmethod
    def valid_slug(cls, value: str) -> str:
        value = value.strip().lower()
        if not SLUG.fullmatch(value) or value in RESERVED:
            raise ValueError("invalid_organizer_slug")
        return value

    @field_validator("display_name")
    @classmethod
    def valid_name(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("organizer_name_required")
        return value

    @field_validator("bio", "city")
    @classmethod
    def clean_text(cls, value: str) -> str:
        return value.strip()

    @field_validator("website_url")
    @classmethod
    def valid_website(cls, value: str) -> str:
        value = value.strip()
        if not value:
            return ""
        url = urlsplit(value)
        if url.scheme != "https" or not url.hostname or "." not in url.hostname or url.username or url.password or url.port:
            raise ValueError("invalid_https_website")
        if url.hostname in {"localhost", "127.0.0.1"} or url.hostname.endswith(".local"):
            raise ValueError("invalid_https_website")
        return value

    @field_validator("instagram")
    @classmethod
    def valid_instagram(cls, value: str) -> str:
        value = value.strip().lstrip("@")
        if value and not HANDLE.fullmatch(value):
            raise ValueError("invalid_instagram_handle")
        return value


class ProfileImageUpload(BaseModel):
    data_url: str = Field(max_length=3_000_000)


def is_public(db: Session, row: OrganizerPublicProfile) -> bool:
    if not row.published:
        return False
    account = db.get(WebAccount, row.account_id)
    return bool(account and role_for(db, account) in {"organizer", "global_admin"})


def public_summary(row: OrganizerPublicProfile) -> dict:
    prefix = f"/api/gateway/demo/public/organizers/{row.slug}/media"
    return {
        "slug": row.slug,
        "display_name": row.display_name,
        "bio": row.bio,
        "city": row.city,
        "website_url": row.website_url,
        "instagram": row.instagram,
        "logo_url": f"{prefix}/logo" if row.logo_bytes else None,
        "cover_url": f"{prefix}/cover" if row.cover_bytes else None,
    }


def profile_for_event(db: Session, event_id: int) -> dict | None:
    owner = db.get(EventOwnership, event_id)
    if owner is None:
        return None
    profile = db.get(OrganizerPublicProfile, owner.owner_account_id)
    return public_summary(profile) if profile and is_public(db, profile) else None


def install_organizer_public_profiles(app, get_db, main):
    def editor(
        authorization: str | None = Header(default=None),
        db: Session = Depends(get_db),
    ) -> WebAccount:
        account = account_lookup(db, authorization)
        ensure_manage(db, account)
        return account

    @app.get("/demo/manage/organizer-profile")
    def own_profile(account: WebAccount = Depends(editor), db: Session = Depends(get_db)):
        row = db.get(OrganizerPublicProfile, account.id)
        if row is None:
            return {"slug": f"organizer-{account.id}", "display_name": "",
                    "bio": "", "city": "", "website_url": "", "instagram": "",
                    "logo_url": None, "cover_url": None, "published": False}
        return {**public_summary(row), "published": row.published}

    @app.put("/demo/manage/organizer-profile")
    def save_profile(payload: ProfileUpdate, account: WebAccount = Depends(editor),
                     db: Session = Depends(get_db)):
        if payload.published and len(payload.bio) < 30:
            raise HTTPException(422, "organizer_bio_min_30_for_publication")
        row = db.get(OrganizerPublicProfile, account.id)
        if row is not None and row.published and row.slug != payload.slug:
            # Keep indexed public links stable while the page is published.
            raise HTTPException(409, "unpublish_before_changing_profile_slug")
        if row is None:
            row = OrganizerPublicProfile(account_id=account.id, slug=payload.slug,
                                         display_name=payload.display_name)
            db.add(row)
        conflict = db.query(OrganizerPublicProfile.account_id).filter(
            OrganizerPublicProfile.slug == payload.slug,
            OrganizerPublicProfile.account_id != account.id,
        ).first()
        if conflict:
            raise HTTPException(409, "organizer_slug_taken")
        for name in ("slug", "display_name", "bio", "city", "website_url", "instagram", "published"):
            setattr(row, name, getattr(payload, name))
        row.updated_at = datetime.now(timezone.utc)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(409, "organizer_slug_taken")
        return {**public_summary(row), "published": row.published}

    @app.put("/demo/manage/organizer-profile/media/{kind}")
    def save_image(kind: str, payload: ProfileImageUpload,
                   account: WebAccount = Depends(editor), db: Session = Depends(get_db)):
        if kind not in {"logo", "cover"}:
            raise HTTPException(404, "media_not_found")
        row = db.get(OrganizerPublicProfile, account.id)
        if row is None:
            raise HTTPException(409, "save_organizer_profile_first")
        # Same signature validation as production poster uploads; never SVG/HTML.
        content_type, image = main.decode_demo_poster(payload.data_url)
        if len(image) > (600_000 if kind == "logo" else 2_000_000):
            raise HTTPException(413, "organizer_image_too_large")
        setattr(row, kind + "_type", content_type)
        setattr(row, kind + "_bytes", image)
        row.updated_at = datetime.now(timezone.utc)
        db.commit()
        return {**public_summary(row), "published": row.published}

    @app.delete("/demo/manage/organizer-profile/media/{kind}")
    def delete_image(kind: str, account: WebAccount = Depends(editor),
                     db: Session = Depends(get_db)):
        if kind not in {"logo", "cover"}:
            raise HTTPException(404, "media_not_found")
        row = db.get(OrganizerPublicProfile, account.id)
        if row is None:
            raise HTTPException(404, "organizer_profile_not_found")
        setattr(row, kind + "_bytes", None)
        setattr(row, kind + "_type", None)
        db.commit()
        return {**public_summary(row), "published": row.published}

    @app.get("/demo/public/organizers")
    def list_public(db: Session = Depends(get_db)):
        rows = db.query(OrganizerPublicProfile).filter(
            OrganizerPublicProfile.published.is_(True)
        ).order_by(OrganizerPublicProfile.account_id).limit(500).all()
        return [public_summary(row) for row in rows if is_public(db, row)]

    @app.get("/demo/public/organizers/{slug}")
    def public_profile(slug: str, db: Session = Depends(get_db)):
        if not SLUG.fullmatch(slug):
            raise HTTPException(404, "organizer_not_found")
        row = db.query(OrganizerPublicProfile).filter(
            OrganizerPublicProfile.slug == slug
        ).first()
        if row is None or not is_public(db, row):
            raise HTTPException(404, "organizer_not_found")
        owned = (db.query(main.Event)
                 .join(EventOwnership, EventOwnership.event_id == main.Event.id)
                 .filter(EventOwnership.owner_account_id == row.account_id)
                 .order_by(main.Event.starts_at.desc()).limit(250).all())
        published = [event for event in owned
                     if publication_state(db, event.id)["visible"] and not event.is_cancelled]
        upcoming = [event for event in published if not main.event_is_past(event)]
        history = [event for event in published if main.event_is_past(event)]
        to_public = lambda event: main.event_to_dict(event, db=db)
        return {**public_summary(row),
                "upcoming_events": [to_public(event) for event in sorted(
                    upcoming, key=lambda e: e.starts_at or datetime.max)[:30]],
                "past_events": [to_public(event) for event in history[:30]],
                "upcoming_count": len(upcoming), "past_count": len(history)}

    @app.get("/demo/public/organizers/{slug}/media/{kind}")
    def public_image(slug: str, kind: str, db: Session = Depends(get_db)):
        if kind not in {"logo", "cover"} or not SLUG.fullmatch(slug):
            raise HTTPException(404, "media_not_found")
        row = db.query(OrganizerPublicProfile).filter(
            OrganizerPublicProfile.slug == slug).first()
        if row is None or not is_public(db, row):
            raise HTTPException(404, "media_not_found")
        blob = getattr(row, kind + "_bytes")
        ctype = getattr(row, kind + "_type")
        if not blob or not ctype:
            raise HTTPException(404, "media_not_found")
        return Response(content=blob, media_type=ctype,
                        headers={"Cache-Control": "public,max-age=120", "X-Content-Type-Options": "nosniff"})
