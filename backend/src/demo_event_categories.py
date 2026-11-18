"""Platform-wide discovery categories. Archiving preserves event history."""
from uuid import uuid4

from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import Boolean, Column, String
from sqlalchemy.orm import Session

from db.base import Base


DEFAULTS = {
    "meet": ("Meet people", "Seznámit se"),
    "friends": ("With friends", "S přáteli"),
    "listen": ("Listen", "Poslechnout"),
    "dance": ("Dance", "Zatančit"),
}


class EventCategory(Base):
    __tablename__ = "event_categories"
    key = Column(String(40), primary_key=True)
    en = Column(String(80), nullable=False)
    cs = Column(String(80), nullable=False)
    active = Column(Boolean, nullable=False, default=True)


class CategoryNames(BaseModel):
    en: str = Field(min_length=1, max_length=80)
    cs: str = Field(min_length=1, max_length=80)


class CategoryStatus(BaseModel):
    active: bool


def catalog(db):
    categories = {key: dict(key=key, en=en, cs=cs, active=True)
                  for key, (en, cs) in DEFAULTS.items()}
    for row in db.query(EventCategory).order_by(EventCategory.en, EventCategory.key):
        categories[row.key] = dict(key=row.key, en=row.en, cs=row.cs, active=row.active)
    return categories


def install_categories(app, get_db, admin_account):
    @app.get("/demo/event-categories")
    def list_categories(db: Session = Depends(get_db)):
        return list(catalog(db).values())

    @app.post("/demo/manage/event-categories", status_code=201)
    def add_category(names: CategoryNames, admin=Depends(admin_account), db: Session = Depends(get_db)):
        en, cs = names.en.strip(), names.cs.strip()
        if not en or not cs:
            raise HTTPException(422, "category_name_required")
        db.add(EventCategory(key="cat_" + uuid4().hex, en=en, cs=cs))
        db.commit()
        return list(catalog(db).values())

    @app.put("/demo/manage/event-categories/{key}")
    def set_status(key: str, status: CategoryStatus, admin=Depends(admin_account), db: Session = Depends(get_db)):
        row = db.get(EventCategory, key)
        if row is None:
            if key not in DEFAULTS:
                raise HTTPException(404, "category_not_found")
            en, cs = DEFAULTS[key]
            row = EventCategory(key=key, en=en, cs=cs)
            db.add(row)
        row.active = status.active
        db.commit()
        return list(catalog(db).values())

    @app.patch("/demo/manage/event-categories/{key}")
    def rename_category(key: str, names: CategoryNames, admin=Depends(admin_account), db: Session = Depends(get_db)):
        en, cs = names.en.strip(), names.cs.strip()
        if not en or not cs:
            raise HTTPException(422, "category_name_required")
        row = db.get(EventCategory, key)
        if row is None:
            if key not in DEFAULTS:
                raise HTTPException(404, "category_not_found")
            old_en, old_cs = DEFAULTS[key]
            row = EventCategory(key=key, en=old_en, cs=old_cs, active=True)
            db.add(row)
        row.en, row.cs = en, cs
        db.commit()
        return list(catalog(db).values())
