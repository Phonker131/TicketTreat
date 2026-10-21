"""Account privacy requests with proof-of-identity and an auditable lifecycle.

A request is NOT an immediate erasure: active event bookings, organizer records,
fraud prevention and statutory financial retention may require review. These
records are retained only for subsequent controlled fulfillment.
"""
from __future__ import annotations

from datetime import datetime, timezone
from fastapi import Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Session

from db.base import Base
from demo_accounts import WebAccount
from demo_auth_security import verify_password, guard_rate, record_rate
from demo_roles import account_lookup


class PrivacyRequest(Base):
    __tablename__ = "demo_privacy_requests"
    id = Column(Integer, primary_key=True)
    account_id = Column(Integer, ForeignKey("demo_web_accounts.id"), nullable=False, index=True)
    request_type = Column(String(24), nullable=False, default="erasure")
    status = Column(String(24), nullable=False, default="pending")
    created_at = Column(DateTime(timezone=True), nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=False)


class RequestErasure(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)


def install_privacy_routes(app, get_db):
    def current(
        authorization: str | None = Header(default=None),
        db: Session = Depends(get_db),
    ) -> WebAccount:
        return account_lookup(db, authorization)

    @app.get("/demo/auth/privacy-request")
    def privacy_status(account: WebAccount = Depends(current),
                       db: Session = Depends(get_db)):
        item=(db.query(PrivacyRequest)
            .filter(PrivacyRequest.account_id == account.id,
                    PrivacyRequest.request_type == "erasure")
            .order_by(PrivacyRequest.id.desc()).first())
        return {"status": item.status if item else "none",
                "requested_at": item.created_at if item else None,
                "updated_at": item.updated_at if item else None,
                "note": "Submitting a request does not delete event or financial records immediately."}

    @app.post("/demo/auth/privacy-request", status_code=202)
    def request_erasure(payload: RequestErasure, request: Request,
                        account: WebAccount = Depends(current),
                        db: Session = Depends(get_db)):
        guard_rate(db, "privacy_request_account", str(account.id), 6, 3600)
        record_rate(db, "privacy_request_account", str(account.id), 3600)
        if not verify_password(payload.current_password, account.password_hash):
            raise HTTPException(status_code=403, detail="password_confirmation_failed")
        now=datetime.now(timezone.utc)
        item=(db.query(PrivacyRequest)
            .filter(PrivacyRequest.account_id == account.id,
                    PrivacyRequest.request_type == "erasure",
                    PrivacyRequest.status == "pending")
            .with_for_update().first())
        if item is None:
            item=PrivacyRequest(account_id=account.id,request_type="erasure",
                status="pending",created_at=now,updated_at=now)
            db.add(item)
        db.commit()
        return {"status": "pending", "message": "Your erasure request has been registered for review."}

    @app.delete("/demo/auth/privacy-request")
    def withdraw_erasure(account: WebAccount = Depends(current),
                         db: Session = Depends(get_db)):
        now=datetime.now(timezone.utc)
        items=(db.query(PrivacyRequest)
            .filter(PrivacyRequest.account_id == account.id,
                    PrivacyRequest.request_type == "erasure",
                    PrivacyRequest.status == "pending")
            .with_for_update().all())
        for item in items:
            item.status="withdrawn"
            item.updated_at=now
        db.commit()
        return {"status": "withdrawn" if items else "none"}
