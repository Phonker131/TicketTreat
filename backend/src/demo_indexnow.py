"""Notify IndexNow of committed public page changes, including scheduled publication."""
import hashlib
import json
import logging
import os
import threading
from datetime import datetime, timezone

import requests
from sqlalchemy import Column, String, or_, text

from db.base import Base
from db.models import Event
from demo_event_access import EventAccess
from demo_geography import DemoEventPlace
from demo_organizer_profiles import OrganizerPublicProfile, is_public
from demo_publication import EventPublication
from demo_roles import EventOwnership

SITE = "https://tickettreat.eu"
KEY = "6bc7c5ecacaeedd435e85192700b27ca"
LOG = logging.getLogger(__name__)


class IndexedPage(Base):
    __tablename__ = "tt_indexnow_pages"
    path = Column(String(100), primary_key=True)
    digest = Column(String(64), nullable=False)


def fingerprint(values):
    return hashlib.sha256(json.dumps(values, default=str).encode()).hexdigest()


def public_pages(db):
    profiles = {p.account_id: p for p in db.query(OrganizerPublicProfile)
                .filter_by(published=True) if is_public(db, p)}
    memberships = {owner: [] for owner in profiles}
    pages = {}
    rows = (db.query(Event, DemoEventPlace, EventOwnership.owner_account_id)
            .outerjoin(DemoEventPlace, DemoEventPlace.event_id == Event.id)
            .outerjoin(EventOwnership, EventOwnership.event_id == Event.id)
            .outerjoin(EventPublication, EventPublication.event_id == Event.id)
            .outerjoin(EventAccess, EventAccess.event_id == Event.id)
            .filter(EventAccess.event_id.is_(None),
                    or_(EventPublication.event_id.is_(None), EventPublication.status == "published",
                        (EventPublication.status == "scheduled") &
                        (EventPublication.publish_at <= datetime.now(timezone.utc))))
            .order_by(Event.id))
    for event, place, owner in rows:
        profile = profiles.get(owner)
        digest = fingerprint([event.title, event.description, event.organizer, event.location,
                              place.city if place else None, place.country_code if place else None,
                              event.starts_at, event.price, event.currency, event.image_url,
                              event.is_cancelled, profile.slug if profile else None])
        pages[f"/events/{event.id}"] = digest
        if profile:
            memberships[owner].append(digest)
    for owner, profile in profiles.items():
        pages[f"/organizers/{profile.slug}"] = fingerprint([profile.updated_at, memberships[owner]])
    return pages


def sync(db):
    # Independent of bot delivery. Only one API replica sends a batch at a time.
    if not db.execute(text("SELECT pg_try_advisory_xact_lock(887469231)")).scalar():
        return
    pages = public_pages(db)
    saved = {p.path: p for p in db.query(IndexedPage)}
    for path in saved.keys() - pages.keys():
        db.delete(saved[path])
    changed = [p for p in pages if p not in saved or saved[p].digest != pages[p]][:1000]
    if changed:
        response = requests.post("https://api.indexnow.org/indexnow", timeout=5, allow_redirects=False,
                                 json={"host": "tickettreat.eu", "key": KEY,
                                       "keyLocation": f"{SITE}/{KEY}.txt",
                                       "urlList": [SITE + p for p in changed]})
        if response.status_code not in (200, 202):
            raise RuntimeError(f"IndexNow returned {response.status_code}")
        for path in changed:
            if path in saved:
                saved[path].digest = pages[path]
            else:
                db.add(IndexedPage(path=path, digest=pages[path]))
        LOG.info("IndexNow accepted %d public URLs (HTTP %d)", len(changed), response.status_code)
    db.commit()


def install_indexnow(app, session_factory):
    stop = threading.Event()

    @app.on_event("startup")
    def start_indexnow():
        if os.getenv("INDEXNOW_ENABLED") != "1" or os.getenv("RAILWAY_ENVIRONMENT_NAME") != "production":
            return

        def run():
            delay = 60
            while not stop.is_set():
                try:
                    with session_factory() as db:
                        sync(db)
                    delay = 60
                except Exception:
                    LOG.exception("IndexNow sync failed")
                    delay = min(delay * 2, 3600)
                stop.wait(delay)

        threading.Thread(target=run, name="indexnow", daemon=True).start()

    @app.on_event("shutdown")
    def stop_indexnow():
        stop.set()
