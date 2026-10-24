"""TicketTreat BotFather copy and four-language bot onboarding.

English and Russian text is transcribed from botfather-texts.md supplied by the
product team. Czech and Ukrainian are faithful new localizations.
Telegram Bot API allows descriptions, about text and commands per locale.
No token or user data is stored here.
"""
from __future__ import annotations

import re

LANGUAGES = ("en", "ru", "cs", "uk")
DEFAULT_LANGUAGE = "en"

BOT_CONTENT = {
    "en": {
        "description": """You're on the list. TicketTreat books you a spot at events in Prague, issues your ticket and reminds you when it's time to go.

What I do:
• show upcoming events and book your spot
• issue a ticket with a QR code for entry
• remind you a week, a day and 3 hours before
• put you on the waitlist when an event is full
• keep your guest passport: your level grows with real visits

Press "Start".""",
        "about": "Events in Prague: booking, QR ticket and reminders in one place.",
        "start": """Hi, {name}! This is TicketTreat.

Book a spot at events in Prague, get your ticket and don't forget to show up.

/events  upcoming events
/tickets  my tickets
/passport  my passport and level
/help  how it works

Pick an event, tap "Book a spot" and your ticket arrives here.""",
        "buttons": ("Show events", "My tickets"),
        "commands": (
            ("events", "Upcoming events"),
            ("tickets", "My tickets"),
            ("passport", "Guest passport and level"),
            ("reminders", "Set up reminders"),
            ("help", "How it works"),
        ),
        "reminders": "Event reminders are sent automatically when enabled for the event, typically a week, a day and 3 hours before it starts. The organizer can adjust the schedule. Open your tickets to check upcoming events. Personal reminder settings are not available yet.",
        "help": "Choose an event, tap 'Book a spot', and open 'My tickets' to show your QR code at the entrance. If it is full, join the waitlist. A verified check-in raises your guest passport level. Event reminders are sent automatically when enabled.",
        "open": "Open TicketTreat",
        "passport_button": "Open guest passport",
        "reminders_button": "My tickets",
        "help_button": "Show events",
        "private": "Open this command in a private chat with @TicketTreatBot.",
        "unavailable": "TicketTreat Mini App is temporarily unavailable.",
    },
    "ru": {
        "description": """Ты в списке. TicketTreat записывает на ивенты в Праге, выдаёт билет и напоминает, когда пора выходить.

Что умею:
• показываю ближайшие ивенты и записываю на них
• выдаю билет с QR-кодом для входа
• напоминаю за неделю, за день и за 3 часа
• ставлю в лист ожидания, если мест нет
• веду паспорт гостя: уровень растёт за реальные визиты

Нажми «Начать».""",
        "about": "Ивенты в Праге: запись, билет с QR и напоминания в одном месте.",
        "start": """Привет, {name}! Это TicketTreat.

Здесь записываются на ивенты в Праге, получают билет и не забывают прийти.

/events  ближайшие ивенты
/tickets  мои билеты
/passport  мой паспорт и уровень
/help  как это работает

Выбери ивент, нажми «Записаться» — билет придёт сюда.""",
        "buttons": ("Показать ивенты", "Мои билеты"),
        "commands": (
            ("events", "Ближайшие ивенты"),
            ("tickets", "Мои билеты"),
            ("passport", "Паспорт гостя и уровень"),
            ("reminders", "Настроить напоминания"),
            ("help", "Как это работает"),
        ),
        "reminders": "Напоминания об ивентах отправляются автоматически, если они включены организатором. Обычно — за неделю, за день и за 3 часа, но расписание может отличаться. Проверь будущие события в билетах. Личных настроек напоминаний пока нет.",
        "help": "Выбери ивент, нажми «Записаться» и открой «Мои билеты», чтобы показать QR-код на входе. Если мест нет, можно встать в лист ожидания. Подтверждённое посещение повышает уровень паспорта гостя. Напоминания отправляются автоматически, когда они включены.",
        "open": "Открыть TicketTreat",
        "passport_button": "Открыть паспорт гостя",
        "reminders_button": "Мои билеты",
        "help_button": "Показать ивенты",
        "private": "Открой эту команду в личном чате с @TicketTreatBot.",
        "unavailable": "TicketTreat Mini App временно недоступен.",
    },
    "cs": {
        "description": """Jsi na seznamu. TicketTreat ti rezervuje místo na akcích v Praze, vystaví vstupenku a připomene, kdy vyrazit.

Co umím:
• ukázat nadcházející akce a rezervovat místo
• vystavit vstupenku s QR kódem ke vstupu
• připomenout akci týden, den a 3 hodiny předem
• zařadit tě na čekací listinu, když je plno
• vést tvůj návštěvnický pas: úroveň roste se skutečnými návštěvami

Stiskni „Start“.""",
        "about": "Akce v Praze: rezervace, QR vstupenky a připomínky na jednom místě.",
        "start": """Ahoj, {name}! Tady TicketTreat.

Rezervuj si místo na akcích v Praze, získej vstupenku a nenech si ujít začátek.

/events  nadcházející akce
/tickets  moje vstupenky
/passport  můj návštěvnický pas a úroveň
/help  jak to funguje

Vyber akci, klepni na „Rezervovat místo“ a vstupenku najdeš přímo tady.""",
        "buttons": ("Zobrazit akce", "Moje vstupenky"),
        "commands": (
            ("events", "Nadcházející akce"),
            ("tickets", "Moje vstupenky"),
            ("passport", "Návštěvnický pas a úroveň"),
            ("reminders", "Nastavit připomínky"),
            ("help", "Jak to funguje"),
        ),
        "reminders": "Připomínky akcí chodí automaticky, pokud je pořadatel zapnul. Obvykle týden, den a 3 hodiny před akcí, ale pořadatel může časy změnit. Nadcházející akce najdeš v Moje vstupenky. Osobní nastavení připomínek zatím není k dispozici.",
        "help": "Vyber akci, klepni na „Rezervovat místo“ a v Moje vstupenky najdeš QR kód ke vstupu. Při naplněné kapacitě se můžeš zapsat na čekací listinu. Potvrzená návštěva zvyšuje úroveň návštěvnického pasu. Připomínky přicházejí automaticky, jsou-li zapnuté.",
        "open": "Otevřít TicketTreat",
        "passport_button": "Otevřít návštěvnický pas",
        "reminders_button": "Moje vstupenky",
        "help_button": "Zobrazit akce",
        "private": "Otevři tento příkaz v soukromém chatu s @TicketTreatBot.",
        "unavailable": "Mini App TicketTreat je dočasně nedostupná.",
    },
    "uk": {
        "description": """Ти у списку. TicketTreat бронює місця на подіях у Празі, видає квиток і нагадує, коли час вирушати.

Що я вмію:
• показувати найближчі події та бронювати місце
• видавати квиток із QR-кодом для входу
• нагадувати за тиждень, день і 3 години до події
• додавати до списку очікування, якщо місць немає
• вести паспорт гостя: рівень зростає з реальними відвідуваннями

Натисни «Почати».""",
        "about": "Події у Празі: бронювання, QR-квитки й нагадування в одному місці.",
        "start": """Привіт, {name}! Це TicketTreat.

Бронюй місця на подіях у Празі, отримуй квитки й не пропускай початок.

/events  найближчі події
/tickets  мої квитки
/passport  мій паспорт гостя та рівень
/help  як це працює

Обери подію, натисни «Забронювати місце» — квиток надійде сюди.""",
        "buttons": ("Показати події", "Мої квитки"),
        "commands": (
            ("events", "Найближчі події"),
            ("tickets", "Мої квитки"),
            ("passport", "Паспорт гостя та рівень"),
            ("reminders", "Налаштувати нагадування"),
            ("help", "Як це працює"),
        ),
        "reminders": "Нагадування про події надходять автоматично, якщо їх увімкнув організатор. Зазвичай — за тиждень, день і 3 години, але розклад може відрізнятися. Майбутні події дивись у «Мої квитки». Особистих налаштувань нагадувань поки немає.",
        "help": "Обери подію, натисни «Забронювати місце» й відкрий «Мої квитки», щоб показати QR-код на вході. Якщо місць немає, можна стати до списку очікування. Підтверджене відвідування підвищує рівень паспорта гостя. Нагадування надходять автоматично, коли ввімкнені.",
        "open": "Відкрити TicketTreat",
        "passport_button": "Відкрити паспорт гостя",
        "reminders_button": "Мої квитки",
        "help_button": "Показати події",
        "private": "Відкрий цю команду в особистому чаті з @TicketTreatBot.",
        "unavailable": "TicketTreat Mini App тимчасово недоступний.",
    },
}


