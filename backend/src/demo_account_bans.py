"""Audited, reversible access bans for canonical TicketTreat accounts.

An immutable action stream preserves each ban and unban reason. Authorization
always checks the latest action, so revoking sessions is not the only guard.
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import CheckConstraint, Column, DateTime, Index, Integer, String
from sqlalchemy.orm import Session

from db.base import Base


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


def active_ban(db: Session, account_id: int) -> AccountBanAction | None:
    latest = (db.query(AccountBanAction)
              .filter(AccountBanAction.account_id == account_id)
              .order_by(AccountBanAction.id.desc()).first())
    return latest if latest is not None and latest.action == "ban" else None


def active_bans_for(db: Session, account_ids: list[int]) -> dict[int, AccountBanAction]:
    if not account_ids:
        return {}
    latest = {}
    rows = (db.query(AccountBanAction)
            .filter(AccountBanAction.account_id.in_(account_ids))
            .order_by(AccountBanAction.id.desc()).all())
    for row in rows:
        latest.setdefault(row.account_id, row)
    return {account_id: row for account_id, row in latest.items()
            if row.action == "ban"}


def require_account_active(db: Session, account) -> None:
    if active_ban(db, account.id) is not None:
        raise HTTPException(status_code=403, detail="account_banned")


def require_guest_active(db: Session, guest_id: int) -> None:
    # A verified Mini App identity and a website session resolve to the same
    # canonical guest. A ban must apply to both access channels.
    from demo_accounts import WebAccount
    account_id = db.query(WebAccount.id).filter(WebAccount.guest_id == guest_id).scalar()
    if account_id is not None and active_ban(db, account_id) is not None:
        raise HTTPException(status_code=403, detail="account_banned")


def require_telegram_account_active(db: Session, telegram_id: int) -> None:
    """Apply an existing web ban to the legacy private Telegram bot channel."""
    from demo_telegram import DemoTelegramIdentity
    identity = db.query(DemoTelegramIdentity.guest_id).filter(
        DemoTelegramIdentity.telegram_id == telegram_id,
    ).scalar()
    if identity is not None:
        require_guest_active(db, identity)
