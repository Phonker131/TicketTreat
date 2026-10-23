"""Durable transactional email notifications for the TicketTreat Demo API.

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

LOGGER = logging.getLogger("tickettreat.demo_email")
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
    notice_id = Column(Integer, nullable=True)
    language = Column(String(2), nullable=False, default="en")
    state = Column(String(20), nullable=False, default="pending", index=True)
    attempts = Column(Integer, nullable=False, default=0)
    next_attempt_at = Column(DateTime(timezone=True), nullable=False)
    last_error = Column(String(300), nullable=True)
    provider_email_id = Column(String(150), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    sent_at = Column(DateTime(timezone=True), nullable=True)


class EventNotice(Base):
    """Operational event change/cancellation notice, not marketing outreach."""
    __tablename__ = "demo_event_notices"
    id = Column(Integer, primary_key=True)
    event_id = Column(Integer, nullable=False, index=True)
    kind = Column(String(20), nullable=False)
    message = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False,
                        default=lambda: datetime.now(timezone.utc))


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
    notice_id: int | None = None,
    language: str = "en", scheduled_at: datetime | None = None,
) -> None:
    """Add to the caller's transaction: do NOT commit here.

    When disabled, no records are created; enabling email later will not
    unexpectedly send messages about past events.
    """
    if not configured() or not recipient:
        return
    if kind not in {"welcome", "ticket", "checkin", "reminder", "event_notice", "waitlist_offer", "broadcast_notice"}:
        raise ValueError("unknown_email_kind")
    if kind in {"ticket", "checkin", "reminder", "event_notice", "waitlist_offer"}:
        # Only mail registered website accounts during the public demo.
        # Anonymous checkout emails are unverified and could be used for spam.
        from demo_accounts import WebAccount
        if guest_id is None or not db.query(WebAccount.id).filter(WebAccount.guest_id == guest_id).first():
            return
    recipient = recipient.strip().lower()
    if not recipient or len(recipient) > 255 or "@" not in recipient:
        return
    prior = db.query(EmailOutbox).filter(EmailOutbox.event_key == event_key).first()
    if prior:
        # Rescheduling may revive a previously suppressed reminder. Never
        # resend messages already sent or retry permanently failed delivery.
        if kind == "reminder" and prior.state == "skipped":
            prior.state = "pending"
            prior.attempts = 0
            prior.next_attempt_at = scheduled_at or datetime.now(timezone.utc)
            prior.last_error = None
        return
    db.add(EmailOutbox(
        event_key=event_key, recipient=recipient,
        guest_id=guest_id, ticket_id=ticket_id, notice_id=notice_id, kind=kind,
        language=language_code(language), state="pending",
        next_attempt_at=scheduled_at or datetime.now(timezone.utc),
    ))


def queue_event_reminder(db: Session, *, event, guest, ticket, language: str = "en") -> None:
    """Queue configured intervals (default 7d, 24h, 3h) for verified holders.

    Deduplication keys contain the ticket, event time and interval; old
    bookings do not trigger retrospective blasts.
    """
    if not configured() or event.starts_at is None:
        return
    from demo_accounts import WebAccount
    from demo_account_recovery import email_is_verified
    account = db.query(WebAccount).filter(WebAccount.guest_id == guest.id).first()
    if not account or not email_is_verified(db, account.id):
        return
    start = event.starts_at
    # Legacy event timestamps are venue-local Europe/Prague, never UTC.
    start = start.replace(tzinfo=PRAGUE) if start.tzinfo is None else start.astimezone(PRAGUE)
    start = start.astimezone(timezone.utc)
    current = datetime.now(timezone.utc)
    # Custom 30/45 minute reminders remain valid for late registrations
    # provided their delivery window is still in the future.
    if start <= current + timedelta(minutes=15):
        return
    from demo_pilot_ops import effective_settings
    for minutes in effective_settings(db, event.id)["reminder_minutes"]:
        intended = start - timedelta(minutes=minutes)
        # Never send missed reminders shortly after a late registration.
        if intended <= current + timedelta(minutes=15):
            continue
        queue_email(db, kind="reminder",
            event_key=f"reminder:{ticket.id}:{int(start.timestamp())}:{minutes}",
            recipient=account.email, guest_id=guest.id, ticket_id=ticket.id,
            language=language, scheduled_at=intended)


def queue_event_notice(db:Session, *, event, kind:str, message:str) -> int:
    """Queue event-critical changes only for verified account holders with tickets.

    Called inside the organizer's same transaction before tickets are cancelled.
    Never emails legacy guest addresses or unverified user-provided emails.
    """
    if kind not in {"change","cancel","announcement"}:
        raise ValueError("unsupported_operational_notice")
    if not configured():
        return 0
    from demo_accounts import WebAccount
    from demo_account_recovery import email_is_verified
    from importlib import import_module
    main=import_module("main")
    tickets=db.query(main.DemoTicket).filter(
        main.DemoTicket.event_id==event.id,
        main.DemoTicket.ticket_status=="active",
    ).all()
    recipients=[]
    for ticket in tickets:
        account=db.query(WebAccount).filter(WebAccount.guest_id==ticket.guest_id).first()
        if account and email_is_verified(db,account.id):
            recipients.append((ticket,account))
    if not recipients:
        return 0
    notice=EventNotice(event_id=event.id,kind=kind,message=message[:1500])
    db.add(notice);db.flush()
    for ticket,account in recipients:
        queue_email(db,kind="event_notice",
                    event_key=f"notice:{notice.id}:ticket:{ticket.id}",
                    recipient=account.email,guest_id=ticket.guest_id,
                    ticket_id=ticket.id,notice_id=notice.id,
                    language=ticket_language(db,ticket.id))
    return len(recipients)


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
        "change_subject": "Important update to your event — {event}", "change_body": "We would like to let you know that the organizer has updated this event. Please review the details below before attending.",
        "cancel_subject": "Event cancellation — {event}", "cancel_body": "We regret to inform you that the organizer has cancelled this event. We apologize for any inconvenience.",
        "welcome_subject": "Welcome to TicketTreat — your account is ready",
        "welcome_title": "Welcome to TicketTreat",
        "welcome_body": "Thank you for joining TicketTreat. Your account is ready. You can now discover events and manage your tickets in one convenient place.",
        "ticket_subject": "Your registration is confirmed — {event}",
        "ticket_title": "Your ticket is ready",
        "ticket_body": "Thank you for registering. Your place has been confirmed. Please keep your ticket and present the QR code at the entrance.",
        "reminder_subject": "Reminder about your upcoming event — {event}",
        "reminder_title": "Your event is coming up",
        "reminder_body": "We would like to remind you about your upcoming event. Please check the starting time and have your ticket ready.",
        "checkin_subject": "Entry confirmed — {event}",
        "checkin_title": "Your entry is confirmed",
        "checkin_body": "Your ticket has been successfully checked at the entrance. Thank you, and we hope you enjoy the event.",
        "event": "Event", "date": "Date and time", "location": "Venue", "number": "Ticket number",
        "price": "Ticket price", "button_ticket": "View my ticket", "button_profile": "Open my account",
        "demo": "Test mode: no real payment has been charged.", "footer": "This is an automated service message from TicketTreat. If you need assistance, please contact our support team.",
        "qr_fallback": "If the QR code does not display, you can open your ticket using the button above.",
    },
    "ru": {
        "change_subject": "Изменения в мероприятии — {event}", "change_body": "Сообщаем, что организатор обновил информацию о мероприятии. Пожалуйста, ознакомьтесь с изменениями перед посещением.",
        "cancel_subject": "Отмена мероприятия — {event}", "cancel_body": "К сожалению, организатор отменил данное мероприятие. Приносим извинения за возможные неудобства.",
        "welcome_subject": "Добро пожаловать в TicketTreat — аккаунт создан",
        "welcome_title": "Добро пожаловать в TicketTreat",
        "welcome_body": "Благодарим вас за регистрацию в TicketTreat. Ваш аккаунт создан. Теперь вы можете находить интересные мероприятия и управлять билетами в одном месте.",
        "ticket_subject": "Ваша регистрация подтверждена — {event}",
        "ticket_title": "Ваш билет готов",
        "ticket_body": "Благодарим за регистрацию! Ваше место подтверждено. Пожалуйста, сохраните билет и предъявите QR-код при входе.",
        "reminder_subject": "Напоминание о мероприятии — {event}",
        "reminder_title": "Ваше мероприятие скоро начнётся",
        "reminder_body": "Напоминаем о предстоящем мероприятии. Пожалуйста, проверьте время начала и подготовьте билет.",
        "checkin_subject": "Подтверждение входа — {event}",
        "checkin_title": "Вход успешно подтверждён",
        "checkin_body": "Ваш билет успешно проверен на входе. Благодарим вас и желаем приятного мероприятия!",
        "event": "Мероприятие", "date": "Дата и время", "location": "Место проведения", "number": "Номер билета",
        "price": "Стоимость", "button_ticket": "Открыть мой билет", "button_profile": "Перейти в профиль",
        "demo": "Тестовый режим: реальные средства не списывались.", "footer": "Это автоматическое служебное письмо TicketTreat. Если вам нужна помощь, обратитесь в нашу службу поддержки.",
        "qr_fallback": "Если QR-код не отображается, откройте билет с помощью кнопки выше.",
    },
    "cs": {
        "change_subject": "Změna informací o akci — {event}", "change_body": "Rádi bychom Vás informovali, že pořadatel aktualizoval údaje o této akci. Před návštěvou si prosím změny zkontrolujte.",
        "cancel_subject": "Zrušení akce — {event}", "cancel_body": "Je nám líto, ale pořadatel tuto akci zrušil. Omlouváme se za případné komplikace.",
        "welcome_subject": "Vítejte v TicketTreat — Váš účet je připraven",
        "welcome_title": "Vítejte v TicketTreat",
        "welcome_body": "Děkujeme za registraci do TicketTreat. Váš účet je připraven. Nyní můžete objevovat akce a spravovat všechny své vstupenky na jednom místě.",
        "ticket_subject": "Vaše registrace je potvrzena — {event}",
        "ticket_title": "Vaše vstupenka je připravena",
        "ticket_body": "Děkujeme za registraci. Vaše místo je potvrzeno. Vstupenku si prosím uschovejte a při vstupu předložte QR kód.",
        "reminder_subject": "Připomenutí nadcházející akce — {event}",
        "reminder_title": "Vaše akce se blíží",
        "reminder_body": "Dovolujeme si Vám připomenout nadcházející akci. Zkontrolujte si prosím čas začátku a připravte si vstupenku.",
        "checkin_subject": "Potvrzení vstupu — {event}",
        "checkin_title": "Váš vstup byl potvrzen",
        "checkin_body": "Vaše vstupenka byla úspěšně ověřena při vstupu. Děkujeme a přejeme Vám příjemný zážitek.",
        "event": "Akce", "date": "Datum a čas", "location": "Místo konání", "number": "Číslo vstupenky",
        "price": "Cena vstupenky", "button_ticket": "Zobrazit vstupenku", "button_profile": "Přejít do profilu",
        "demo": "Testovací režim: nedošlo ke skutečné platbě.", "footer": "Toto je automatické servisní sdělení TicketTreat. Pokud potřebujete pomoc, obraťte se prosím na naši podporu.",
        "qr_fallback": "Pokud se QR kód nezobrazuje, vstupenku otevřete pomocí tlačítka výše.",
    },
    "uk": {
        "change_subject": "Зміни в події — {event}", "change_body": "Повідомляємо, що організатор оновив інформацію про цю подію. Будь ласка, ознайомтеся зі змінами перед відвідуванням.",
        "cancel_subject": "Скасування події — {event}", "cancel_body": "На жаль, організатор скасував цю подію. Перепрошуємо за можливі незручності.",
        "welcome_subject": "Вітаємо в TicketTreat — ваш акаунт створено",
        "welcome_title": "Вітаємо в TicketTreat",
        "welcome_body": "Дякуємо за реєстрацію в TicketTreat. Ваш акаунт створено. Тепер ви можете знаходити цікаві події та керувати квитками в одному місці.",
        "ticket_subject": "Вашу реєстрацію підтверджено — {event}",
        "ticket_title": "Ваш квиток готовий",
        "ticket_body": "Дякуємо за реєстрацію! Ваше місце підтверджено. Будь ласка, збережіть квиток і покажіть QR-код на вході.",
        "reminder_subject": "Нагадування про майбутню подію — {event}",
        "reminder_title": "Ваша подія незабаром",
        "reminder_body": "Нагадуємо про майбутню подію. Будь ласка, перевірте час початку та підготуйте квиток.",
        "checkin_subject": "Підтвердження входу — {event}",
        "checkin_title": "Ваш вхід підтверджено",
        "checkin_body": "Ваш квиток успішно перевірено на вході. Дякуємо та бажаємо приємної події!",
        "event": "Подія", "date": "Дата й час", "location": "Місце проведення", "number": "Номер квитка",
        "price": "Вартість", "button_ticket": "Відкрити квиток", "button_profile": "Перейти до профілю",
        "demo": "Тестовий режим: справжні кошти не списувалися.", "footer": "Це автоматичний службовий лист TicketTreat. Якщо вам потрібна допомога, зверніться до нашої підтримки.",
        "qr_fallback": "Якщо QR-код не відображається, відкрийте квиток за допомогою кнопки вище.",
    },
}


def event_date(value: datetime | None) -> str:
    if value is None:
        return "—"
    local = value.replace(tzinfo=PRAGUE) if value.tzinfo is None else value.astimezone(PRAGUE)
    return local.strftime("%d.%m.%Y %H:%M") + " (Prague)"


def qr_attachment(qr_token: str, ticket_id: int) -> dict:
    image = qrcode.make(f"TICKETTREAT:TICKET:{qr_token}")
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return {
        "filename": f"tickettreat-ticket-{ticket_id}.png",
        "content": base64.b64encode(buffer.getvalue()).decode("ascii"),
        "content_type": "image/png",
        "content_id": "tickettreat-ticket-qr",
    }


def card(label: str, value: object) -> str:
    """Readable, accessible ticket detail row with safely escaped values."""
    actual = str(value if value is not None and value != "" else "—")
    return (
        '<tr><td style="padding:12px 10px 12px 0;color:#5C5861;font-size:13px;'
        'line-height:1.5;vertical-align:top;border-bottom:1px solid #E6DFD1">'
        + html.escape(label) + '</td><td style="padding:12px 0 12px 10px;'
        'text-align:right;color:#15141F;font-size:14px;font-weight:700;'
        'line-height:1.5;vertical-align:top;overflow-wrap:anywhere;'
        'border-bottom:1px solid #E6DFD1">' + html.escape(actual) + '</td></tr>'
    )


def email_shell(title: str, lead: str, details: str, link: str, button: str, caption: str, footer: str, language: str = "en") -> str:
    """Professional, mobile-friendly TicketTreat email with inline styles.

    Variable prose is escaped; details must be built only by trusted renderers.
    The visual identity uses the current cream, tomato, mustard and ink colors.
    """
    locale = language_code(language)
    ui = {
        "en": ("If the button does not open, copy this link: ", "Support", "SERVICE NOTIFICATION"),
        "cs": ("Pokud tlačítko nefunguje, zkopírujte tento odkaz: ", "Podpora", "SERVISNÍ OZNÁMENÍ"),
        "ru": ("Если кнопка не работает, скопируйте эту ссылку: ", "Поддержка", "СЛУЖЕБНОЕ УВЕДОМЛЕНИЕ"),
        "uk": ("Якщо кнопка не працює, скопіюйте це посилання: ", "Підтримка", "СЛУЖБОВЕ СПОВІЩЕННЯ"),
    }[locale]
    heading = html.escape(title)
    paragraph = html.escape(lead).replace("\n", "<br>")
    preheader = html.escape((lead.splitlines()[0] if lead else title)[:140])
    button_html = ""
    if link:
        href = html.escape(link, quote=True)
        button_html = (
            '<table role="presentation" cellpadding="0" cellspacing="0" border="0"'
            ' style="margin:28px 0 14px"><tr><td bgcolor="#FF5533"'
            ' style="border:2px solid #15141F;border-radius:10px">'
            '<a href="' + href + '" style="display:inline-block;'
            'padding:14px 24px;color:#15141F;font-size:15px;font-weight:700;'
            'text-decoration:none;border-radius:10px">' + html.escape(button)
            + '</a></td></tr></table>'
            '<p style="margin:0;font-size:12px;line-height:1.65;color:#5C5861;'
            'overflow-wrap:anywhere">' + html.escape(ui[0])
            + '<a href="' + href + '" style="color:#15141F;overflow-wrap:anywhere">'
            + href + '</a></p>'
        )
    note = (
        '<p style="color:#5C5861;font-size:13px;line-height:1.65;margin:22px 0 0">'
        + html.escape(caption) + '</p>' if caption else ''
    )
    return f"""<!doctype html>
