"""Organizer-scoped marketing campaigns, never fabricated attendance or social verification.

Account and ticket timestamps qualify registration campaigns automatically. Instagram
claims are pending until a staff member checks them outside TicketTreat. Promotional
VIP is a separate organizer perk, NOT 12 check-ins or a payment/queue entitlement.
"""
from __future__ import annotations

from datetime import datetime, timezone
from urllib.parse import urlsplit

from fastapi import Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from db.base import Base
from demo_roles import EventOwnership, account_lookup, ensure_manage, ensure_owner, role_for

TRIGGERS = {"account_signup", "event_booking", "instagram_follow"}
REWARDS = {"vip_perk", "badge", "other"}
STATES = {"draft", "active", "paused"}


def utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(value: datetime | None) -> str | None:
    return utc(value).isoformat() if value is not None else None


class Promotion(Base):
    __tablename__ = "demo_promo_campaigns"
    __table_args__ = (
        CheckConstraint("trigger IN ('account_signup','event_booking','instagram_follow')",name="ck_promo_trigger"),
        CheckConstraint("reward_kind IN ('vip_perk','badge','other')",name="ck_promo_reward"),
        CheckConstraint("status IN ('draft','active','paused')",name="ck_promo_status"),
        CheckConstraint("ends_at > starts_at AND ends_at <= starts_at + interval '31 days'",name="ck_promo_window"),
        CheckConstraint("benefit_expires_at IS NULL OR benefit_expires_at > ends_at",name="ck_promo_benefit_expiry"),
        CheckConstraint("(trigger='event_booking' AND event_id IS NOT NULL) OR (trigger<>'event_booking' AND event_id IS NULL)",name="ck_promo_event_scope"),
    )

    id = Column(Integer, primary_key=True)
    owner_account_id = Column(Integer, ForeignKey("demo_web_accounts.id"), nullable=False, index=True)
    anchor_event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=True)
    created_by = Column(Integer, ForeignKey("demo_web_accounts.id"), nullable=False)
    title = Column(String(100), nullable=False)
    description = Column(Text, nullable=False, default="")
    trigger = Column(String(24), nullable=False)
    reward_kind = Column(String(24), nullable=False, default="vip_perk")
    reward_title = Column(String(100), nullable=False)
    reward_details = Column(String(500), nullable=False, default="")
    instagram_url = Column(String(200), nullable=False, default="")
    starts_at = Column(DateTime(timezone=True), nullable=False)
    ends_at = Column(DateTime(timezone=True), nullable=False)
    benefit_expires_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(12), nullable=False, default="draft")
    created_at = Column(DateTime(timezone=True), nullable=False, default=now_utc)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=now_utc)


class PromotionClaim(Base):
    __tablename__ = "demo_promo_claims"
    __table_args__ = (
        UniqueConstraint("campaign_id", "account_id", name="uq_promo_claim_account"),
        CheckConstraint("status IN ('pending','approved','rejected')",name="ck_promo_claim_status"),
        CheckConstraint("(status='pending' AND reviewed_at IS NULL AND reviewed_by IS NULL) OR (status<>'pending' AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL)",name="ck_promo_claim_review"),
    )

    id = Column(Integer, primary_key=True)
    campaign_id = Column(Integer, ForeignKey("demo_promo_campaigns.id"), nullable=False, index=True)
    account_id = Column(Integer, ForeignKey("demo_web_accounts.id"), nullable=False, index=True)
    instagram_username = Column(String(64), nullable=False)
    status = Column(String(12), nullable=False, default="pending")
    created_at = Column(DateTime(timezone=True), nullable=False, default=now_utc)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    reviewed_by = Column(Integer, ForeignKey("demo_web_accounts.id"), nullable=True)


class CreatePromotion(BaseModel):
    anchor_event_id: int = Field(gt=0)
    event_id: int | None = Field(default=None, gt=0)
    title: str = Field(min_length=3, max_length=100)
    description: str = Field(default="", max_length=1500)
    trigger: str
    reward_kind: str = "vip_perk"
    reward_title: str = Field(min_length=3, max_length=100)
    reward_details: str = Field(default="", max_length=500)
    instagram_url: str = Field(default="", max_length=200)
    starts_at: datetime
    ends_at: datetime
    benefit_expires_at: datetime | None = None


class ChangeState(BaseModel):
    status: str


class InstagramClaim(BaseModel):
    instagram_username: str = Field(min_length=2, max_length=64)


class ReviewClaim(BaseModel):
    approve: bool


