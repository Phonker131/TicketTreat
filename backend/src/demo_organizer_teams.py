"""Explicit, revocable organizer teams.

An organization is the existing verified organizer account that owns events.
Membership never changes that ownership or confers a global/admin role. An
invitation is targeted at an immutable verified web account and must be
accepted by that account before any event access or Telegram alert is granted.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Session

from db.base import Base

MAX_TEAM_SIZE = 12
INVITE_LIFETIME = timedelta(days=7)


class OrganizerTeamMember(Base):
    __tablename__ = "tt_organizer_team_members"

    owner_account_id = Column(Integer, ForeignKey("demo_web_accounts.id", ondelete="CASCADE"), primary_key=True)
    member_account_id = Column(Integer, ForeignKey("demo_web_accounts.id", ondelete="CASCADE"), primary_key=True)
    status = Column(String(16), nullable=False, default="invited")
    notifications_enabled = Column(Boolean, nullable=False, default=True, server_default="true")
    invited_at = Column(DateTime(timezone=True), nullable=False)
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True)


class OrganizerTeamAudit(Base):
    __tablename__ = "tt_organizer_team_audit"

    id = Column(Integer, primary_key=True)
    owner_account_id = Column(Integer, nullable=False, index=True)
    actor_account_id = Column(Integer, nullable=False)
    member_account_id = Column(Integer, nullable=False)
    action = Column(String(20), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False,
                        default=lambda: datetime.now(timezone.utc))


class InviteMember(BaseModel):
    email: str = Field(min_length=5, max_length=255)


class TeamNotificationChoice(BaseModel):
    enabled: bool


def utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def valid_owner(db: Session, owner_id: int) -> bool:
    """Current verified, non-banned event owner — never an arbitrary account."""
    from demo_accounts import WebAccount
    from demo_roles import role_for
    from demo_account_recovery import email_is_verified
    from demo_account_bans import active_ban

    owner = db.get(WebAccount, owner_id)
    return bool(owner is not None and role_for(db, owner) in {"organizer", "global_admin"}
                and email_is_verified(db, owner.id) and active_ban(db, owner.id) is None)


def member_owners(db: Session, account_id: int) -> set[int]:
    """Only *accepted* memberships whose owner remains eligible."""
    from demo_account_recovery import email_is_verified
    from demo_account_bans import active_ban

    if active_ban(db, account_id) is not None or not email_is_verified(db, account_id):
        return set()
    rows = db.query(OrganizerTeamMember.owner_account_id).filter(
        OrganizerTeamMember.member_account_id == account_id,
        OrganizerTeamMember.status == "active",
    ).all()
    return {int(owner_id) for (owner_id,) in rows if valid_owner(db, int(owner_id))}


def manageable_owner_ids(db: Session, account_id: int) -> set[int]:
    """Includes own events and explicitly delegated organizations."""
    return {int(account_id)} | member_owners(db, account_id)


def team_recipients(db: Session, owner_id: int) -> list[int]:
    """Current confirmed participants in one organization's notification fanout."""
    if not valid_owner(db, owner_id):
        return []
    result = [int(owner_id)]
    members = db.query(OrganizerTeamMember).filter(
        OrganizerTeamMember.owner_account_id == owner_id,
        OrganizerTeamMember.status == "active",
        OrganizerTeamMember.notifications_enabled.is_(True),
    ).limit(MAX_TEAM_SIZE).all()
    for row in members:
        if owner_id in member_owners(db, row.member_account_id):
            result.append(int(row.member_account_id))
    return result


def resolve_event_owner(db: Session, account, requested_id: int | None) -> int:
    """Explicitly choose an organization; never transfer event ownership."""
    from demo_roles import role_for

    own_role = role_for(db, account)
    permitted = member_owners(db, account.id)
    if requested_id is None:
        if own_role in {"organizer", "global_admin"}:
            return account.id
        if len(permitted) == 1:
            return next(iter(permitted))
        raise HTTPException(422, "choose_organization_to_create_event")
    if requested_id == account.id and own_role in {"organizer", "global_admin"}:
        return account.id
    if requested_id in permitted:
        return requested_id
    raise HTTPException(403, "organization_not_permitted")


