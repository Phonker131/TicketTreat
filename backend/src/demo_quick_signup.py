"""Verified, passwordless first-time attendee onboarding.

Never binds an unverified email to an existing account; no organizer roles.
One-time HMAC tokens, consent acknowledgement, expiry and rate limits.
"""
from __future__ import annotations
import hashlib,hmac,os,secrets
from datetime import datetime,timedelta,timezone
from fastapi import Depends,HTTPException,Request
from pydantic import BaseModel,Field
from sqlalchemy import Column,DateTime,Integer,String
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from db.base import Base
from demo_accounts import WebAccount,normalize_email
from demo_auth_security import guard_rate,record_rate,hash_password
from demo_account_recovery import VerifiedEmail,send_code


class QuickSignupPending(Base):
    __tablename__="demo_quick_signups"
    email=Column(String(255),primary_key=True)
    first_name=Column(String(100),nullable=False)
    last_name=Column(String(100),nullable=False,default="")
    privacy_version=Column(String(24),nullable=False)
    code_hash=Column(String(64),nullable=False)
    attempts=Column(Integer,nullable=False,default=0)
    expires_at=Column(DateTime(timezone=True),nullable=False)


class QuickRequest(BaseModel):
    email:str=Field(min_length=5,max_length=255)
    first_name:str=Field(min_length=1,max_length=100)
    privacy_accepted:bool
    privacy_version:str=Field(default="2026-10",pattern=r"^2026-10$")


class QuickConfirm(BaseModel):
    email:str=Field(min_length=5,max_length=255)
    code:str=Field(pattern=r"^\d{8}$")


def utc(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def digest(email,code):
    key=os.getenv("AUTH_CODE_SECRET","")
    if len(key)<32:raise HTTPException(503,"auth_code_secret_not_configured")
    return hmac.new(key.encode(),f"quick:{email}:{code}".encode(),hashlib.sha256).hexdigest()


def install_quick_signup(app,get_db,DemoGuest,issue_session,profile_dict):
    from demo_roles import WebAccountRole
    @app.post("/demo/auth/quick/request")
    def request_quick(payload:QuickRequest,request:Request,db:Session=Depends(get_db)):
        if payload.privacy_accepted is not True:
            raise HTTPException(422,"privacy_acceptance_required")
        email=normalize_email(payload.email)
        ip=request.client.host if request.client else "unknown"
        guard_rate(db,"quick_ip",ip,12,3600)
        guard_rate(db,"quick_email",email,4,3600)
        record_rate(db,"quick_ip",ip,3600)
        record_rate(db,"quick_email",email,3600)
        from demo_email import configured
        if not configured():raise HTTPException(503,"email_provider_unavailable")
        now=datetime.now(timezone.utc)
        db.query(QuickSignupPending).filter(QuickSignupPending.expires_at < now).delete()
        if db.query(WebAccount.id).filter(WebAccount.email==email).first():
            db.commit()
            return {"status":"if_eligible_code_sent"}
        first=payload.first_name.strip()
        if not first:raise HTTPException(422,"name_required")
        code=f"{secrets.randbelow(100_000_000):08d}"
        row=db.get(QuickSignupPending,email)
        if row is None:
            row=QuickSignupPending(email=email);db.add(row)
        row.first_name, row.last_name = first,""
        row.privacy_version=payload.privacy_version
        row.code_hash=digest(email,code)
        row.expires_at=now+timedelta(minutes=10)
        row.attempts=0
        send_code(email,"quick",code)
        db.commit()
        return {"status":"if_eligible_code_sent"}

    @app.post("/demo/auth/quick/confirm")
    def confirm_quick(payload:QuickConfirm,request:Request,db:Session=Depends(get_db)):
        ip=request.client.host if request.client else "unknown"
        guard_rate(db,"quick_confirm_ip",ip,20,3600)
        record_rate(db,"quick_confirm_ip",ip,3600)
        email=normalize_email(payload.email)
        row=db.query(QuickSignupPending).filter(
            QuickSignupPending.email==email).with_for_update().first()
        if row is None or utc(row.expires_at)<=datetime.now(timezone.utc) or row.attempts>=5:
            raise HTTPException(400,"invalid_or_expired_code")
        row.attempts+=1
        if not secrets.compare_digest(row.code_hash,digest(email,payload.code)):
            db.commit()
            raise HTTPException(400,"invalid_or_expired_code")
        if db.query(WebAccount.id).filter(WebAccount.email==email).first():
            db.delete(row);db.commit()
            raise HTTPException(409,"account_already_exists_use_login")
        guest=DemoGuest(access_token=secrets.token_urlsafe(32),
                        first_name=row.first_name,last_name=row.last_name,email=email)
        db.add(guest);db.flush()
        account=WebAccount(email=email,first_name=row.first_name,last_name=row.last_name,
                           guest_id=guest.id,password_hash=hash_password(secrets.token_urlsafe(48)),
                           contact_preference="email")
        db.add(account);db.flush()
        db.add(VerifiedEmail(account_id=account.id,verified_at=datetime.now(timezone.utc)))
        db.add(WebAccountRole(account_id=account.id,role="participant"))
        # Consent is persisted with immutable acceptance timestamp.
        db.add(QuickPrivacyConsent(account_id=account.id,version=row.privacy_version,
                                   accepted_at=datetime.now(timezone.utc)))
        db.delete(row)
        try:db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(409,"account_already_exists_use_login")
        token=issue_session(db,account)
        return {"token":token,"profile":profile_dict(account,db)}


class QuickPrivacyConsent(Base):
    __tablename__="demo_quick_privacy_consents"
    account_id=Column(Integer,primary_key=True)
    version=Column(String(24),nullable=False)
    accepted_at=Column(DateTime(timezone=True),nullable=False)