def validate(payload: CreatePromotion, db: Session, account, main):
    if payload.trigger not in TRIGGERS or payload.reward_kind not in REWARDS:
        raise HTTPException(422, "invalid_promotion_type")
    title, reward_title = payload.title.strip(), payload.reward_title.strip()
    if len(title) < 3 or len(reward_title) < 3:
        raise HTTPException(422, "promotion_title_too_short")
    if payload.reward_kind == "vip_perk" and not payload.reward_details.strip():
        raise HTTPException(422, "promotion_vip_benefit_terms_required")
    start, end, expires = utc(payload.starts_at), utc(payload.ends_at), utc(payload.benefit_expires_at)
    if start is None or end is None or (end - start).total_seconds() <= 0 or (end - start).total_seconds() > 31 * 86400:
        raise HTTPException(422, "promotion_window_invalid")
    if expires is not None and expires <= end:
        raise HTTPException(422, "benefit_expiry_must_follow_campaign")
    if payload.trigger == "event_booking" and payload.event_id is None:
        raise HTTPException(422, "promotion_event_required")
    if payload.trigger != "event_booking" and payload.event_id is not None:
        raise HTTPException(422, "promotion_event_not_applicable")
    ensure_owner(db, payload.anchor_event_id, account)
    anchor = db.get(main.Event, payload.anchor_event_id)
    owner = db.get(EventOwnership, payload.anchor_event_id)
    if anchor is None or owner is None or anchor.is_cancelled:
        raise HTTPException(409, "promotion_organizer_event_required")
    if payload.event_id is not None:
        ensure_owner(db, payload.event_id, account)
        chosen = db.get(EventOwnership, payload.event_id)
        event = db.get(main.Event, payload.event_id)
        if chosen is None or event is None or event.is_cancelled or chosen.owner_account_id != owner.owner_account_id:
            raise HTTPException(403, "promotion_event_organizer_mismatch")
    url = payload.instagram_url.strip()
    if payload.trigger == "instagram_follow":
        parsed = urlsplit(url)
        if parsed.scheme != "https" or parsed.hostname not in {"instagram.com", "www.instagram.com"} or not parsed.path.strip("/"):
            raise HTTPException(422, "promotion_instagram_url_invalid")
        if parsed.username or parsed.password or parsed.port or parsed.query or parsed.fragment:
            raise HTTPException(422, "promotion_instagram_url_invalid")
    elif url:
        raise HTTPException(422, "promotion_instagram_url_not_applicable")
    return {"owner_account_id": int(owner.owner_account_id), "anchor_event_id": payload.anchor_event_id,
            "event_id": payload.event_id, "title": title, "description": payload.description.strip(),
            "trigger": payload.trigger, "reward_kind": payload.reward_kind,
            "reward_title": reward_title, "reward_details": payload.reward_details.strip(),
            "instagram_url": url, "starts_at": start, "ends_at": end, "benefit_expires_at": expires}


def public_data(row: Promotion, db: Session, main) -> dict:
    event = db.get(main.Event, row.anchor_event_id)
    return {"id": row.id, "organizer_id": row.owner_account_id,
            "organizer_name": (event.organizer if event else None) or "TicketTreat organizer",
            "title": row.title, "description": row.description, "trigger": row.trigger,
            "event_id": row.event_id, "reward_kind": row.reward_kind,
            "reward_title": row.reward_title, "reward_details": row.reward_details,
            "instagram_url": row.instagram_url, "starts_at": iso(row.starts_at),
            "ends_at": iso(row.ends_at), "benefit_expires_at": iso(row.benefit_expires_at)}


def status_data(row: Promotion, db: Session, main) -> dict:
    result = public_data(row, db, main)
    current = now_utc()
    result.update({"status": row.status, "is_live": row.status == "active"
                   and utc(row.starts_at) <= current < utc(row.ends_at),
                   "created_at": iso(row.created_at), "updated_at": iso(row.updated_at),
                   "created_by": row.created_by, "anchor_event_id": row.anchor_event_id})
    return result


def check_automatic(db: Session, row: Promotion, account, main) -> bool:
    """Server-side timestamps, no client-supplied assertions or fake attendance."""
    start, end = utc(row.starts_at), utc(row.ends_at)
    if row.trigger == "account_signup":
        return start <= utc(account.created_at) < end
    if row.trigger == "event_booking":
        return db.query(main.DemoTicket.id).filter(
            main.DemoTicket.event_id == row.event_id,
            main.DemoTicket.guest_id == account.guest_id,
            main.DemoTicket.ticket_status == "active",
            main.DemoTicket.created_at >= start,
            main.DemoTicket.created_at < end).first() is not None
    return False


