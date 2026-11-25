"""Organization-scoped financial evidence and electronic-agreement foundation.

No payment can be created, marked paid, or invoiced by these endpoints.
Ledger entries are reserved for verified provider reconciliation in a later,
separately reviewed integration. Historical tickets are NOT sales.
"""
from __future__ import annotations

import csv
import hashlib
import io
import hmac
import os
import re
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import Depends, Header, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import (BigInteger, Boolean, CheckConstraint, Column, DateTime,
                        ForeignKey, Integer, String, Text, UniqueConstraint)
from sqlalchemy.orm import Session

from db.base import Base

PRAGUE = ZoneInfo("Europe/Prague")
ENTRY_TYPES = {"sale", "refund", "stripe_fee", "payout", "dispute_fee"}
FINANCE_UNLOCK_MINUTES = 15


class OrganizerFinanceProfile(Base):
    __tablename__ = "tt_organizer_finance_profiles"
    owner_account_id = Column(Integer, ForeignKey("demo_web_accounts.id"), primary_key=True)
    legal_name = Column(String(255), nullable=True)
    ico = Column(String(16), nullable=True)
    dic = Column(String(32), nullable=True)
    vat_status = Column(String(20), nullable=False, default="unverified")
    stripe_account_id = Column(String(100), nullable=True, unique=True)
    charges_enabled = Column(Boolean, nullable=False, default=False)
    payouts_enabled = Column(Boolean, nullable=False, default=False)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    __table_args__ = (CheckConstraint(
        "vat_status IN ('unverified', 'non_payer', 'payer', 'exempt')",
        name="ck_finance_vat_status"),)


class OrganizerFinanceAudit(Base):
    __tablename__ = "tt_finance_profile_audit"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    owner_account_id = Column(Integer, nullable=False)
    actor_account_id = Column(Integer, nullable=False)
    action = Column(String(30), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False,
                        default=lambda: datetime.now(timezone.utc))


