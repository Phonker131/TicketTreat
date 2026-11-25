"""Private operational alerts for verified, Telegram-linked TicketTreat global admins.

Only staff with BOTH verified email and a signed Telegram-to-web account link
are eligible. Alert payloads contain no customer text or contact information;
admins follow an authenticated MFA-protected URL to see the details.

Uses the existing durable Telegram notification outbox (event_id=0 means
administrative alert) with transactional enqueueing, uniqueness and retries.
"""
from __future__ import annotations

import html
import logging
import os
from datetime import datetime, timezone

from sqlalchemy.orm import Session

LOG = logging.getLogger("tickettreat.admin_telegram_alerts")
KINDS = {"admin_organizer", "admin_support_new", "admin_support_reply", "admin_security"}


def linked_global_admins(db: Session, telegram_id: int | None = None) -> list[tuple[int, int]]:
    """Resolve verified role and signed Telegram linkage; never trust user-supplied IDs."""
    from demo_accounts import WebAccount
    from demo_telegram import DemoTelegramIdentity
    from demo_roles import role_for
    from demo_account_recovery import email_is_verified

    query = (db.query(WebAccount, DemoTelegramIdentity.telegram_id)
             .join(DemoTelegramIdentity, WebAccount.guest_id == DemoTelegramIdentity.guest_id)
             .filter(WebAccount.email.isnot(None)))
    if telegram_id is not None:
        query = query.filter(DemoTelegramIdentity.telegram_id == telegram_id)
    recipients = []
    for account, linked_tg_id in query.all():
        if role_for(db, account) == "global_admin" and email_is_verified(db, account.id):
            recipients.append((account.id, int(linked_tg_id)))
    return recipients


def enqueue_admin_alert(db: Session, *, kind: str, object_id: int,
                        notification_id: int, occurrence: str = "") -> int:
    """Queue one alert per linked global admin in the caller's DB transaction.

    For support, notification_id is the customer message ID. For an organizer
    application, it is the applicant ID and occurrence identifies a new/reopened
    application. No message body or sensitive applicant data is stored.
    """
    if kind not in KINDS or object_id <= 0 or notification_id <= 0:
        raise ValueError("invalid_admin_alert")
    from demo_telegram_notifications import configured, _insert_rows
    if not configured():
        LOG.warning("Admin Telegram alerts disabled: bot token not configured")
        return 0
    admins = linked_global_admins(db)
    if not admins:
        LOG.warning("Admin Telegram alert has no verified Telegram-linked global-admin recipients")
        return 0
    now = datetime.now(timezone.utc)
    nonce = f":{occurrence}" if occurrence else ""
    rows = [{
        "event_key": f"tg:{kind}:{notification_id}{nonce}:{tg_id}",
        "kind": kind,
        "telegram_id": tg_id,
        "event_id": 0,  # Admin alerts never belong to a public event.
        "notice_id": notification_id,
        "language": "en",
        "state": "pending",
        "attempts": 0,
        "next_attempt_at": now,
    } for _account_id, tg_id in admins]
    _insert_rows(db, rows)
    return len(rows)


def render_admin_alert(db: Session, row) -> tuple[str, dict] | None:
    """Recheck admin access and source object immediately before delivery.

    Prevents notifying former admins and never includes ticket bodies or private
    contact data in the Telegram message or in a URL.
    """
    from demo_roles import OrganizerApplication
    from demo_support import SupportTicket, SupportMessage
    from demo_accounts import WebAccount

    if row.kind not in KINDS or row.event_id != 0 or row.notice_id is None:
        return None
    admins = linked_global_admins(db, int(row.telegram_id))
    if not admins:
        return None
    if row.kind == "admin_security":
        from demo_security_alerts import render_security_alert
        from demo_account_bans import active_ban
        if active_ban(db, admins[0][0]) is not None:
            return None
        return render_security_alert(db, row.notice_id)
    lang = "cs" if row.language == "cs" else "en"
    website = (os.getenv("WEB_APP_URL", "").strip().rstrip("/") or "https://tickettreat.eu")
    if not website.startswith("https://"):
        website = "https://tickettreat.eu"

    if row.kind == "admin_organizer":
        application = db.get(OrganizerApplication, row.notice_id)
        account = db.get(WebAccount, row.notice_id)
        if application is None or account is None or application.status != "pending":
            return None
        heading = "🧑‍💼 Nová žádost o organizátorský účet" if lang == "cs" else "🧑‍💼 New organizer application"
        label = "Otevřít žádosti" if lang == "cs" else "Review applications"
        text = f"<b>{heading}</b>\nID účtu: #{account.id}" if lang == "cs" else f"<b>{heading}</b>\nAccount #{account.id}"
        link = f"{website}/admin/organizers"
    else:
        message = db.get(SupportMessage, row.notice_id)
        ticket = db.get(SupportTicket, message.ticket_id) if message else None
        if (message is None or message.author_role != "customer"
                or ticket is None or ticket.account_id != message.author_account_id):
            return None
        # No customer-provided subject, content, email or contact is sent through Telegram.
        if row.kind == "admin_support_new":
            heading = "🆘 Nový požadavek na podporu" if lang == "cs" else "🆘 New support ticket"
        else:
            heading = "💬 Nová odpověď od zákazníka" if lang == "cs" else "💬 New customer support reply"
        label = "Otevřít podporu" if lang == "cs" else "Open support inbox"
        text = f"<b>{heading}</b>\n#{ticket.id}"
        link = f"{website}/admin/support?ticket={ticket.id}"
    return text, {"inline_keyboard": [[{"text": html.escape(label), "url": link}]]}