def claim_status(db: Session, row: Promotion, account, main) -> str:
    if row.trigger != "instagram_follow":
        return "earned" if check_automatic(db, row, account, main) else "not_eligible"
    claim = db.query(PromotionClaim).filter(
        PromotionClaim.campaign_id == row.id,
        PromotionClaim.account_id == account.id).first()
    return claim.status if claim else "not_eligible"


def benefits_for_guest(db: Session, guest_id: int, main) -> list[dict]:
    from demo_accounts import WebAccount
    account = db.query(WebAccount).filter(WebAccount.guest_id == guest_id).first()
    if account is None:
        return []
    timestamp = now_utc()
    campaigns = db.query(Promotion).filter(Promotion.status == "active").order_by(Promotion.id.desc()).limit(150).all()
    return [{**public_data(row, db, main), "source": "promotion"}
            for row in campaigns
            if (row.benefit_expires_at is None or utc(row.benefit_expires_at) > timestamp)
            and claim_status(db, row, account, main) in {"earned", "approved"}]


def eligible_count(db: Session, row: Promotion, main) -> int:
    from demo_accounts import WebAccount
    if row.trigger == "account_signup":
        return int(db.query(func.count(WebAccount.id)).filter(
            WebAccount.created_at >= row.starts_at, WebAccount.created_at < row.ends_at).scalar() or 0)
    if row.trigger == "event_booking":
        return int(db.query(func.count(func.distinct(WebAccount.id))).join(
            main.DemoTicket, main.DemoTicket.guest_id == WebAccount.guest_id).filter(
            main.DemoTicket.event_id == row.event_id,
            main.DemoTicket.ticket_status == "active",
            main.DemoTicket.created_at >= row.starts_at,
            main.DemoTicket.created_at < row.ends_at).scalar() or 0)
    return 0


