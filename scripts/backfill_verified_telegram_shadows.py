"""Create canonical web principal for previously signed Telegram-only guests.

This operation NEVER merges people, changes guest_id, transfers QR tickets,
claims emails, or modifies old Bot registrations. It only materializes a
participant-role WebAccount and one verified Telegram registry claim for an
existing DEMO TELEGRAM IDENTITY mapping, which was created by signed Telegram
initData/OIDC proof.

Dry run by default. Real write requires verified offsite restore, an approved
operator opt-in and feature-gated ledger mirror mode.
"""
from __future__ import annotations

import argparse
import json
import os
import sys

from sqlalchemy import func

# Import only after the explicit environment guard below.
from audit_auth_identities import audit


def run(database_url: str, *, apply: bool) -> dict:
    if not database_url.startswith(("postgresql://", "postgresql+psycopg2://")):
        raise RuntimeError("PostgreSQL-only operation")
    baseline = audit(database_url)
    if not baseline["safe_to_backfill"]:
        raise RuntimeError("identity_preflight_blocked")
    if not apply:
        return {
            "status":"dry_run_only",
            "eligible_verified_telegram_guests":int(baseline["telegram_guests_without_web_account"]),
        }

    if os.environ.get("TICKETTREAT_IDENTITY_REGISTRY_MODE") != "shadow":
        raise RuntimeError("verified_identity_shadow_mode_required")

    import main
    from db.session import SessionLocal
    from demo_accounts import AuthIdentity, WebAccount
    from demo_telegram import DemoTelegramIdentity
    from demo_telegram_oidc import ensure_telegram_web_account

    with SessionLocal() as db:
        try:
            rows = (db.query(DemoTelegramIdentity)
                .outerjoin(WebAccount, WebAccount.guest_id == DemoTelegramIdentity.guest_id)
                .filter(WebAccount.id.is_(None))
                .order_by(DemoTelegramIdentity.telegram_id)
                .all())
            # Compare actual owner/ticket reference counts inside this TX.
            before_tickets = db.query(func.count(main.DemoTicket.id)).scalar()
            before_legacy = db.query(func.count(main.Registration.id)).scalar()
            created = 0
            for identity in rows:
                guest = db.get(main.DemoGuest, identity.guest_id)
                if guest is None:
                    raise RuntimeError("orphan_telegram_mapping_requires_manual_resolution")
                # Historical provider link is independently verified; a
                # guest's unverified email/name alone would not qualify.
                account = ensure_telegram_web_account(
                    db,main.DemoGuest,{
                        "id":int(identity.telegram_id),
                        "given_name":guest.first_name or "Telegram user",
                        "family_name":guest.last_name or "",
                        "preferred_username":guest.username or "",
                    },commit=False,reconcile=False,
                )
                if account.guest_id != guest.id or account.email is not None:
                    raise RuntimeError("historical_guest_owner_changed")
                if (db.query(AuthIdentity.id)
                    .filter(AuthIdentity.provider=="telegram",
                            AuthIdentity.provider_subject==str(identity.telegram_id),
                            AuthIdentity.account_id==account.id).first() is None):
                    raise RuntimeError("verified_telegram_ledger_claim_missing")
                created+=1
            if db.query(func.count(main.DemoTicket.id)).scalar()!=before_tickets:
                raise RuntimeError("ticket_count_changed_aborting")
            if db.query(func.count(main.Registration.id)).scalar()!=before_legacy:
                raise RuntimeError("bot_registration_count_changed_aborting")
            db.commit()
        except Exception:
            db.rollback()
            raise

    after=audit(database_url)
    if after["telegram_guests_without_web_account"] != 0:
        raise RuntimeError("remaining_telegram_guest_mappings_require_manual_review")
    if not after["safe_to_backfill"]:
        raise RuntimeError("post_backfill_identity_audit_failed")
    return {
        "status":"verified_telegram_shadows_created",
        "created":created,
        "remaining_verified_telegram_guests_without_account":0,
        "ticket_rows_modified":0,
        "legacy_registration_rows_modified":0,
    }


def main_cli() -> int:
    parser=argparse.ArgumentParser()
    parser.add_argument("--apply",action="store_true")
    parser.add_argument("--confirmed-restored-backup",action="store_true")
    args=parser.parse_args()
    try:
        url=os.getenv("DATABASE_URL","")
        if args.apply and (not args.confirmed_restored_backup
                or os.getenv("TICKETTREAT_TELEGRAM_SHADOW_BACKFILL_APPROVED")!="YES"):
            raise RuntimeError("explicit_approval_and_restore_confirmation_required")
        result=run(url,apply=args.apply)
        print(json.dumps(result,sort_keys=True))
        return 0
    except Exception as exc:
        # Never print DB URLs, Telegram IDs, email addresses or secrets.
        print("Telegram shadow backfill blocked: "+type(exc).__name__,file=sys.stderr)
        return 1


if __name__=="__main__":
    raise SystemExit(main_cli())
