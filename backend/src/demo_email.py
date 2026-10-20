"""Durable transactional email notifications for the Crowdly Demo API.

Provider: Resend (https://api.resend.com/emails).
Requires EMAIL_NOTIFICATIONS_ENABLED=true, RESEND_API_KEY, and EMAIL_FROM
on the isolated Demo API. Never exposes credentials in API or logs.
"""
from __future__ import annotations

import base64
import hashlib
import html
import io
import json
import logging
import os
import threading
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import qrcode
from sqlalchemy import Column, DateTime, Integer, String, Text
from sqlalchemy.orm import Session

from db.base import Base

LOGGER = logging.getLogger("crowdly.demo_email")
PRAGUE = ZoneInfo("Europe/Prague")
MAX_ATTEMPTS = 8
MAX_EMAILS_PER_WORKER_CYCLE = 10

class EmailOutbox(Base):
    __tablename__ = "demo_email_outbox"
    id = Column(Integer, primary_key=True)
    event_key = Column(String(180), unique=True, nullable=False, index=True)
    kind = Column(String(32), nullable=False)
    recipient = Column(String(255), nullable=False)
    guest_id = Column(Integer, nullable=True)
    ticket_id = Column(Integer, nullable=True)
    language = Column(String(2), nullable=False, default="en")
    state = Column(String(20), nullable=False, default="pending", index=True)
    attempts = Column(Integer, nullable=False, default=0)
    next_attempt_at = Column(DateTime(timezone=True), nullable=False)
    last_error = Column(String(300), nullable=True)
    provider_email_id = Column(String(150), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    sent_at = Column(DateTime(timezone=True), nullable=True)


def enabled() -> bool:
    return os.getenv("EMAIL_NOTIFICATIONS_ENABLED", "false").lower().strip() in {"1", "true", "yes", "on"}


def configured() -> bool:
    sender = os.getenv("EMAIL_FROM", "").strip()
    return bool(enabled() and os.getenv("RESEND_API_KEY", "").strip() and "@" in sender)


def language_code(value: str | None) -> str:
    value = (value or "en").lower().split("-", 1)[0]
    return value if value in {"ru", "uk", "cs", "en"} else "en"


def queue_email(
    db: Session, *, kind: str, event_key: str, recipient: str | None,
    guest_id: int | None = None, ticket_id: int | None = None,
    language: str = "en",
) -> None:
    """Add to the caller's transaction: do NOT commit here.

    When disabled, no records are created; enabling email later will not
    unexpectedly send messages about past events.
    """
    if not configured() or not recipient:
        return
    if kind not in {"welcome", "ticket", "checkin"}:
        raise ValueError("unknown_email_kind")
    if kind in {"ticket", "checkin"}:
        # Only mail registered website accounts during the public demo.
        # Anonymous checkout emails are unverified and could be used for spam.
        from demo_accounts import WebAccount
        if guest_id is None or not db.query(WebAccount.id).filter(WebAccount.guest_id == guest_id).first():
            return
    recipient = recipient.strip().lower()
    if not recipient or len(recipient) > 255 or "@" not in recipient:
        return
    if db.query(EmailOutbox.id).filter(EmailOutbox.event_key == event_key).first():
        return
    db.add(EmailOutbox(
        event_key=event_key, recipient=recipient,
        guest_id=guest_id, ticket_id=ticket_id, kind=kind,
        language=language_code(language), state="pending",
        next_attempt_at=datetime.now(timezone.utc),
    ))


def ticket_language(db: Session, ticket_id: int) -> str:
    recent = (
        db.query(EmailOutbox.language)
        .filter(EmailOutbox.ticket_id == ticket_id, EmailOutbox.kind == "ticket")
        .order_by(EmailOutbox.id.desc())
        .first()
    )
    return recent[0] if recent else "en"


COPY = {
    "en": {
        "welcome_subject": "Welcome to Crowdly!",
        "welcome_title": "Welcome to Crowdly",
        "welcome_body": "Your Crowdly account is ready. Find events and keep your tickets in one place.",
        "ticket_subject": "Your Crowdly ticket: {event}",
        "ticket_title": "You're going to {event}!",
        "ticket_body": "Your demo booking is confirmed. Show this QR code at the entrance.",
        "checkin_subject": "Check-in confirmed: {event}",
        "checkin_title": "Check-in successful!",
        "checkin_body": "You've checked in successfully. Enjoy the event!",
        "event": "Event", "date": "Starts", "location": "Location", "number": "Ticket",
        "price": "Price", "button_ticket": "Open my ticket", "button_profile": "My profile",
        "demo": "DEMO — No real money was charged.", "footer": "This is an automatic Crowdly notification. Please do not reply.",
        "qr_fallback": "If you can't see the QR image, open your ticket using the button.",
    },
    "ru": {
        "welcome_subject": "Добро пожаловать в Crowdly!",
        "welcome_title": "Добро пожаловать в Crowdly",
        "welcome_body": "Твой аккаунт создан. Теперь можно выбирать мероприятия и хранить билеты в одном месте.",
        "ticket_subject": "Твой билет Crowdly: {event}",
        "ticket_title": "Ты записан на {event}!",
        "ticket_body": "Запись подтверждена. Покажи этот QR-код на входе.",
        "checkin_subject": "Check-in подтверждён: {event}",
        "checkin_title": "Check-in выполнен!",
        "checkin_body": "Отметка о посещении сохранена. Хорошего мероприятия!",
        "event": "Мероприятие", "date": "Начало", "location": "Место", "number": "Билет",
        "price": "Цена", "button_ticket": "Открыть билет", "button_profile": "Мой профиль",
        "demo": "ДЕМО — реальные деньги не списывались.", "footer": "Автоматическое письмо Crowdly. Не отвечай на него.",
        "qr_fallback": "Если QR-код не отображается, открой билет по кнопке.",
    },
    "cs": {
        "welcome_subject": "Vítej v Crowdly!",
        "welcome_title": "Vítej v Crowdly",
        "welcome_body": "Tvůj účet je připraven. Vyber si akci a měj všechny vstupenky na jednom místě.",
        "ticket_subject": "Tvoje vstupenka Crowdly: {event}",
        "ticket_title": "Jsi přihlášen/a na {event}!",
        "ticket_body": "Registrace je potvrzena. U vstupu ukaž tento QR kód.",
        "checkin_subject": "Check-in potvrzen: {event}",
        "checkin_title": "Check-in proběhl úspěšně!",
        "checkin_body": "Tvá účast je zaznamenána. Užij si akci!",
        "event": "Akce", "date": "Začátek", "location": "Místo", "number": "Vstupenka",
        "price": "Cena", "button_ticket": "Otevřít vstupenku", "button_profile": "Můj profil",
        "demo": "DEMO — žádné skutečné peníze nebyly strženy.", "footer": "Automatická zpráva Crowdly. Neodpovídej na ni.",
        "qr_fallback": "Pokud QR kód nevidíš, otevři si vstupenku pomocí tlačítka.",
    },
    "uk": {
        "welcome_subject": "Ласкаво просимо до Crowdly!",
        "welcome_title": "Ласкаво просимо до Crowdly",
        "welcome_body": "Твій акаунт створено. Тепер можна обирати події та зберігати квитки в одному місці.",
        "ticket_subject": "Твій квиток Crowdly: {event}",
        "ticket_title": "Ти записався на {event}!",
        "ticket_body": "Реєстрацію підтверджено. Покажи цей QR-код на вході.",
        "checkin_subject": "Check-in підтверджено: {event}",
        "checkin_title": "Check-in виконано!",
        "checkin_body": "Твою присутність зафіксовано. Приємної події!",
        "event": "Подія", "date": "Початок", "location": "Місце", "number": "Квиток",
        "price": "Ціна", "button_ticket": "Відкрити квиток", "button_profile": "Мій профіль",
        "demo": "ДЕМО — справжні гроші не списувались.", "footer": "Автоматичний лист Crowdly. Не відповідай на нього.",
        "qr_fallback": "Якщо QR-код не відображається, відкрий квиток за кнопкою.",
    },
}


def event_date(value: datetime | None) -> str:
    if value is None:
        return "—"
    local = value.replace(tzinfo=PRAGUE) if value.tzinfo is None else value.astimezone(PRAGUE)
    return local.strftime("%d.%m.%Y %H:%M") + " (Prague)"


def qr_attachment(qr_token: str, ticket_id: int) -> dict:
    image = qrcode.make(f"CROWDLY:TICKET:{qr_token}")
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return {
        "filename": f"crowdly-ticket-{ticket_id}.png",
        "content": base64.b64encode(buffer.getvalue()).decode("ascii"),
        "content_type": "image/png",
        "content_id": "crowdly-ticket-qr",
    }


def card(label: str, value: object) -> str:
    return (
        "<tr><td style='padding:10px 0;color:#705c78;font-size:13px;vertical-align:top'>"
        + html.escape(label) + "</td><td style='padding:10px 0;text-align:right;font-size:14px;"
        "font-weight:700;vertical-align:top'>" + html.escape(str(value or "—")) + "</td></tr>"
    )


def email_shell(title: str, lead: str, details: str, link: str, button: str, caption: str, footer: str) -> str:
    return (
        '<!doctype html><html><head><meta charset="UTF-8"></head>'
        '<body style="margin:0;padding:24px;background:#F6EEFA;font-family:Arial,Helvetica,sans-serif;color:#1E0A28">'
        '<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">'
        '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;background:#fff;'
        'border-radius:16px;overflow:hidden"><tr><td style="padding:26px 30px;background:#C2118A;color:#fff">'
        '<div style="font-size:30px;font-weight:900">crowdly <span style="color:#FFC82E">●</span></div></td></tr>'
        '<tr><td style="padding:30px"><h1 style="font-size:25px;margin:0 0 16px">'
        + html.escape(title) + '</h1><p style="font-size:15px;line-height:1.6;margin:0 0 20px">'
        + html.escape(lead) + '</p>'
        + details
        + ('<p style="margin:24px 0"><a href="' + html.escape(link, quote=True)
           + '" style="display:inline-block;background:#C2118A;color:#fff;text-decoration:none;'
           'padding:15px 23px;border-radius:32px;font-weight:bold">' + html.escape(button) + '</a></p>'
           if link else "")
        + ('<p style="font-size:12px;color:#6f526c">' + html.escape(caption) + '</p>' if caption else '')
        + '</td></tr><tr><td style="padding:22px 30px;background:#F6EEFA;color:#705c78;font-size:12px">'
        + html.escape(footer) + '</td></tr></table></td></tr></table></body></html>'
    )


def render_email(row: EmailOutbox, db: Session) -> dict | None:
    from demo_accounts import WebAccount

    d = COPY.get(row.language) or COPY["en"]
    web_url = (os.getenv("WEB_APP_URL", "").strip() or "https://frontend-production-81ea.up.railway.app").rstrip("/")
    extra = ""
    subject = ""
    title = ""
    lead = ""
    link = ""
    button = ""
    caption = ""
    attachments = []

    if row.kind == "welcome":
        account = db.query(WebAccount).filter(WebAccount.guest_id == row.guest_id).first()
        if account is None:
            return None
        subject, title, lead = d["welcome_subject"], d["welcome_title"], d["welcome_body"]
        link, button = f"{web_url}/profile", d["button_profile"]
    else:
        from importlib import import_module
        module = import_module("main")
        ticket = db.query(module.DemoTicket).filter(module.DemoTicket.id == row.ticket_id).first()
        if ticket is None:
            return None
        event = db.query(module.Event).filter(module.Event.id == ticket.event_id).first()
        if event is None:
            return None
        name = str(event.title or "Event")[:180]
        subject = d[f"{row.kind}_subject"].format(event=name)
        title = d[f"{row.kind}_title"].format(event=name)
        lead = d[f"{row.kind}_body"]
        link = f"{web_url}/tickets/{ticket.id}"
        button = d["button_ticket"]
        extra = (
            '<table role="presentation" style="width:100%;border-collapse:collapse;'
            'border-top:1px solid #E9D7F1;border-bottom:1px solid #E9D7F1">'
            + card(d["event"], name)
            + card(d["date"], event_date(event.starts_at))
            + card(d["location"], event.location or "—")
            + card(d["number"], f"CRD-{ticket.id:06d}")
            + card(d["price"], f"{ticket.payment_amount} {ticket.currency}")
            + '</table>'
        )
        if row.kind == "ticket":
            # No QR for cancelled tickets or reissued tickets (stale messages).
            if ticket.ticket_status != "active":
                return None
            # Event key includes the original QR token, so don't send an obsolete QR.
            if not row.event_key.endswith(hashlib.sha256(ticket.qr_token.encode()).hexdigest()[:20]):
                return None
            attachments.append(qr_attachment(ticket.qr_token, ticket.id))
            extra += (
                '<div style="margin:25px 0;text-align:center;background:#F6EEFA;padding:20px;border-radius:12px">'
                '<p style="font-weight:bold;margin:0 0 10px">CROWDLY PASS</p>'
                '<img alt="Ticket QR" width="220" height="220" style="max-width:100%;height:auto" '
                'src="cid:crowdly-ticket-qr"></div>'
            )
            caption = d["qr_fallback"] + " " + d["demo"]
        else:
            caption = d["demo"]

    return {
        "from": os.environ["EMAIL_FROM"].strip(),
        "to": [row.recipient],
        "subject": subject,
        "html": email_shell(title, lead, extra, link, button, caption, d["footer"]),
        "text": f"{title}\n\n{lead}\n\n{link}\n\n{caption}",
        **({"attachments": attachments} if attachments else {}),
    }


def _send_resend(payload: dict, unique_key: str) -> str:
    api_key = os.environ["RESEND_API_KEY"].strip()
    body = json.dumps(payload).encode("utf-8")
    headers = {
        "Authorization": "Bearer " + api_key,
        "Content-Type": "application/json",
        "Idempotency-Key": "crowdly-" + hashlib.sha256(unique_key.encode()).hexdigest()[:48],
    }
    req = urllib.request.Request(
        "https://api.resend.com/emails", data=body, headers=headers, method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=12) as response:
            data = json.loads(response.read(12000).decode("utf-8"))
            return str(data.get("id") or "")
    except urllib.error.HTTPError as exc:
        # No sensitive message contents/API credentials in logs.
        raise EmailDeliveryError(f"resend_http_{exc.code}", exc.code in {400, 401, 403, 422}) from None
    except (urllib.error.URLError, TimeoutError, ValueError) as exc:
        raise EmailDeliveryError(type(exc).__name__, False) from None


class EmailDeliveryError(Exception):
    def __init__(self, code: str, permanent: bool):
        super().__init__(code)
        self.permanent = permanent


def _deliver_one(db: Session) -> bool:
    now = datetime.now(timezone.utc)
    row = (
        db.query(EmailOutbox)
        .filter(
            EmailOutbox.state == "pending",
            EmailOutbox.attempts < MAX_ATTEMPTS,
            EmailOutbox.next_attempt_at <= now,
        )
        .order_by(EmailOutbox.id.asc())
        .with_for_update(skip_locked=True)
        .first()
    )
    if row is None:
        return False

    row.attempts += 1
    try:
        payload = render_email(row, db)
        if payload is None:
            row.state = "skipped"
        else:
            row.provider_email_id = _send_resend(payload, row.event_key)
            row.state = "sent"
            row.sent_at = datetime.now(timezone.utc)
            row.last_error = None
    except EmailDeliveryError as exc:
        row.last_error = str(exc)[:300]
        if exc.permanent or row.attempts >= MAX_ATTEMPTS:
            row.state = "failed"
        else:
            row.next_attempt_at = now + timedelta(seconds=min(60 * 60, 15 * 2 ** (row.attempts - 1)))
        LOGGER.warning("Email outbox #%s delivery attempt %s: %s", row.id, row.attempts, str(exc))
    except Exception:
        row.last_error = "render_or_provider_error"
        if row.attempts >= MAX_ATTEMPTS:
            row.state = "failed"
        else:
            row.next_attempt_at = now + timedelta(minutes=3)
        LOGGER.exception("Email outbox #%s failed (unexpected)", row.id)
    db.commit()
    return True


_started = False
_start_lock = threading.Lock()


def install_email_worker(app, session_factory) -> None:
    @app.on_event("startup")
    def start_demo_email_worker() -> None:
        global _started
        if not configured() or os.getenv("DEMO_ISOLATED_API", "false").lower() != "true":
            LOGGER.info("Demo email notifications disabled or not configured.")
            return
        with _start_lock:
            if _started:
                return
            _started = True

        def run():
            LOGGER.info("Crowdly email outbox worker started.")
            while True:
                try:
                    for _ in range(MAX_EMAILS_PER_WORKER_CYCLE):
                        with session_factory() as db:
                            if not _deliver_one(db):
                                break
                except Exception:
                    LOGGER.exception("Email worker cycle error")
                time.sleep(8)

        threading.Thread(target=run, name="crowdly-email-outbox", daemon=True).start()