def install_promotions_api(app, get_db, main):
    from demo_accounts import WebAccount

    def signed_in(authorization: str | None = Header(default=None),
                  db: Session = Depends(get_db)):
        return account_lookup(db, authorization)

    def managing(account=Depends(signed_in), db: Session = Depends(get_db)):
        ensure_manage(db, account)
        return account

    def owned_campaign(db, campaign_id, account):
        row = db.get(Promotion, campaign_id)
        if row is None:
            raise HTTPException(404, "promotion_not_found")
        from demo_organizer_teams import manageable_owner_ids
        if (role_for(db, account) != "global_admin"
                and row.owner_account_id not in manageable_owner_ids(db, account.id)):
            raise HTTPException(403, "promotion_not_owned")
        return row

    @app.get("/demo/manage/promotions")
    def dashboard(account=Depends(managing), db: Session = Depends(get_db)):
        role = role_for(db, account)
        event_query = db.query(main.Event, EventOwnership).join(
            EventOwnership, EventOwnership.event_id == main.Event.id)
        if role != "global_admin":
            from demo_organizer_teams import manageable_owner_ids
            event_query = event_query.filter(
                EventOwnership.owner_account_id.in_(manageable_owner_ids(db, account.id)))
        event_rows = event_query.order_by(main.Event.id.desc()).limit(250).all()
        q = db.query(Promotion)
        if role != "global_admin":
            from demo_organizer_teams import manageable_owner_ids
            q = q.filter(Promotion.owner_account_id.in_(manageable_owner_ids(db, account.id)))
        campaigns = q.order_by(Promotion.created_at.desc(), Promotion.id.desc()).limit(200).all()
        results = []
        for row in campaigns:
            item = status_data(row, db, main)
            claims = db.query(PromotionClaim.status, func.count(PromotionClaim.id)).filter(
                PromotionClaim.campaign_id == row.id).group_by(PromotionClaim.status).all()
            item["claims"] = dict(claims)
            item["eligible_count"] = eligible_count(db, row, main)
            results.append(item)
        return {"events": [{"id": e.id, "title": e.title,
                             "starts_at": iso(e.starts_at),
                             "organizer_name": e.organizer or "TicketTreat organizer",
                             "owner_account_id": owner.owner_account_id}
                            for e, owner in event_rows], "campaigns": results}

    @app.post("/demo/manage/promotions", status_code=201)
    def create(payload: CreatePromotion, account=Depends(managing),
               db: Session = Depends(get_db)):
        attrs = validate(payload, db, account, main)
        row = Promotion(**attrs, created_by=account.id, status="draft")
        db.add(row)
        db.commit()
        db.refresh(row)
        return status_data(row, db, main)

    @app.put("/demo/manage/promotions/{campaign_id}")
    def edit(campaign_id: int, payload: CreatePromotion,
             account=Depends(managing), db: Session = Depends(get_db)):
        row = owned_campaign(db, campaign_id, account)
        if row.status != "draft":
            raise HTTPException(409, "promotion_edit_draft_only")
        attrs = validate(payload, db, account, main)
        for key, value in attrs.items():
            setattr(row, key, value)
        row.updated_at = now_utc()
        db.commit()
        return status_data(row, db, main)

    @app.post("/demo/manage/promotions/{campaign_id}/status")
    def change_status(campaign_id: int, payload: ChangeState,
                      account=Depends(managing), db: Session = Depends(get_db)):
        row = owned_campaign(db, campaign_id, account)
        if payload.status not in STATES:
            raise HTTPException(422, "promotion_invalid_status")
        if payload.status == "draft" and row.status != "draft":
            raise HTTPException(409, "published_promotion_cannot_revert_to_draft")
        if payload.status == "active" and utc(row.ends_at) <= now_utc():
            raise HTTPException(409, "promotion_window_already_ended")
        row.status = payload.status
        row.updated_at = now_utc()
        db.commit()
        return status_data(row, db, main)

    @app.get("/demo/manage/promotions/{campaign_id}/claims")
    def review_queue(campaign_id: int, account=Depends(managing),
                     db: Session = Depends(get_db)):
        row = owned_campaign(db, campaign_id, account)
        records = db.query(PromotionClaim, WebAccount).join(
            WebAccount, WebAccount.id == PromotionClaim.account_id).filter(
            PromotionClaim.campaign_id == row.id).order_by(
            PromotionClaim.created_at.desc(), PromotionClaim.id.desc()).limit(200).all()
        return {"claims": [{"id": claim.id, "campaign_id": row.id,
                            "name": " ".join(filter(None, (person.first_name, person.last_name))),
                            "instagram_username": claim.instagram_username,
                            "status": claim.status, "created_at": iso(claim.created_at),
                            "reviewed_at": iso(claim.reviewed_at)} for claim, person in records]}

    @app.post("/demo/manage/promotions/{campaign_id}/claims/{claim_id}/review")
    def review(campaign_id: int, claim_id: int, payload: ReviewClaim,
               account=Depends(managing), db: Session = Depends(get_db)):
        row = owned_campaign(db, campaign_id, account)
        claim = db.query(PromotionClaim).filter(
            PromotionClaim.id == claim_id, PromotionClaim.campaign_id == row.id
        ).with_for_update().first()
        if claim is None:
            raise HTTPException(404, "promotion_claim_not_found")
        if row.status != "active":
            raise HTTPException(409, "promotion_not_active")
        if claim.status != "pending":
            raise HTTPException(409, "promotion_claim_already_reviewed")
        claim.status = "approved" if payload.approve else "rejected"
        claim.reviewed_at = now_utc()
        claim.reviewed_by = account.id
        db.commit()
        return {"id": claim.id, "status": claim.status}

    @app.get("/demo/promotions")
    def public_campaigns(db: Session = Depends(get_db)):
        instant = now_utc()
        rows = db.query(Promotion).filter(
            Promotion.status == "active",
            Promotion.starts_at <= instant,
            Promotion.ends_at > instant).order_by(Promotion.ends_at.asc()).limit(80).all()
        return {"campaigns": [public_data(row, db, main) for row in rows]}

    @app.get("/demo/me/promotions")
    def my_campaigns(account=Depends(signed_in), db: Session = Depends(get_db)):
        instant = now_utc()
        rows = db.query(Promotion).filter(Promotion.status == "active").order_by(
            Promotion.id.desc()).limit(150).all()
        results = []
        for row in rows:
            state = claim_status(db, row, account, main)
            if (utc(row.starts_at) <= instant < utc(row.ends_at)
                    or state in {"earned", "approved", "pending"}):
                results.append({**public_data(row, db, main), "participation": state,
                                "is_live": utc(row.starts_at) <= instant < utc(row.ends_at)})
        return {"campaigns": results}

    @app.post("/demo/me/promotions/{campaign_id}/claim", status_code=201)
    def claim(campaign_id: int, payload: InstagramClaim,
              account=Depends(signed_in), db: Session = Depends(get_db)):
        row = db.get(Promotion, campaign_id)
        current = now_utc()
        if row is None or row.status != "active" or row.trigger != "instagram_follow" or not (
                utc(row.starts_at) <= current < utc(row.ends_at)):
            raise HTTPException(409, "promotion_claim_window_closed")
        username = payload.instagram_username.strip().lstrip("@")
        if not (2 <= len(username) <= 30 and all(
                ch.isascii() and (ch.isalnum() or ch in "._") for ch in username)):
            raise HTTPException(422, "instagram_username_invalid")
        db.add(PromotionClaim(campaign_id=row.id, account_id=account.id,
                              instagram_username=username, status="pending"))
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(409, "promotion_already_claimed") from None
        return {"status": "pending"}