class FinanceSessionGrant(Base):
    """Short, session-bound finance unlock. A ban/revoked web token still wins."""
    __tablename__ = "tt_finance_session_grants"
    session_hash = Column(String(64), primary_key=True)
    account_id = Column(Integer, ForeignKey("demo_web_accounts.id", ondelete="CASCADE"),
                        nullable=False, index=True)
    granted_at = Column(DateTime(timezone=True), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    __table_args__ = (CheckConstraint("expires_at > granted_at", name="ck_finance_session_grant_expiry"),)


class FinanceAccessAudit(Base):
    """Append-only, minimal evidence. No emails, raw IPs, TOTP or bearer tokens."""
    __tablename__ = "tt_finance_access_audit"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    owner_account_id = Column(Integer, nullable=False)
    actor_account_id = Column(Integer, nullable=False)
    action = Column(String(32), nullable=False)
    request_id = Column(String(32), nullable=True)
    ip_fingerprint = Column(String(64), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False,
                        default=lambda: datetime.now(timezone.utc))
    __table_args__ = (CheckConstraint("length(action) > 0", name="ck_finance_access_audit_action"),)


class FinanceLedgerEntry(Base):
    """Provider-only append-only evidence, never a writable organizer API."""
    __tablename__ = "tt_finance_ledger"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    owner_account_id = Column(Integer, ForeignKey("demo_web_accounts.id"), nullable=False, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=True)
    category = Column(String(20), nullable=False)
    amount_minor = Column(BigInteger, nullable=False)
    currency = Column(String(3), nullable=False)
    source = Column(String(20), nullable=False)
    source_key = Column(String(200), nullable=False)
    order_reference = Column(String(120), nullable=True)
    # A verified document/tax provider, not a guessed VAT rate, sets this.
    verified_tax_minor = Column(BigInteger, nullable=True)
    occurred_at = Column(DateTime(timezone=True), nullable=False)
    recorded_at = Column(DateTime(timezone=True), nullable=False,
                         default=lambda: datetime.now(timezone.utc))
    __table_args__ = (
        UniqueConstraint("source", "source_key", name="uq_finance_provider_event"),
        CheckConstraint("category IN ('sale','refund','stripe_fee','payout','dispute_fee')",
                        name="ck_finance_category"),
        CheckConstraint("currency IN ('CZK','EUR')", name="ck_finance_currency"),
        CheckConstraint("amount_minor <> 0", name="ck_finance_nonzero"),
    )


class FinanceDocument(Base):
    """Metadata of separately archived documents, not an issued tax invoice."""
    __tablename__ = "tt_finance_documents"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    owner_account_id = Column(Integer, ForeignKey("demo_web_accounts.id"), nullable=False, index=True)
    kind = Column(String(30), nullable=False)
    document_number = Column(String(80), nullable=False)
    sha256 = Column(String(64), nullable=False)
    storage_key = Column(String(300), nullable=False)
    issued_at = Column(DateTime(timezone=True), nullable=False)
    __table_args__ = (UniqueConstraint("owner_account_id", "document_number",
                                      name="uq_finance_document_number"),)


class OrganizerContractVersion(Base):
    __tablename__ = "tt_organizer_contract_versions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    version = Column(String(40), nullable=False)
    language = Column(String(2), nullable=False)
    body = Column(Text, nullable=False)
    sha256 = Column(String(64), nullable=False)
    # Legal review and explicit publication are outside the application rollout.
    status = Column(String(16), nullable=False, default="draft")
    published_at = Column(DateTime(timezone=True), nullable=True)
    __table_args__ = (
        UniqueConstraint("version", "language", name="uq_finance_contract_version"),
        CheckConstraint("status IN ('draft','published','retired')",
                        name="ck_finance_contract_status"),
        CheckConstraint("status <> 'published' OR published_at IS NOT NULL",
                        name="ck_finance_contract_publish_time"),
    )


class OrganizerContractAcceptance(Base):
    __tablename__ = "tt_organizer_contract_acceptances"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    owner_account_id = Column(Integer, ForeignKey("demo_web_accounts.id"), nullable=False)
    signer_account_id = Column(Integer, ForeignKey("demo_web_accounts.id"), nullable=False)
    contract_id = Column(Integer, ForeignKey("tt_organizer_contract_versions.id"), nullable=False)
    contract_sha256 = Column(String(64), nullable=False)
    # Explicit website acknowledgement, NOT a qualified eIDAS signature.
    signature_method = Column(String(24), nullable=False, default="web_mfa_ack")
    accepted_at = Column(DateTime(timezone=True), nullable=False)
    __table_args__ = (UniqueConstraint("owner_account_id", "contract_id",
                                      name="uq_finance_contract_acceptance"),)


def contract_digest(body: str) -> str:
    return hashlib.sha256(body.encode("utf-8")).hexdigest()


def month_bounds(value: str | None) -> tuple[str, datetime, datetime]:
    if value is None:
        value = datetime.now(PRAGUE).strftime("%Y-%m")
    if not re.fullmatch(r"\d{4}-(?:0[1-9]|1[0-2])", value):
        raise HTTPException(422, "invalid_finance_month")
    year, month = (int(part) for part in value.split("-"))
    if year < 2026 or year > 2100:
        raise HTTPException(422, "invalid_finance_month")
    first = datetime(year, month, 1, tzinfo=PRAGUE)
    next_month = datetime(year+1, 1, 1, tzinfo=PRAGUE) if month == 12 else datetime(year, month+1, 1, tzinfo=PRAGUE)
    return value, first.astimezone(timezone.utc), next_month.astimezone(timezone.utc)


def totals(entries: list[FinanceLedgerEntry]) -> dict:
    """Gross, processor fees and payouts are separate financial concepts."""
    sales = sum(int(e.amount_minor) for e in entries if e.category == "sale")
    refunds = -sum(int(e.amount_minor) for e in entries if e.category == "refund")
    fees = -sum(int(e.amount_minor) for e in entries if e.category in {"stripe_fee", "dispute_fee"})
    payouts = -sum(int(e.amount_minor) for e in entries if e.category == "payout")
    taxable = [e for e in entries if e.category in {"sale", "refund"}]
    tax_complete = bool(taxable) and all(e.verified_tax_minor is not None for e in taxable)
    tax = sum(int(e.verified_tax_minor) for e in taxable) if tax_complete else None
    return {
        "gross_sales_minor": sales,
        "refunds_minor": refunds,
        "stripe_fees_minor": fees,
        "payouts_minor": payouts,
        "net_after_processing_minor": sales-refunds-fees,
        "verified_tax_minor": tax,
        "net_after_verified_tax_minor": sales-refunds-fees-tax if tax is not None else None,
        "platform_fee_minor": 0,
        "entry_count": len(entries),
        "tax_is_complete": tax_complete,
    }


class AcceptContract(BaseModel):
    model_config = ConfigDict(extra="forbid")
    contract_id: int = Field(gt=0)
    digest: str = Field(pattern=r"^[a-f0-9]{64}$")
    confirm_authority: bool
    mfa_code: str = Field(pattern=r"^[0-9]{6}$", repr=False)


class UpdateFinanceProfile(BaseModel):
    model_config = ConfigDict(extra="forbid")
    legal_name: str = Field(min_length=2, max_length=255)
    ico: str = Field(pattern=r"^\d{8}$")
    dic: str | None = Field(default=None, max_length=32)
    vat_status: str = Field(pattern=r"^(non_payer|payer|exempt)$")
    mfa_code: str = Field(pattern=r"^[0-9]{6}$", repr=False)


class FinanceMFAProof(BaseModel):
    model_config = ConfigDict(extra="forbid")
    mfa_code: str = Field(pattern=r"^[0-9]{6}$", repr=False)


class FinanceExportRequest(FinanceMFAProof):
    organization_id: int | None = Field(default=None, gt=0)
    month: str | None = None
    currency: str = "CZK"


def trusted_ip_fingerprint(request: Request) -> str | None:
    """Correlate suspect source IPs without persisting raw IP or a reversible hash.

    A missing HMAC key intentionally omits this optional field. Uses the signed
    gateway address or peer, never attacker-supplied forwarding headers.
    """
    from demo_client_ip import source_ip
    key = os.getenv("FINANCE_AUDIT_HMAC_KEY", "")
    if len(key) < 32:
        key = os.getenv("TICKETTREAT_GATEWAY_IP_SECRET", "")
    address = source_ip(request)
    if len(key) < 32 or address == "unknown":
        return None
    return hmac.new(key.encode("utf-8"), ("finance-audit-ip-v1:" + address).encode("utf-8"),
                    hashlib.sha256).hexdigest()


def finance_csv_reference(raw: str | None) -> str:
    """Provider-supplied order labels always enter spreadsheets as text."""
    return "'" + (raw or "").replace("\r", " ").replace("\n", " ") if raw else ""


def install_finance_api(app, get_db):
    from demo_roles import account_lookup, role_for
    from demo_organizer_teams import valid_owner
    from demo_accounts import token_hash
    from demo_auth_security import guard_rate, record_rate
    from demo_mfa import (MFAFactor, MFASession, cipher, match_counter,
                          session_for, utc)
    from cryptography.fernet import InvalidToken

    def session_hash(authorization: str | None) -> str:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(401, "login_required")
        return token_hash(authorization[7:].strip())

    def finance_identity(response: Response,
                         authorization: str | None = Header(default=None),
                         db: Session = Depends(get_db)):
        response.headers["Cache-Control"] = "private, no-store"
        response.headers["Pragma"] = "no-cache"
        response.headers["X-Robots-Tag"] = "noindex, nofollow"
        account = account_lookup(db, authorization)
        if role_for(db, account) not in {"organizer", "global_admin"}:
            raise HTTPException(403, "finance_owner_required")
        # Finance is always MFA-protected, even if APP_ENV is misconfigured.
        authenticated, session = session_for(db, authorization)
        if authenticated.id != account.id:
            raise HTTPException(401, "invalid_session")
        factor = db.get(MFAFactor, account.id)
        if not factor or factor.enabled_at is None:
            raise HTTPException(403, "mfa_enrollment_required")
        assertion = db.get(MFASession, session.token_hash)
        if not assertion or assertion.account_id != account.id or utc(assertion.verified_until) <= datetime.now(timezone.utc):
            raise HTTPException(403, "mfa_challenge_required")
        guard_rate(db, "finance_all", str(account.id), 300, 3600)
        record_rate(db, "finance_all", str(account.id), 3600)
        return account

    def signed_in(authorization: str | None = Header(default=None),
                  account=Depends(finance_identity),
                  db: Session = Depends(get_db)):
        grant = db.get(FinanceSessionGrant, session_hash(authorization))
        if not grant or grant.account_id != account.id or utc(grant.expires_at) <= datetime.now(timezone.utc):
            raise HTTPException(403, "finance_unlock_required")
        return account

    def sensitive_otp(db: Session, account_id: int, code: str) -> None:
        # A fresh, single-use TOTP for each sensitive operation. Reuse within
        # the same 30-second MFA step is rejected, including across endpoints.
        guard_rate(db, "finance_otp", str(account_id), 8, 900)
        record_rate(db, "finance_otp", str(account_id), 900)
        factor = db.query(MFAFactor).filter(MFAFactor.account_id == account_id).with_for_update().first()
        if not factor or not factor.enabled_at:
            raise HTTPException(403, "mfa_enrollment_required")
        try:
            secret = cipher().decrypt(factor.encrypted_secret)
        except InvalidToken:
            raise HTTPException(503, "mfa_key_decryption_failed") from None
        counter = match_counter(secret, code, after=factor.last_counter if factor.last_counter is not None else -1)
        if counter is None:
            raise HTTPException(401, "invalid_mfa_code")
        factor.last_counter = counter

    def access_audit(db: Session, request: Request, actor_id: int, owner_id: int, action: str) -> None:
        db.add(FinanceAccessAudit(
            owner_account_id=owner_id, actor_account_id=actor_id, action=action,
            request_id=getattr(request.state, "incident_request_id", None),
            ip_fingerprint=trusted_ip_fingerprint(request),
        ))
        db.commit()

    @app.get("/demo/manage/finance/status")
    def finance_status(authorization: str | None = Header(default=None),
                       account=Depends(finance_identity),
                       db: Session = Depends(get_db)):
        grant = db.get(FinanceSessionGrant, session_hash(authorization))
        unlocked = bool(grant and grant.account_id == account.id and
                        utc(grant.expires_at) > datetime.now(timezone.utc))
        return {"unlocked": unlocked, "expires_at": grant.expires_at.isoformat() if unlocked else None,
                "unlock_minutes": FINANCE_UNLOCK_MINUTES}

    @app.post("/demo/manage/finance/unlock")
    def finance_unlock(payload: FinanceMFAProof, request: Request,
                       authorization: str | None = Header(default=None),
                       account=Depends(finance_identity),
                       db: Session = Depends(get_db)):
        sensitive_otp(db, account.id, payload.mfa_code)
        now = datetime.now(timezone.utc)
        key = session_hash(authorization)
        grant = db.get(FinanceSessionGrant, key)
        if grant is None:
            grant = FinanceSessionGrant(session_hash=key, account_id=account.id,
                                        granted_at=now, expires_at=now+timedelta(minutes=FINANCE_UNLOCK_MINUTES))
            db.add(grant)
        else:
            grant.account_id = account.id
            grant.granted_at = now
            grant.expires_at = now+timedelta(minutes=FINANCE_UNLOCK_MINUTES)
        access_audit(db, request, account.id, account.id, "finance_unlocked")
        return {"unlocked": True, "expires_at": grant.expires_at.isoformat()}

    def authorized_owner(db, account, requested: int | None) -> int:
        owner = requested if requested is not None else account.id
        if owner <= 0:
            raise HTTPException(422, "invalid_finance_organization")
        # Even a global admin must not browse another seller's financial data.
        # Cross-owner support requires a future, consented and dual-approved
        # workflow with a recorded purpose; admin privileges alone are not it.
        # Accepted team membership grants event management, not finance access.
        if owner != account.id or not valid_owner(db, account.id):
            raise HTTPException(403, "finance_owner_required")
        return owner

    def rows(db, owner: int, month: str, currency: str):
        if currency not in {"CZK", "EUR"}:
            raise HTTPException(422, "invalid_finance_currency")
        _, begin, end = month_bounds(month)
        return db.query(FinanceLedgerEntry).filter(
            FinanceLedgerEntry.owner_account_id == owner,
            FinanceLedgerEntry.currency == currency,
            FinanceLedgerEntry.occurred_at >= begin,
            FinanceLedgerEntry.occurred_at < end,
        ).order_by(FinanceLedgerEntry.occurred_at, FinanceLedgerEntry.id).limit(10001).all()

    def entry_dict(item):
        return {"id": item.id, "event_id": item.event_id, "category": item.category,
                "amount_minor": item.amount_minor, "currency": item.currency,
                "order_reference": item.order_reference,
                "occurred_at": item.occurred_at.isoformat()}

    def profile_dict(row):
        return {"legal_name": row.legal_name if row else None,
                "ico": row.ico if row else None, "dic": row.dic if row else None,
                "vat_status": row.vat_status if row else "unverified",
                "verified": bool(row and row.verified_at),
                "stripe_connected": bool(row and row.stripe_account_id),
                "charges_enabled": bool(row and row.charges_enabled),
                "payouts_enabled": bool(row and row.payouts_enabled)}

    def contract_for(db, language):
        if language not in {"cs", "en"}:
            raise HTTPException(422, "invalid_contract_language")
        return db.query(OrganizerContractVersion).filter(
            OrganizerContractVersion.language == language,
            OrganizerContractVersion.status == "published",
            OrganizerContractVersion.published_at.isnot(None),
        ).order_by(OrganizerContractVersion.published_at.desc(),
                   OrganizerContractVersion.id.desc()).first()

    @app.get("/demo/manage/finance/summary")
    def finance_summary(request: Request, organization_id: int | None = None, month: str | None = None,
                        currency: str = "CZK", account=Depends(signed_in),
                        db: Session = Depends(get_db)):
        owner = authorized_owner(db, account, organization_id)
        period, _, _ = month_bounds(month)
        ledger = rows(db, owner, period, currency)
        if len(ledger) > 10000:
            raise HTTPException(409, "finance_month_requires_reconciliation")
        profile = db.get(OrganizerFinanceProfile, owner)
        result = {"organization_id": owner, "month": period, "currency": currency,
                "stripe_connected": bool(profile and profile.stripe_account_id),
                "seller_verification": "verified" if profile and profile.verified_at else "pending",
                "vat_status": profile.vat_status if profile else "unverified",
                "summary": totals(ledger),
                "notice": "Only verified provider entries are counted; legacy tickets are not sales. Not a tax return."}
        access_audit(db, request, account.id, owner, "summary_viewed")
        return result

    @app.get("/demo/manage/finance/profile")
    def finance_profile(request: Request, account=Depends(signed_in), db: Session = Depends(get_db)):
        owner = authorized_owner(db, account, None)
        result = profile_dict(db.get(OrganizerFinanceProfile, owner))
        access_audit(db, request, account.id, owner, "profile_viewed")
        return result

    @app.put("/demo/manage/finance/profile")
    def update_finance_profile(payload: UpdateFinanceProfile, request: Request,
                               account=Depends(signed_in),
                               db: Session = Depends(get_db)):
        if not valid_owner(db, account.id):
            raise HTTPException(403, "organization_owner_required")
        guard_rate(db, "finance_profile_write", str(account.id), 6, 3600)
        record_rate(db, "finance_profile_write", str(account.id), 3600)
        sensitive_otp(db, account.id, payload.mfa_code)
        legal_name = payload.legal_name.strip()
        if len(legal_name) < 2 or not legal_name:
            raise HTTPException(422, "invalid_finance_legal_name")
        dic = (payload.dic or "").strip().upper() or None
        if dic and not re.fullmatch(r"[A-Z0-9]{3,32}", dic):
            raise HTTPException(422, "invalid_finance_dic")
        # Serialization by immutable owner ID; no self-approval of KYC/taxes.
        db.query(type(account)).filter(type(account).id == account.id).with_for_update().first()
        profile = db.get(OrganizerFinanceProfile, account.id)
        if profile is None:
            profile = OrganizerFinanceProfile(owner_account_id=account.id)
            db.add(profile)
        profile.legal_name, profile.ico, profile.dic = legal_name, payload.ico, dic
        profile.vat_status = payload.vat_status
        profile.verified_at = None
        # Changing legal seller identity invalidates payout readiness.
        profile.charges_enabled = False
        profile.payouts_enabled = False
        db.add(OrganizerFinanceAudit(owner_account_id=account.id,
            actor_account_id=account.id, action="profile_updated"))
        access_audit(db, request, account.id, account.id, "profile_updated")
        return profile_dict(profile)

    @app.get("/demo/manage/finance/entries")
    def finance_entries(request: Request, organization_id: int | None = None, month: str | None = None,
                        currency: str = "CZK", account=Depends(signed_in),
                        db: Session = Depends(get_db)):
        owner = authorized_owner(db, account, organization_id)
        period, _, _ = month_bounds(month)
        ledger = rows(db, owner, period, currency)
        if len(ledger) > 10000:
            raise HTTPException(409, "finance_month_requires_reconciliation")
        result = {"entries": [entry_dict(row) for row in ledger]}
        access_audit(db, request, account.id, owner, "entries_viewed")
        return result

    @app.post("/demo/manage/finance/export")
    def finance_export(payload: FinanceExportRequest, request: Request,
                       account=Depends(signed_in),
                       db: Session = Depends(get_db)):
        owner = authorized_owner(db, account, payload.organization_id)
        guard_rate(db, "finance_export", str(account.id), 12, 3600)
        record_rate(db, "finance_export", str(account.id), 3600)
        sensitive_otp(db, account.id, payload.mfa_code)
        period, _, _ = month_bounds(payload.month)
        ledger = rows(db, owner, period, payload.currency)
        if len(ledger) > 10000:
            raise HTTPException(409, "finance_month_requires_reconciliation")
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(("id", "date_utc", "event_id", "category", "amount_minor", "currency", "order_reference"))
        for item in ledger:
            writer.writerow((item.id, item.occurred_at.isoformat(), item.event_id,
                             item.category, item.amount_minor, item.currency,
                             finance_csv_reference(item.order_reference)))
        access_audit(db, request, account.id, owner, "csv_exported")
        return {"filename": f"tickettreat-finance-{owner}-{period}-{payload.currency}.csv",
                "csv": output.getvalue()}

    @app.get("/demo/manage/finance/documents")
    def finance_documents(request: Request, organization_id: int | None = None,
                          account=Depends(signed_in), db: Session = Depends(get_db)):
        owner = authorized_owner(db, account, organization_id)
        guard_rate(db, "finance_documents", str(account.id), 90, 3600)
        record_rate(db, "finance_documents", str(account.id), 3600)
        documents = db.query(FinanceDocument).filter(
            FinanceDocument.owner_account_id == owner).order_by(
            FinanceDocument.issued_at.desc()).limit(200).all()
        # Private storage keys and document bytes must never enter a listing.
        result = {"documents": [{"id": item.id, "kind": item.kind,
                                "document_number": item.document_number,
                                "issued_at": item.issued_at.isoformat()} for item in documents],
                "notice": "Document creation/download requires verified issuer settings and separate legal review."}
        access_audit(db, request, account.id, owner, "documents_viewed")
        return result

    @app.get("/demo/manage/finance/contract")
    def current_contract(request: Request, language: str = "cs", organization_id: int | None = None,
                         account=Depends(signed_in), db: Session = Depends(get_db)):
        owner = authorized_owner(db, account, organization_id)
        contract = contract_for(db, language)
        if contract is None:
            access_audit(db, request, account.id, owner, "contract_unavailable")
            return {"status": "pending_legal_review", "contract": None, "accepted": False}
        if contract_digest(contract.body) != contract.sha256:
            raise HTTPException(409, "contract_integrity_check_failed")
        accepted = db.query(OrganizerContractAcceptance).filter(
            OrganizerContractAcceptance.owner_account_id == owner,
            OrganizerContractAcceptance.contract_id == contract.id,
            OrganizerContractAcceptance.contract_sha256 == contract.sha256).first()
        result = {"status": "published", "accepted": accepted is not None,
                "contract": {"id": contract.id, "version": contract.version,
                             "language": language, "body": contract.body,
                             "sha256": contract.sha256}}
        access_audit(db, request, account.id, owner, "contract_viewed")
        return result

    @app.post("/demo/manage/finance/contract/accept")
    def accept_contract(payload: AcceptContract, request: Request,
                        account=Depends(signed_in),
                        db: Session = Depends(get_db)):
        if not payload.confirm_authority or not valid_owner(db, account.id):
            raise HTTPException(403, "organization_signatory_required")
        guard_rate(db, "finance_contract_write", str(account.id), 6, 3600)
        record_rate(db, "finance_contract_write", str(account.id), 3600)
        sensitive_otp(db, account.id, payload.mfa_code)
        # Global admins cannot sign on behalf of another organization.
        db.query(type(account)).filter(type(account).id == account.id).with_for_update().first()
        current = db.get(OrganizerContractVersion, payload.contract_id)
        if not current or current.status != "published" or current.sha256 != payload.digest:
            raise HTTPException(409, "contract_version_not_current")
        latest = contract_for(db, current.language)
        if not latest or latest.id != current.id or contract_digest(current.body) != current.sha256:
            raise HTTPException(409, "contract_version_not_current")
        existing = db.query(OrganizerContractAcceptance).filter(
            OrganizerContractAcceptance.owner_account_id == account.id,
            OrganizerContractAcceptance.contract_id == current.id).first()
        if existing:
            access_audit(db, request, account.id, account.id, "contract_already_accepted")
            return {"status": "already_accepted", "contract_id": current.id}
        db.add(OrganizerContractAcceptance(owner_account_id=account.id,
            signer_account_id=account.id, contract_id=current.id,
            contract_sha256=current.sha256, accepted_at=datetime.now(timezone.utc)))
        access_audit(db, request, account.id, account.id, "contract_accepted")
        return {"status": "accepted", "contract_id": current.id,
                "signature_method": "web_mfa_ack"}
