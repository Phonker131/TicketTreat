"""Organizer-issued recognition for verified QR event attendance.

Reward catalog and its grants are organizer-scoped. A check-in is mandatory:
no one can mint a badge from an unverified signup or mere booking. This is a
recognition badge, NOT currency, gift-card credit or an automatically
redeemable benefit. All grants are audited and can be revoked without erasing
their history; existing check-in, ticket and loyalty calculations are untouched.
"""
from __future__ import annotations
from datetime import datetime, timezone

from fastapi import Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from db.base import Base
from demo_roles import EventOwnership, account_lookup, ensure_manage, ensure_owner, role_for

class OrganizerReward(Base):
    __tablename__ = "organizer_rewards"
    id = Column(Integer, primary_key=True)
    owner_account_id = Column(Integer, ForeignKey("demo_web_accounts.id"), nullable=False, index=True)
    created_by = Column(Integer, ForeignKey("demo_web_accounts.id"), nullable=False)
    title = Column(String(80), nullable=False)
    description = Column(String(300), nullable=False, default="")
    kind = Column(String(20), nullable=False, default="badge")
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    archived_at = Column(DateTime(timezone=True), nullable=True)

class RewardGrant(Base):
    __tablename__ = "organizer_reward_grants"
    __table_args__ = (UniqueConstraint("reward_id","ticket_id",name="uq_organizer_reward_ticket"),)
    id = Column(Integer, primary_key=True)
    reward_id = Column(Integer, ForeignKey("organizer_rewards.id"), nullable=False, index=True)
    ticket_id = Column(Integer, ForeignKey("demo_tickets.id"), nullable=False, index=True)
    guest_id = Column(Integer, nullable=False, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False, index=True)
    granted_by = Column(Integer, ForeignKey("demo_web_accounts.id"), nullable=False)
    note = Column(String(200), nullable=False, default="")
    granted_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    revoked_by = Column(Integer, ForeignKey("demo_web_accounts.id"), nullable=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True)

class CreateReward(BaseModel):
    event_id: int = Field(gt=0)
    title: str = Field(min_length=3,max_length=80)
    description: str = Field(default="",max_length=300)
    kind: str = Field(default="badge",pattern=r"^(badge|recognition|perk)$")

class GrantReward(BaseModel):
    ticket_id: int = Field(gt=0)
    note: str = Field(default="",max_length=200)

def reward_json(reward):
    return {
        "id":int(reward.id),"owner_account_id":int(reward.owner_account_id),
        "title":reward.title,"description":reward.description,
        "kind":reward.kind,"active":reward.archived_at is None,
        "created_at":reward.created_at.isoformat() if reward.created_at else None,
    }

def grant_json(row,reward,event,guest=None):
    return {"id":int(row.id),"reward_id":int(row.reward_id),
            "title":reward.title,"description":reward.description,"kind":reward.kind,
            "ticket_id":int(row.ticket_id),"event_id":int(row.event_id),
            "event_title":event.title if event else None,
            "event_starts_at":event.starts_at.isoformat() if event and event.starts_at else None,
            "guest_name":" ".join(filter(None,[guest.first_name, guest.last_name])) if guest else None,
            "note":row.note,"granted_at":row.granted_at.isoformat() if row.granted_at else None,
            "revoked_at":row.revoked_at.isoformat() if row.revoked_at else None}

def awards_for_guest(db:Session,guest_id:int,main)->list[dict]:
    # Follow the ticket's current owner after an independently approved
    # account/guest merge. RewardGrant.guest_id retains the original audit
    # provenance; it must not strand the award in a retired guest profile.
    results=(db.query(RewardGrant,OrganizerReward,main.Event)
        .join(OrganizerReward,OrganizerReward.id==RewardGrant.reward_id)
        .join(main.Event,main.Event.id==RewardGrant.event_id)
        .join(main.DemoTicket,main.DemoTicket.id==RewardGrant.ticket_id)
        .filter(main.DemoTicket.guest_id==guest_id,RewardGrant.revoked_at.is_(None))
        .order_by(RewardGrant.granted_at.desc(),RewardGrant.id.desc()).limit(80).all())
    return [grant_json(grant,reward,event) for grant,reward,event in results]