<html lang="{locale}"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><title>{heading}</title></head>
<body style="margin:0;padding:0;background:#F0EBE1;font-family:Arial,Helvetica,sans-serif;color:#15141F">
<div style="display:none;font-size:1px;color:#F0EBE1;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">{preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#F0EBE1">
<tr><td align="center" style="padding:24px 12px 32px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#FFFFFF;border:2px solid #15141F;border-radius:14px;overflow:hidden">
<tr><td style="padding:22px 28px;background:#F0EBE1;border-bottom:2px solid #15141F">
<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
<td style="font-size:22px;font-weight:900;letter-spacing:-0.8px;color:#15141F">TICKET</td>
<td style="background:#F4B400;color:#15141F;font-size:20px;font-weight:900;letter-spacing:-0.8px;border:2px solid #15141F;border-radius:4px;padding:5px 9px">TREAT</td>
</tr></table></td></tr>
<tr><td style="padding:34px 28px 28px">
<p style="font-size:11px;letter-spacing:1.4px;font-weight:700;color:#5C5861;margin:0 0 14px">TICKETTREAT / {html.escape(ui[2])}</p>
<h1 style="font-size:27px;line-height:1.28;letter-spacing:-0.5px;margin:0 0 17px;color:#15141F">{heading}</h1>
<p style="font-size:16px;line-height:1.7;color:#302D37;margin:0 0 22px">{paragraph}</p>
{details}
{button_html}
{note}
</td></tr>
<tr><td style="background:#F0EBE1;border-top:2px solid #15141F;padding:22px 28px">
<p style="font-size:12px;line-height:1.7;color:#5C5861;margin:0 0 12px">{html.escape(footer)}</p>
<p style="font-size:12px;line-height:1.6;margin:0">
<a href="https://tickettreat.eu" style="font-weight:700;color:#15141F;text-decoration:underline">tickettreat.eu</a>
<span style="color:#5C5861"> &nbsp;·&nbsp; </span>
<a href="https://t.me/vvladver" style="font-weight:700;color:#15141F;text-decoration:underline">{html.escape(ui[1])}</a>
</p></td></tr></table></td></tr></table>
</body></html>"""



def render_email(row: EmailOutbox, db: Session) -> dict | None:
    from demo_accounts import WebAccount

    d = COPY.get(row.language) or COPY["en"]
    web_url = (os.getenv("WEB_APP_URL", "").strip() or "https://tickettreat.eu").rstrip("/")
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
    elif row.kind == "broadcast_notice":
        from demo_broadcast import render_broadcast_email
        return render_broadcast_email(row, db)
    elif row.kind == "waitlist_offer":
        from demo_waitlist_offers import WaitlistOffer, utc
        from importlib import import_module
        module = import_module("main")
        try:
            waitlist_id = int(row.event_key.split(":")[1])
        except (IndexError,ValueError):
            return None
        offer = db.query(WaitlistOffer).filter(
            WaitlistOffer.waitlist_id == waitlist_id).first()
        if not offer or offer.status != "offered" or utc(offer.expires_at) <= datetime.now(timezone.utc):
            return None
        event = db.get(module.Event,offer.event_id)
        if not event or event.is_cancelled:
            return None
        labels = {
            "en": ("A place opened up: {event}", "A place is reserved for you",
                   "Claim your free ticket before the offer expires.", "Claim free ticket"),
            "ru": ("Освободилось место: {event}", "Для вас зарезервировано место",
                   "Подтвердите бесплатный билет до истечения срока предложения.", "Получить билет"),
            "cs": ("Uvolnilo se místo: {event}", "Místo je pro vás rezervováno",
                   "Potvrďte bezplatnou vstupenku před vypršením nabídky.", "Potvrdit místo"),
            "uk": ("Звільнилося місце: {event}", "Місце зарезервовано для вас",
                   "Підтвердіть безкоштовний квиток до завершення пропозиції.", "Отримати квиток"),
        }
        template=labels.get(row.language,labels["en"])
        subject=template[0].format(event=str(event.title or "Event")[:180])
        title,lead,button=template[1],template[2],template[3]
        extra=card("Deadline (UTC)", utc(offer.expires_at).strftime("%Y-%m-%d %H:%M UTC"))
        link=f"{web_url}/checkout/{event.id}?offer=1"
    else:
        from importlib import import_module
        module = import_module("main")
        ticket = db.query(module.DemoTicket).filter(module.DemoTicket.id == row.ticket_id).first()
        if ticket is None:
            return None
        event = db.query(module.Event).filter(module.Event.id == ticket.event_id).first()
        if event is None:
            return None
        if row.kind == "reminder" and (ticket.ticket_status != "active" or event.is_cancelled or event.starts_at is None):
            return None
        name = str(event.title or "Event")[:180]
        if row.kind == "event_notice":
            notice = db.get(EventNotice, row.notice_id)
            if notice is None or notice.event_id != event.id or notice.kind not in {"change","cancel","announcement"}:
                return None
            if notice.kind == "announcement":
                subject = {
                    "ru":"Важная информация: {event}",
                    "cs":"Důležité informace: {event}",
                    "uk":"Важлива інформація: {event}",
                    "en":"Important event information: {event}",
                }[row.language if row.language in {"ru","cs","uk","en"} else "en"].format(event=name)
                title=subject
                lead=notice.message
            else:
                subject=d[f"{notice.kind}_subject"].format(event=name)
                title=subject
                lead=d[f"{notice.kind}_body"]+"\n"+notice.message
        else:
            subject = d[f"{row.kind}_subject"].format(event=name)
            title = d[f"{row.kind}_title"].format(event=name)
            lead = d[f"{row.kind}_body"]
            if row.kind == "reminder":
                # Organizer-authored operational instructions replace the
                # generic reminder body. email_shell escapes untrusted text.
                organizer_message = (getattr(event, "reminder_text", None) or "").strip()
                if organizer_message:
                    lead = organizer_message
                try:
                    minutes = int(row.event_key.rsplit(":", 1)[-1])
                    locale = row.language if row.language in {"ru", "uk", "cs", "en"} else "en"
                    units = {
                        "en": {10080: "7 days", 1440: "24 hours", 180: "3 hours"},
                        "ru": {10080: "7 дней", 1440: "24 часа", 180: "3 часа"},
                        "uk": {10080: "7 днів", 1440: "24 години", 180: "3 години"},
                        "cs": {10080: "7 dní", 1440: "24 hodin", 180: "3 hodiny"},
                    }
                    if minutes in units[locale]:
                        unit = units[locale][minutes]
                    else:
                        unit = {
                            "en": f"{minutes} minutes", "ru": f"{minutes} мин.",
                            "uk": f"{minutes} хв.", "cs": f"{minutes} min.",
                        }[locale]
                    suffix = {
                        "en": f"Event starts in approximately {unit}.",
                        "ru": f"До начала мероприятия примерно {unit}.",
                        "uk": f"До початку події приблизно {unit}.",
                        "cs": f"Událost začíná přibližně za {unit}.",
                    }[locale]
                    lead = f"{lead}\n{suffix}"
                except ValueError:
                    pass
        link = f"{web_url}/tickets/{ticket.id}"
        button = d["button_ticket"]
        extra = (
            '<table role="presentation" style="width:100%;border-collapse:collapse;'
            'border-top:1px solid #E6DFD1;border-bottom:1px solid #E6DFD1">'
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
                '<div style="margin:25px 0;text-align:center;background:#F0EBE1;padding:20px;border-radius:12px">'
                '<p style="font-weight:bold;margin:0 0 10px">TICKETTREAT PASS</p>'
                '<img alt="Ticket QR" width="220" height="220" style="max-width:100%;height:auto" '
                'src="cid:tickettreat-ticket-qr"></div>'
            )
            caption = d["qr_fallback"] + (" " + d["demo"] if ticket.payment_provider == "demo" else "")
        else:
            caption = d["demo"] if ticket.payment_provider == "demo" else ""

    return {
        "from": os.environ["EMAIL_FROM"].strip(),
        "to": [row.recipient],
        "subject": subject,
        "html": email_shell(title, lead, extra, link, button, caption, d["footer"], row.language),
        "text": f"{title}\n\n{lead}\n\n{link}\n\n{caption}",
        **({"attachments": attachments} if attachments else {}),
    }


def _send_resend(payload: dict, unique_key: str) -> str:
    api_key = os.environ["RESEND_API_KEY"].strip()
    body = json.dumps(payload).encode("utf-8")
    headers = {
        "Authorization": "Bearer " + api_key,
        "Content-Type": "application/json",
        "Accept": "application/json",
        # Explicit client identity: Python-urllib's default UA can be rejected
        # by CDN bot protection before the provider sees the API request.
        "User-Agent": "TicketTreat-Mailer/1.0 (+https://tickettreat.eu)",
        "Idempotency-Key": "tickettreat-" + hashlib.sha256(unique_key.encode()).hexdigest()[:48],
    }
    req = urllib.request.Request(
        "https://api.resend.com/emails", data=body, headers=headers, method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=12) as response:
            data = json.loads(response.read(12000).decode("utf-8"))
            return str(data.get("id") or "")
    except urllib.error.HTTPError as exc:
        # Classify the upstream error without ever logging tokens, recipients,
        # message bodies or untrusted free-form provider response text.
        reason = "unclassified"
        try:
            response_text = exc.read(4096).decode("utf-8", errors="replace")
            response_type = (exc.headers.get("Content-Type") or "").lower()
            if "error code: 1010" in response_text.lower():
                reason = "edge_bot_signature_block"
            elif "application/json" in response_type or response_text.lstrip().startswith("{"):
                response_data = json.loads(response_text)
                if isinstance(response_data, dict):
                    description = str(response_data.get("message") or response_data.get("error") or "").lower()
                    category = str(response_data.get("name") or "").lower()
                    if "testing emails" in description and "own email" in description:
                        reason = "sender_testing_only"
                    elif "domain" in description and ("not verified" in description or "not authorized" in description):
                        reason = "sender_domain_not_authorized"
                    elif "api key" in description and ("permission" in description or "restricted" in description):
                        reason = "key_permission_denied"
                    elif category in {"validation_error", "authorization_error", "authentication_error", "rate_limit_exceeded"}:
                        reason = category
                    else:
                        reason = "provider_json_rejection"
            elif "cloudflare" in response_text.lower() or "text/html" in response_type:
                reason = "edge_html_block"
            else:
                reason = "provider_non_json_rejection"
        except (ValueError, TypeError, OSError):
            reason = "malformed_provider_response"
        raise EmailDeliveryError(
            f"resend_http_{exc.code}_{reason}",
            exc.code in {400, 401, 403, 422},
        ) from None
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
            LOGGER.info("TicketTreat email outbox worker started.")
            # Opt-in production smoke test, addressed ONLY to the configured
            # first global administrator. Idempotency prevents duplicate mail
            # if Railway restarts a container during the same test.
            if os.getenv("EMAIL_SMOKE_TEST", "").strip().lower() in {"true", "1", "yes"}:
                owner = os.getenv("GLOBAL_ADMIN_EMAILS", "").split(",", 1)[0].strip()
                if "@" not in owner or not owner or len(owner) > 255:
                    LOGGER.error("TicketTreat email smoke test skipped: no configured admin recipient")
                else:
                    try:
                        smoke_id = _send_resend({
                            "from": os.environ["EMAIL_FROM"].strip(),
                            "to": [owner],
                            "subject": "TicketTreat delivery integration check",
                            "text": "Automated test of the TicketTreat production email integration. No action is needed.",
                        }, "ticketreat-email-smoke-2026-10-23-ua-fix")
                        LOGGER.info("TicketTreat email smoke test accepted by Resend: provider_id=%s", smoke_id)
                    except EmailDeliveryError as exc:
                        LOGGER.error("TicketTreat email smoke test failed: provider_error=%s", str(exc))
            while True:
                try:
                    for _ in range(MAX_EMAILS_PER_WORKER_CYCLE):
                        with session_factory() as db:
                            if not _deliver_one(db):
                                break
                except Exception:
                    LOGGER.exception("Email worker cycle error")
                time.sleep(8)

        threading.Thread(target=run, name="tickettreat-email-outbox", daemon=True).start()