def normalize_language(language_code: str | None) -> str:
    value = str(language_code or "").split("-", 1)[0].split("_", 1)[0].lower()
    return value if value in LANGUAGES else DEFAULT_LANGUAGE


def get_copy(language_code: str | None) -> dict:
    return BOT_CONTENT[normalize_language(language_code)]


def welcome_text(language_code: str | None, first_name: str | None) -> str:
    safe = re.sub(r"[\x00-\x1f\x7f]+", " ", str(first_name or "").strip())[:70] or "friend"
    return get_copy(language_code)["start"].replace("{name}", safe)


def validate_profile_copy() -> None:
    for lang, data in BOT_CONTENT.items():
        if len(data["description"]) > 512 or len(data["about"]) > 120:
            raise ValueError(f"Telegram BotFather text too long: {lang}")
        if len(data["commands"]) > 100 or len({c for c, _ in data["commands"]}) != len(data["commands"]):
            raise ValueError(f"Duplicate/too many bot commands: {lang}")
        for command, description in data["commands"]:
            if not re.fullmatch(r"[a-z0-9_]{1,32}", command) or not 1 <= len(description) <= 256:
                raise ValueError(f"Invalid bot command description: {lang}/{command}")


def configure_botfather_profile(bot_token: str, requests_module) -> None:
    """Idempotently synchronize text-only Telegram bot metadata on deploy.

    Never log the token, endpoints with the token, or response bodies. Avatar
    and description picture require the provided image assets, not this method.
    """
    if not bot_token:
        return
    validate_profile_copy()
    root = "https://api.telegram.org/bot" + bot_token + "/"
    for language_code in ("", "en", "ru", "cs", "uk"):
        copy = BOT_CONTENT[language_code or "en"]
        lang = {"language_code": language_code} if language_code else {}
        for getter, setter, field, desired in (
            ("getMyDescription", "setMyDescription", "description", copy["description"]),
            ("getMyShortDescription", "setMyShortDescription", "short_description", copy["about"]),
            ("getMyCommands", "setMyCommands", "commands",
             [{"command": name, "description": label} for name, label in copy["commands"]]),
        ):
            try:
                response = requests_module.post(root + getter, json=lang, timeout=8)
                result = response.json() if response.ok else {}
                if not result.get("ok"):
                    raise RuntimeError("telegram_get_failed")
                current = result.get("result", {})
                current = current if field == "commands" else current.get(field, "")
                if current == desired:
                    continue
                response = requests_module.post(root + setter, json={**lang, field: desired}, timeout=10)
                result = response.json() if response.ok else {}
                if not result.get("ok") or result.get("result") is not True:
                    raise RuntimeError("telegram_set_failed")
                print(f"TicketTreat bot profile updated: {setter} {language_code or 'default'}", flush=True)
            except Exception as exc:
                # A failure in profile configuration must never interrupt user updates.
                print(f"TicketTreat bot profile setup failed: {setter} {language_code or 'default'} ({type(exc).__name__})", flush=True)


validate_profile_copy()