def dashboard(db:Session,account,main)->dict:
    role=ensure_manage(db,account)
    owned=(db.query(EventOwnership.event_id)
           if role=="global_admin" else
           db.query(EventOwnership.event_id).filter(
               EventOwnership.owner_account_id==account.id))
    own_ids=[int(eid) for (eid,) in owned.limit(500).all()]
    if not own_ids:
        return {"events":[],"rewards":[],"attendees":[],"grants":[]}
    owners=dict(db.query(EventOwnership.event_id,EventOwnership.owner_account_id)
                .filter(EventOwnership.event_id.in_(own_ids)).all())
    owner_ids=sorted(set(owners.values()))
    events=db.query(main.Event).filter(main.Event.id.in_(own_ids)).order_by(main.Event.starts_at.desc()).limit(150).all()
    defs=db.query(OrganizerReward).filter(OrganizerReward.owner_account_id.in_(owner_ids)).order_by(
        OrganizerReward.created_at.desc(),OrganizerReward.id.desc()).limit(200).all()
    # Only admitted (checked-in) guests, no email, telephone or QR bearer token.
    trows=(db.query(main.DemoTicket,main.DemoGuest,main.Event)
           .join(main.DemoGuest,main.DemoGuest.id==main.DemoTicket.guest_id)
           .join(main.Event,main.Event.id==main.DemoTicket.event_id)
           .filter(main.DemoTicket.event_id.in_(own_ids),
                   main.DemoTicket.ticket_status=="active",
                   main.DemoTicket.checked_in_at.isnot(None),
                   main.Event.is_cancelled.is_not(True))
           .order_by(main.DemoTicket.checked_in_at.desc(),main.DemoTicket.id.desc())
           .limit(300).all())
    grants=(db.query(RewardGrant,OrganizerReward,main.Event,main.DemoGuest)
            .join(OrganizerReward,OrganizerReward.id==RewardGrant.reward_id)
            .join(main.Event,main.Event.id==RewardGrant.event_id)
            .outerjoin(main.DemoGuest,main.DemoGuest.id==RewardGrant.guest_id)
            .filter(RewardGrant.event_id.in_(own_ids))
            .order_by(RewardGrant.granted_at.desc(),RewardGrant.id.desc())
            .limit(200).all())
    return {
        "events":[{"id":e.id,"title":e.title,
                   "starts_at":e.starts_at.isoformat() if e.starts_at else None,
                   "owner_account_id":owners.get(e.id)}
                  for e in events if e.id in owners],
        "rewards":[reward_json(r) for r in defs],
        "attendees":[{"ticket_id":t.id,"guest_id":guest.id,
                      "guest_name":" ".join(filter(None,[guest.first_name,guest.last_name]))[:200],
                      "event_id":t.event_id,"event_title":event.title,
                      "owner_account_id":owners[t.event_id],
                      "checked_in_at":t.checked_in_at.isoformat()}
                     for t,guest,event in trows],
        "grants":[grant_json(g,r,e,guest) for g,r,e,guest in grants],
    }

def issue(db:Session,account,main,reward_id:int,payload:GrantReward):
    ensure_manage(db,account)
    reward=db.query(OrganizerReward).filter(OrganizerReward.id==reward_id).with_for_update().first()
    if reward is None or reward.archived_at is not None:
        raise HTTPException(404,"reward_not_found")
    ticket=db.query(main.DemoTicket).filter(main.DemoTicket.id==payload.ticket_id).with_for_update().first()
    if ticket is None:
        raise HTTPException(404,"ticket_not_found")
    ensure_owner(db,int(ticket.event_id),account)
    owner=db.get(EventOwnership,ticket.event_id)
    if owner is None or owner.owner_account_id!=reward.owner_account_id:
        raise HTTPException(403,"reward_not_owned_by_event_organizer")
    event=db.get(main.Event,ticket.event_id)
    if event is None or event.is_cancelled:
        raise HTTPException(409,"event_cancelled")
    if ticket.ticket_status!="active" or ticket.checked_in_at is None:
        raise HTTPException(409,"confirmed_checkin_required")
    if db.query(RewardGrant.id).filter(RewardGrant.ticket_id==ticket.id,
                                     RewardGrant.reward_id==reward.id).first():
        raise HTTPException(409,"reward_already_awarded_for_ticket")
    grant=RewardGrant(reward_id=reward.id,ticket_id=ticket.id,
                      guest_id=ticket.guest_id,event_id=ticket.event_id,
                      granted_by=account.id,note=payload.note.strip())
    db.add(grant)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409,"reward_already_awarded_for_ticket") from None
    db.refresh(grant)
    return grant_json(grant,reward,event,db.get(main.DemoGuest,ticket.guest_id))

def install_rewards_api(app,get_db,main):
    def current(authorization:str|None=Header(default=None),db:Session=Depends(get_db)):
        account=account_lookup(db,authorization)
        ensure_manage(db,account)
        return account

    @app.get("/demo/manage/rewards")
    def list_rewards(account=Depends(current),db:Session=Depends(get_db)):
        return dashboard(db,account,main)

    @app.post("/demo/manage/rewards",status_code=201)
    def create_reward(payload:CreateReward,account=Depends(current),db:Session=Depends(get_db)):
        ensure_owner(db,payload.event_id,account)
        owner=db.get(EventOwnership,payload.event_id)
        if owner is None:
            raise HTTPException(409,"organizer_required_for_reward")
        event=db.get(main.Event,payload.event_id)
        if event is None or event.is_cancelled:
            raise HTTPException(409,"event_cancelled")
        title=payload.title.strip()
        if len(title)<3:
            raise HTTPException(422,"reward_title_too_short")
        reward=OrganizerReward(owner_account_id=owner.owner_account_id,
                    created_by=account.id,title=title,
                    description=payload.description.strip(),kind=payload.kind)
        db.add(reward)
        db.commit()
        db.refresh(reward)
        return reward_json(reward)

    @app.post("/demo/manage/rewards/{reward_id}/grants",status_code=201)
    def grant_reward(reward_id:int,payload:GrantReward,
                     account=Depends(current),db:Session=Depends(get_db)):
        return issue(db,account,main,reward_id,payload)

    @app.post("/demo/manage/rewards/grants/{grant_id}/revoke")
    def revoke_grant(grant_id:int,account=Depends(current),db:Session=Depends(get_db)):
        grant=db.query(RewardGrant).filter(RewardGrant.id==grant_id).with_for_update().first()
        if grant is None:
            raise HTTPException(404,"reward_grant_not_found")
        ensure_owner(db,grant.event_id,account)
        owner=db.get(EventOwnership,grant.event_id)
        reward=db.get(OrganizerReward,grant.reward_id)
        if owner is None or reward is None or owner.owner_account_id!=reward.owner_account_id:
            raise HTTPException(403,"reward_not_owned_by_event_organizer")
        if grant.revoked_at is not None:
            raise HTTPException(409,"reward_already_revoked")
        grant.revoked_at=datetime.now(timezone.utc)
        grant.revoked_by=account.id
        db.commit()
        return {"status":"revoked","grant_id":grant.id}
