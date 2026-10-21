"""Globally administered homepage content for the public Crowdly website.

Editable text and a small hero image live in PostgreSQL. This keeps demo
content durable across Railway container restarts. Use object storage for
production-scale media.
"""
from __future__ import annotations

import os
from urllib.parse import urlsplit
from fastapi import Depends, Header, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import Column, Integer, String, Text, LargeBinary
from sqlalchemy.orm import Session
from db.base import Base
from demo_roles import role_for, account_lookup
from demo_accounts import WebAccount


class SiteLanding(Base):
    __tablename__ = "demo_site_landing"
    id = Column(Integer, primary_key=True)
    headline = Column(String(140), nullable=False)
    subtitle = Column(Text, nullable=False)
    hero_image_type = Column(String(40), nullable=True)
    hero_image_bytes = Column(LargeBinary, nullable=True)


class SiteLandingUpdate(BaseModel):
    headline: str = Field(min_length=3, max_length=140)
    subtitle: str = Field(min_length=3, max_length=750)
    hero_image_data_url: str | None = Field(default=None, max_length=5700000)
    remove_hero_image: bool = False


DEFAULT_HEADLINE = "Discover your next event"
DEFAULT_SUBTITLE = "Find experiences worth remembering near you."


def install_site_content(app, get_db, main):
    def serialize(db: Session, request: Request):
        row = db.get(SiteLanding, 1)
        base = os.getenv("DEMO_PUBLIC_API_URL", "").strip().rstrip("/") or str(request.base_url).rstrip("/")
        if urlsplit(base).scheme not in {"http", "https"}:
            base = str(request.base_url).rstrip("/")
        return {
            "headline": row.headline if row else DEFAULT_HEADLINE,
            "subtitle": row.subtitle if row else DEFAULT_SUBTITLE,
            "hero_image_url": f"{base}/demo/site/hero" if row and row.hero_image_bytes else None,
        }

    @app.get("/demo/site/landing")
    def get_landing(request: Request, db: Session = Depends(get_db)):
        return serialize(db, request)

    @app.get("/demo/site/hero")
    def hero_image(db: Session = Depends(get_db)):
        row = db.get(SiteLanding, 1)
        if not row or not row.hero_image_bytes:
            raise HTTPException(404, "hero_image_not_found")
        return Response(content=row.hero_image_bytes,
                        media_type=row.hero_image_type or "image/jpeg",
                        headers={"Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff"})

    @app.put("/demo/manage/site/landing")
    def update_landing(payload: SiteLandingUpdate, request: Request,
                       authorization: str | None = Header(default=None),
                       db: Session = Depends(get_db)):
        account = account_lookup(db, authorization)
        if role_for(db, account) != "global_admin":
            raise HTTPException(403, "global_admin_only")
        if payload.remove_hero_image and payload.hero_image_data_url:
            raise HTTPException(422, "conflicting_hero_image_operations")
        row = db.get(SiteLanding, 1)
        if row is None:
            row = SiteLanding(id=1)
            db.add(row)
        row.headline = payload.headline.strip()
        row.subtitle = payload.subtitle.strip()
        if not row.headline or not row.subtitle:
            raise HTTPException(422, "landing_text_required")
        if payload.hero_image_data_url:
            content_type, image_bytes = main.decode_demo_poster(payload.hero_image_data_url)
            row.hero_image_type, row.hero_image_bytes = content_type, image_bytes
        elif payload.remove_hero_image:
            row.hero_image_type, row.hero_image_bytes = None, None
        db.commit()
        return serialize(db, request)
