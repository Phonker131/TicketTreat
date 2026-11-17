"""Organizer-wide loyalty benefit settings (never a per-event award).

The thresholds and entitlement calculations remain server-owned. Editors may
change bilingual benefit copy and opt out of the already-operational waitlist
priority, but cannot turn on unimplemented booking or companion privileges.
"""
from __future__ import annotations

from fastapi import Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import Boolean, CheckConstraint, Column, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Session

from db.base import Base
from demo_roles import EventOwnership, account_lookup, ensure_manage, role_for, audit


LEVELS = (
    ("newcomer", 0, "basic_access", True, "Tickets and reminders", "Vstupenky a připomínky"),
    ("regular", 3, "priority_waitlist", True, "Priority on the waitlist", "Přednost na čekací listině"),
    ("insider", 6, "early_access", False, "Early registration (coming soon)", "Dřívější registrace (připravujeme)"),
    ("vip", 12, "vip_companion", False, "Companion benefit (coming soon)", "Výhoda pro doprovod (připravujeme)"),
)
LEVEL_BY_TIER = {tier: (visits, key, operational, en, cs) for tier, visits, key, operational, en, cs in LEVELS}


class OrganizerLoyaltyBenefit(Base):
    __tablename__ = "organizer_loyalty_benefits"
    __table_args__ = (
        UniqueConstraint("owner_account_id", "tier", name="uq_organizer_loyalty_tier"),
        CheckConstraint("tier IN ('newcomer','regular','insider','vip')", name="ck_organizer_loyalty_tier"),
    )
    id = Column(Integer, primary_key=True)
    owner_account_id = Column(Integer, ForeignKey("demo_web_accounts.id"), nullable=False, index=True)
    tier = Column(String(16), nullable=False)
    label_en = Column(String(100), nullable=False)
    label_cs = Column(String(100), nullable=False)
    description_en = Column(String(300), nullable=False, default="")
    description_cs = Column(String(300), nullable=False, default="")
    priority_enabled = Column(Boolean, nullable=False, default=True)


class TierBenefitUpdate(BaseModel):
    label_en: str = Field(min_length=3, max_length=100)
    label_cs: str = Field(min_length=3, max_length=100)
    description_en: str = Field(default="", max_length=300)
    description_cs: str = Field(default="", max_length=300)
    # The only operational reward in the current pilot is queue priority.
    priority_enabled: bool | None = None


def benefit_payload(tier: str, row: OrganizerLoyaltyBenefit | None) -> dict:
    visits, key, operational, default_en, default_cs = LEVEL_BY_TIER[tier]
    active = (row.priority_enabled if row else True) if tier == "regular" else operational
    return {
        "tier": tier, "required_visits": visits, "key": key,
        "label_en": row.label_en if row else default_en,
        "label_cs": row.label_cs if row else default_cs,
        "description_en": row.description_en if row else "",
        "description_cs": row.description_cs if row else "",
        "operational": operational,
        "enabled": bool(active and operational),
        "editable_enabled": tier == "regular",
    }


def benefits_for_organizer(db: Session, owner_id: int) -> list[dict]:
    rows = db.query(OrganizerLoyaltyBenefit).filter(
        OrganizerLoyaltyBenefit.owner_account_id == owner_id).all()
    by_tier = {row.tier: row for row in rows}
    return [benefit_payload(tier, by_tier.get(tier)) for tier, *_ in LEVELS]


def priority_enabled(db: Session, owner_id: int) -> bool:
    row = db.query(OrganizerLoyaltyBenefit).filter(
        OrganizerLoyaltyBenefit.owner_account_id == owner_id,
        OrganizerLoyaltyBenefit.tier == "regular").first()
    return row is None or bool(row.priority_enabled)


def install_loyalty_benefits_api(app, get_db, main):
    def current(authorization: str | None = Header(default=None), db: Session = Depends(get_db)):
        account = account_lookup(db, authorization)
        ensure_manage(db, account)
        return account

    def scoped_owners(db: Session, account):
        owners_query = db.query(EventOwnership.event_id, EventOwnership.owner_account_id)
        if role_for(db, account) != "global_admin":
            owners_query = owners_query.filter(EventOwnership.owner_account_id == account.id)
        rows = owners_query.order_by(EventOwnership.event_id.desc()).limit(1000).all()
        owner_names = {}
        for event_id, owner_id in rows:
            if owner_id in owner_names:
                continue
            event = db.get(main.Event, event_id)
            owner_names[int(owner_id)] = (str(event.organizer or "").strip() if event else "") or f"Organizer #{owner_id}"
        return owner_names

    @app.get("/demo/manage/loyalty/tiers")
    def list_tiers(account = Depends(current), db: Session = Depends(get_db)):
        owners = scoped_owners(db, account)
        return {"organizers": [
            {"owner_account_id": owner_id, "name": name,
             "tiers": benefits_for_organizer(db, owner_id)}
            for owner_id, name in sorted(owners.items())
        ]}

    @app.put("/demo/manage/loyalty/tiers/{owner_id}/{tier}")
    def update_tier(owner_id: int, tier: str, payload: TierBenefitUpdate,
                    account = Depends(current), db: Session = Depends(get_db)):
        if tier not in LEVEL_BY_TIER:
            raise HTTPException(404, "loyalty_tier_not_found")
        owners = scoped_owners(db, account)
        if owner_id not in owners:
            raise HTTPException(403, "organizer_not_owned")
        en, cs = payload.label_en.strip(), payload.label_cs.strip()
        if len(en) < 3 or len(cs) < 3:
            raise HTTPException(422, "loyalty_reward_label_too_short")
        if tier != "regular" and payload.priority_enabled is not None:
            raise HTTPException(422, "benefit_not_operational")
        row = (db.query(OrganizerLoyaltyBenefit).filter(
            OrganizerLoyaltyBenefit.owner_account_id == owner_id,
            OrganizerLoyaltyBenefit.tier == tier).with_for_update().first())
        if row is None:
            row = OrganizerLoyaltyBenefit(owner_account_id=owner_id, tier=tier,
                                           label_en=en, label_cs=cs)
            db.add(row)
        else:
            row.label_en, row.label_cs = en, cs
        row.description_en, row.description_cs = payload.description_en.strip(), payload.description_cs.strip()
        if tier == "regular" and payload.priority_enabled is not None:
            row.priority_enabled = payload.priority_enabled
        db.flush()
        event_id = db.query(EventOwnership.event_id).filter(
            EventOwnership.owner_account_id == owner_id).order_by(EventOwnership.event_id).first()
        audit(db, int(event_id[0]), account.id, "edit_loyalty_tier",
              f"owner={owner_id} tier={tier} priority={row.priority_enabled}")
        db.commit()
        return benefit_payload(tier, row)
