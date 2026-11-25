"""Audited bans for canonical TicketTreat accounts.

Most bans follow an append-only ban/unban action stream. Severe incidents can
also be recorded in a separate, non-expiring permanent-denial ledger. This
ledger overrides a later unban action and therefore cannot be cleared through
the ordinary moderation interface.
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import CheckConstraint, Column, DateTime, Index, Integer, String
from sqlalchemy.orm import Session

from db.base import Base
from demo_observability import observed_ban


class AccountBanAction(Base):
    __tablename__ = "demo_account_ban_actions"
    __table_args__ = (
        Index("ix_demo_account_ban_actions_account_id_id", "account_id", "id"),
        CheckConstraint("action IN ('ban', 'unban')", name="ck_demo_account_ban_action"),
    )

    id = Column(Integer, primary_key=True)
    account_id = Column(Integer, nullable=False, index=True)
    actor_account_id = Column(Integer, nullable=False)
    action = Column(String(12), nullable=False)  # ban | unban
    reason = Column(String(500), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False,
                        default=lambda: datetime.now(timezone.utc))


class PermanentAccountBan(Base):
    __tablename__ = "demo_permanent_account_bans"

    account_id = Column(Integer, primary_key=True)
    reason = Column(String(500), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False,
                        default=lambda: datetime.now(timezone.utc))


def permanent_ban(db: Session, account_id: int) -> PermanentAccountBan | None:
    return db.get(PermanentAccountBan, account_id)


def active_ban(db: Session, account_id: int) -> AccountBanAction | PermanentAccountBan | None:
    permanent = permanent_ban(db, account_id)
    if permanent is not None:
        return permanent
    latest = (db.query(AccountBanAction)
              .filter(AccountBanAction.account_id == account_id)
              .order_by(AccountBanAction.id.desc()).first())
    return latest if latest is not None and latest.action == "ban" else None


def active_bans_for(db: Session, account_ids: list[int]) -> dict[int, AccountBanAction | PermanentAccountBan]:
    if not account_ids:
        return {}
    latest = {}
    rows = (db.query(AccountBanAction)
            .filter(AccountBanAction.account_id.in_(account_ids))
            .order_by(AccountBanAction.id.desc()).all())
    for row in rows:
        latest.setdefault(row.account_id, row)
    bans = {account_id: row for account_id, row in latest.items()
            if row.action == "ban"}
    permanent = db.query(PermanentAccountBan).filter(
        PermanentAccountBan.account_id.in_(account_ids)).all()
    bans.update({row.account_id: row for row in permanent})
    return bans


def banned_guest_ids(db: Session, guest_ids: list[int]) -> set[int]:
    """Resolve active bans for canonical guests in one batch.

    A waitlist can contain entries created before a moderator banned their
    account.  Background seat allocation has no authenticated caller, so it
    must exclude those guests explicitly rather than relying on login guards.
    """
    if not guest_ids:
        return set()
    from demo_accounts import WebAccount
    accounts = (db.query(WebAccount.id, WebAccount.guest_id)
                .filter(WebAccount.guest_id.in_(guest_ids)).all())
    bans = active_bans_for(db, [int(account_id) for account_id, _ in accounts])
    return {int(guest_id) for account_id, guest_id in accounts
            if int(account_id) in bans}


def require_account_active(db: Session, account) -> None:
    if active_ban(db, account.id) is not None:
        observed_ban(account.id)
        raise HTTPException(status_code=403, detail="account_banned")


def require_guest_active(db: Session, guest_id: int) -> None:
    # A verified Mini App identity and a website session resolve to the same
    # canonical guest. A ban must apply to both access channels.
    from demo_accounts import WebAccount
    account_id = db.query(WebAccount.id).filter(WebAccount.guest_id == guest_id).scalar()
    if account_id is not None and active_ban(db, account_id) is not None:
        observed_ban(account_id, guest_id)
        raise HTTPException(status_code=403, detail="account_banned")


def require_verified_guest_active(db: Session, guest_id: int) -> None:
    """Use only after validating the caller's Telegram or website credentials."""
    from demo_observability import verified_guest
    verified_guest(guest_id)
    require_guest_active(db, guest_id)


def require_telegram_account_active(db: Session, telegram_id: int) -> None:
    """Apply an existing web ban to the legacy private Telegram bot channel."""
    from demo_telegram import DemoTelegramIdentity
    identity = db.query(DemoTelegramIdentity.guest_id).filter(
        DemoTelegramIdentity.telegram_id == telegram_id,
    ).scalar()
    if identity is not None:
        require_guest_active(db, identity)