def install_organizer_teams_api(app, get_db):
    from demo_accounts import WebAccount, normalize_email
    from demo_roles import account_lookup, role_for
    from demo_account_recovery import email_is_verified
    from demo_account_bans import active_ban

    def signed_in(authorization: str | None = Header(default=None),
                  db: Session = Depends(get_db)):
        return account_lookup(db, authorization)

    def owned_by(db, owner):
        if role_for(db, owner) not in {"organizer", "global_admin"} or not valid_owner(db, owner.id):
            raise HTTPException(403, "organizer_role_required")

    def record(db, owner_id, actor_id, member_id, action):
        db.add(OrganizerTeamAudit(owner_account_id=owner_id,
            actor_account_id=actor_id, member_account_id=member_id, action=action))

    @app.get("/demo/manage/teams")
    def list_teams(account=Depends(signed_in), db: Session = Depends(get_db)):
        from demo_organizer_profiles import OrganizerPublicProfile

        my_role = role_for(db, account)
        teams = []
        memberships = db.query(OrganizerTeamMember).filter(
            OrganizerTeamMember.member_account_id == account.id,
            OrganizerTeamMember.status.in_(["invited", "active"])).all()
        for member in memberships:
            owner = db.get(WebAccount, member.owner_account_id)
            if owner is None or not valid_owner(db, owner.id):
                continue
            if member.status == "invited" and utc(member.invited_at) + INVITE_LIFETIME <= datetime.now(timezone.utc):
                continue
            profile = db.get(OrganizerPublicProfile, owner.id)
            teams.append({"owner_account_id": owner.id,
                "organization": profile.display_name if profile else f"Organizer #{owner.id}",
                "status": member.status, "notifications_enabled": bool(member.notifications_enabled),
                "expires_at": (utc(member.invited_at)+INVITE_LIFETIME).isoformat() if member.status == "invited" else None})
        members = []
        if my_role in {"organizer", "global_admin"} and valid_owner(db, account.id):
            rows = db.query(OrganizerTeamMember).filter(
                OrganizerTeamMember.owner_account_id == account.id,
                OrganizerTeamMember.status.in_(["invited", "active"])).all()
            for row in rows:
                person = db.get(WebAccount, row.member_account_id)
                if person is None:
                    continue
                members.append({"account_id": person.id, "email": person.email,
                    "name": (person.first_name+" "+person.last_name).strip(),
                    "status": row.status, "notifications_enabled": bool(row.notifications_enabled)})
        return {"account_id": account.id, "can_invite": my_role in {"organizer", "global_admin"} and valid_owner(db, account.id),
                "members": members, "teams": teams}

    @app.post("/demo/manage/teams/invitations", status_code=201)
    def invite(payload: InviteMember, account=Depends(signed_in), db: Session = Depends(get_db)):
        owned_by(db, account)
        # Serialize invitations by owner; concurrent requests must not bypass
        # the per-organization membership cap.
        db.query(WebAccount).filter(WebAccount.id == account.id).with_for_update().first()
        target = db.query(WebAccount).filter(WebAccount.email == normalize_email(payload.email)).first()
        if (target is None or target.id == account.id or not email_is_verified(db, target.id)
                or active_ban(db, target.id) is not None):
            raise HTTPException(422, "verified_member_account_required")
        now = datetime.now(timezone.utc)
        # Expired invitations no longer count against the cap and can be
        # reissued without requiring a manual revocation.
        invites = db.query(OrganizerTeamMember).filter(
            OrganizerTeamMember.owner_account_id == account.id,
            OrganizerTeamMember.status == "invited").all()
        for old in invites:
            if utc(old.invited_at) + INVITE_LIFETIME <= now:
                old.status = "revoked"
                old.revoked_at = now
        db.flush()
        row = db.query(OrganizerTeamMember).filter(
            OrganizerTeamMember.owner_account_id == account.id,
            OrganizerTeamMember.member_account_id == target.id).with_for_update().first()
        if row is not None and row.status in {"invited", "active"}:
            raise HTTPException(409, "member_already_invited_or_active")
        active_count = db.query(func.count(OrganizerTeamMember.member_account_id)).filter(
            OrganizerTeamMember.owner_account_id == account.id,
            OrganizerTeamMember.status.in_(["invited", "active"])).scalar() or 0
        if active_count >= MAX_TEAM_SIZE:
            raise HTTPException(409, "organization_team_full")
        if row is None:
            db.add(OrganizerTeamMember(owner_account_id=account.id, member_account_id=target.id,
                status="invited", invited_at=now))
        else:
            row.status = "invited"
            row.invited_at = now
            row.accepted_at = None
            row.revoked_at = None
            row.notifications_enabled = True
        record(db, account.id, account.id, target.id, "invite")
        db.commit()
        return {"status": "invited", "account_id": target.id}

    @app.post("/demo/manage/teams/invitations/{owner_id}/accept")
    def accept(owner_id: int, account=Depends(signed_in), db: Session = Depends(get_db)):
        row = db.query(OrganizerTeamMember).filter(
            OrganizerTeamMember.owner_account_id == owner_id,
            OrganizerTeamMember.member_account_id == account.id).with_for_update().first()
        if row is None or row.status != "invited":
            raise HTTPException(404, "team_invitation_not_found")
        if utc(row.invited_at)+INVITE_LIFETIME <= datetime.now(timezone.utc):
            raise HTTPException(410, "team_invitation_expired")
        if not valid_owner(db, owner_id) or not email_is_verified(db, account.id):
            raise HTTPException(403, "team_membership_not_permitted")
        row.status = "active"
        row.accepted_at = datetime.now(timezone.utc)
        record(db, owner_id, account.id, account.id, "accept")
        db.commit()
        return {"status": "active"}

    @app.post("/demo/manage/teams/{owner_id}/leave")
    def leave(owner_id: int, account=Depends(signed_in), db: Session = Depends(get_db)):
        row = db.query(OrganizerTeamMember).filter(
            OrganizerTeamMember.owner_account_id == owner_id,
            OrganizerTeamMember.member_account_id == account.id).with_for_update().first()
        if row is None or row.status not in {"invited", "active"}:
            raise HTTPException(404, "team_membership_not_found")
        row.status = "revoked"
        row.revoked_at = datetime.now(timezone.utc)
        record(db, owner_id, account.id, account.id, "leave")
        db.commit()
        return {"status": "revoked"}

    @app.delete("/demo/manage/teams/members/{member_id}")
    def revoke(member_id: int, account=Depends(signed_in), db: Session = Depends(get_db)):
        owned_by(db, account)
        row = db.query(OrganizerTeamMember).filter(
            OrganizerTeamMember.owner_account_id == account.id,
            OrganizerTeamMember.member_account_id == member_id).with_for_update().first()
        if row is None or row.status not in {"invited", "active"}:
            raise HTTPException(404, "team_membership_not_found")
        row.status = "revoked"
        row.revoked_at = datetime.now(timezone.utc)
        record(db, account.id, account.id, member_id, "revoke")
        db.commit()
        return {"status": "revoked"}

    @app.put("/demo/manage/teams/{owner_id}/notifications")
    def notifications(owner_id: int, payload: TeamNotificationChoice,
                      account=Depends(signed_in), db: Session = Depends(get_db)):
        row = db.query(OrganizerTeamMember).filter(
            OrganizerTeamMember.owner_account_id == owner_id,
            OrganizerTeamMember.member_account_id == account.id).with_for_update().first()
        if row is None or row.status != "active" or not valid_owner(db, owner_id):
            raise HTTPException(404, "team_membership_not_found")
        row.notifications_enabled = payload.enabled
        record(db, owner_id, account.id, account.id, "notifications")
        db.commit()
        return {"notifications_enabled": bool(row.notifications_enabled)}
