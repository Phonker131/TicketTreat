from __future__ import annotations

import copy
import csv
import os
import tempfile
import threading
import time
from datetime import datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

import requests
import telebot
from dotenv import load_dotenv
from telebot.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    ReplyKeyboardMarkup,
    WebAppInfo,
)


# =========================================================
# Environment
# =========================================================
# Current file:
# TicketTreat/app/bot/src/main.py
#
# parents[3]:
# TicketTreat/
PROJECT_ROOT = Path(__file__).resolve().parents[3]
load_dotenv(PROJECT_ROOT / ".env", override=False, encoding="utf-8-sig")

BOT_TOKEN = os.getenv("BOT_TOKEN")
BOT_USERNAME = "TicketTreatBot"  # Official bot; legacy BOT_USERNAME env must not redirect users to Crowdly
BACKEND_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
BOT_API_KEY = os.getenv("BOT_API_KEY", "").strip()
CLIENT_SERVICE_URL = os.getenv("CLIENT_SERVICE_URL", "").strip()
WEB_APP_URL = os.getenv("WEB_APP_URL", "").strip().rstrip("/")
PRAGUE_TZ = ZoneInfo("Europe/Prague")

ADMIN_IDS = [
    int(value.strip())
    for value in os.getenv("ADMIN_IDS", "").split(",")
    if value.strip()
]

if not BOT_TOKEN:
    raise RuntimeError("BOT_TOKEN is not configured")

bot = telebot.TeleBot(BOT_TOKEN)


# =========================================================
# State storage
# =========================================================
user_state: dict[int, str] = {}
user_temp: dict[int, dict[str, Any]] = {}

profile_edit_state: dict[int, str] = {}
profile_edit_temp: dict[int, dict[str, Any]] = {}

admin_event_state: dict[int, str] = {}
admin_event_temp: dict[int, dict[str, Any]] = {}

admin_edit_state: dict[int, str] = {}
admin_edit_temp: dict[int, dict[str, Any]] = {}

admin_cancel_state: dict[int, str] = {}
admin_cancel_temp: dict[int, dict[str, Any]] = {}

broadcast_state: dict[int, str] = {}
broadcast_temp: dict[int, dict[str, Any]] = {}

user_language_cache: dict[int, str] = {}
pending_event_after_registration: dict[int, int] = {}


CREATION_STATES = {
    "WAIT_EVENT_NAME",
    "WAIT_EVENT_ORGANIZER",
    "WAIT_EVENT_LOCATION",
    "WAIT_EVENT_DESCRIPTION",
    "WAIT_EVENT_MAX_PARTICIPANTS",
    "WAIT_EVENT_PRICE",
    "WAIT_EVENT_CURRENCY",
    "WAIT_EVENT_PAYMENT_INSTRUCTIONS",
    "WAIT_EVENT_LANGUAGES",
    "WAIT_EVENT_START_TIME",
    "WAIT_EVENT_REMINDER_TIME",
    "WAIT_EVENT_REMINDER_TEXT",
    "WAIT_EVENT_PHOTO",
}

PROFILE_STATES = {
    "WAIT_LANGUAGE",
    "WAIT_FIRST_NAME",
    "WAIT_LAST_NAME",
    "WAIT_PHONE",
    "WAIT_CONTACT_METHOD",
    "WAIT_INSTAGRAM",
}

PROFILE_EDIT_STATES = {
    "WAIT_PROFILE_EDIT_FIRST_NAME",
    "WAIT_PROFILE_EDIT_LAST_NAME",
    "WAIT_PROFILE_EDIT_PHONE",
    "WAIT_PROFILE_EDIT_CONTACT_METHOD",
    "WAIT_PROFILE_EDIT_INSTAGRAM",
    "WAIT_PROFILE_EDIT_INSTAGRAM_FOR_METHOD",
    "WAIT_PROFILE_EDIT_LANGUAGE",
}


# =========================================================
# General helpers
# =========================================================
def backend_request(
    method: str,
    path: str,
    *,
    timeout: int = 10,
    **kwargs,
) -> Any:
    headers = dict(kwargs.pop("headers", {}) or {})
    if BOT_API_KEY:
        headers["X-Bot-Api-Key"] = BOT_API_KEY
    response = requests.request(
        method,
        f"{BACKEND_URL}{path}",
        timeout=timeout,
        headers=headers,
        **kwargs,
    )

    response.raise_for_status()

    if not response.content:
        return None

    return response.json()


# =========================================================
# Interface languages / i18n
# =========================================================
SUPPORTED_INTERFACE_LANGUAGES = ("en", "cs", "ru", "uk")
DEFAULT_INTERFACE_LANGUAGE = "ru"

LANGUAGE_SELECTOR_LABELS = {
    "en": "🇬🇧 English",
    "cs": "🇨🇿 Čeština",
    "ru": "🇷🇺 Русский",
    "uk": "🇺🇦 Українська",
}

LANGUAGE_NAMES = {
    "en": {"en": "English", "cs": "Czech", "ru": "Russian", "uk": "Ukrainian"},
    "cs": {"en": "angličtina", "cs": "čeština", "ru": "ruština", "uk": "ukrajinština"},
    "ru": {"en": "английский", "cs": "чешский", "ru": "русский", "uk": "украинский"},
    "uk": {"en": "англійська", "cs": "чеська", "ru": "російська", "uk": "українська"},
}


def _tr(en: str, cs: str, ru: str, uk: str) -> dict[str, str]:
    return {"en": en, "cs": cs, "ru": ru, "uk": uk}


# Only TicketTreat-owned UI fragments are translated here. Event titles,
# descriptions, organizer payment instructions, organizer reminder text,
# cancellation reasons and broadcast content are left unchanged.
UI_TRANSLATIONS = {
    # Main menu / navigation
    "🏠 Start": _tr("🏠 Start", "🏠 Hlavní", "🏠 Главная", "🏠 Головна"),
    "📅 Events": _tr("📅 Events", "📅 Události", "📅 Ивенты", "📅 Події"),
    "🎟 My events": _tr("🎟 My events", "🎟 Moje události", "🎟 Мои ивенты", "🎟 Мої події"),
    "👤 My profile": _tr("👤 My profile", "👤 Můj profil", "👤 Мой профиль", "👤 Мій профіль"),
    "📝 Registration": _tr("📝 Registration", "📝 Registrace", "📝 Регистрация", "📝 Реєстрація"),
    "🆘 Client service": _tr("🆘 Client service", "🆘 Zákaznická podpora", "🆘 Поддержка", "🆘 Підтримка"),
    "🌐 Open in app": _tr("🌐 Open in app", "🌐 Otevřít v aplikaci", "🌐 Открыть в приложении", "🌐 Відкрити в застосунку"),
    "⚙️ Admin": _tr("⚙️ Admin", "⚙️ Administrace", "⚙️ Админ", "⚙️ Адмін"),
    "⬅️ Назад": _tr("⬅️ Back", "⬅️ Zpět", "⬅️ Назад", "⬅️ Назад"),
    "⬅️ Back": _tr("⬅️ Back", "⬅️ Zpět", "⬅️ Назад", "⬅️ Назад"),
    "⏭️ Пропустить": _tr("⏭️ Skip", "⏭️ Přeskočit", "⏭️ Пропустить", "⏭️ Пропустити"),
    "❌ Отмена": _tr("❌ Cancel", "❌ Zrušit", "❌ Отмена", "❌ Скасувати"),
    "🔄 Обновить": _tr("🔄 Refresh", "🔄 Obnovit", "🔄 Обновить", "🔄 Оновити"),
    "Подробнее": _tr("Details", "Podrobnosti", "Подробнее", "Докладніше"),
    "Подробнее: ": _tr("Details: ", "Podrobnosti: ", "Подробнее: ", "Докладніше: "),

    # Profile buttons / labels
    "✏️ Имя": _tr("✏️ First name", "✏️ Jméno", "✏️ Имя", "✏️ Ім'я"),
    "✏️ Фамилия": _tr("✏️ Last name", "✏️ Příjmení", "✏️ Фамилия", "✏️ Прізвище"),
    "📞 Телефон": _tr("📞 Phone", "📞 Telefon", "📞 Телефон", "📞 Телефон"),
    "💬 Способ связи": _tr("💬 Contact method", "💬 Způsob kontaktu", "💬 Способ связи", "💬 Спосіб зв'язку"),
    "📸 Instagram": _tr("📸 Instagram", "📸 Instagram", "📸 Instagram", "📸 Instagram"),
    "🌐 Язык интерфейса": _tr("🌐 Interface language", "🌐 Jazyk rozhraní", "🌐 Язык интерфейса", "🌐 Мова інтерфейсу"),
    "📞 Поделиться контактом": _tr("📞 Share contact", "📞 Sdílet kontakt", "📞 Поделиться контактом", "📞 Поділитися контактом"),
    "👤 Мой профиль": _tr("👤 My profile", "👤 Můj profil", "👤 Мой профиль", "👤 Мій профіль"),
    "Имя: ": _tr("First name: ", "Jméno: ", "Имя: ", "Ім'я: "),
    "Фамилия: ": _tr("Last name: ", "Příjmení: ", "Фамилия: ", "Прізвище: "),
    "Телефон: ": _tr("Phone: ", "Telefon: ", "Телефон: ", "Телефон: "),
    "Способ связи: ": _tr("Contact method: ", "Způsob kontaktu: ", "Способ связи: ", "Спосіб зв'язку: "),
    "Язык интерфейса: ": _tr("Interface language: ", "Jazyk rozhraní: ", "Язык интерфейса: ", "Мова інтерфейсу: "),

    # Event UI
    "Доступные ивенты:": _tr("Available events:", "Dostupné události:", "Доступные ивенты:", "Доступні події:"),
    "🎟 Твои ивенты:": _tr("🎟 Your events:", "🎟 Tvoje události:", "🎟 Твои ивенты:", "🎟 Твої події:"),
    "✅ Записаться": _tr("✅ Join", "✅ Přihlásit se", "✅ Записаться", "✅ Приєднатися"),
    "❌ Нет свободных мест": _tr("❌ No spots left", "❌ Žádná volná místa", "❌ Нет свободных мест", "❌ Немає вільних місць"),
    "❌ Ивент отменён": _tr("❌ Event cancelled", "❌ Událost zrušena", "❌ Ивент отменён", "❌ Подію скасовано"),
    "👤 Организатор: ": _tr("👤 Organizer: ", "👤 Organizátor: ", "👤 Организатор: ", "👤 Організатор: "),
    "📍 Локация: ": _tr("📍 Location: ", "📍 Místo: ", "📍 Локация: ", "📍 Локація: "),
    "📝 Описание: ": _tr("📝 Description: ", "📝 Popis: ", "📝 Описание: ", "📝 Опис: "),
    "💰 Цена: ": _tr("💰 Price: ", "💰 Cena: ", "💰 Цена: ", "💰 Ціна: "),
    "👥 Участников: ": _tr("👥 Participants: ", "👥 Účastníci: ", "👥 Участников: ", "👥 Учасники: "),
    "🪑 Осталось мест: ": _tr("🪑 Spots left: ", "🪑 Zbývá míst: ", "🪑 Осталось мест: ", "🪑 Залишилось місць: "),
    "🕒 Начало: ": _tr("🕒 Starts: ", "🕒 Začátek: ", "🕒 Начало: ", "🕒 Початок: "),
    "🌐 Языки: ": _tr("🌐 Languages: ", "🌐 Jazyky: ", "🌐 Языки: ", "🌐 Мови: "),
    "Не указано": _tr("Not specified", "Neuvedeno", "Не указано", "Не вказано"),
    "💳 Оплата: ": _tr("💳 Payment: ", "💳 Platba: ", "💳 Оплата: ", "💳 Оплата: "),
    "⏰ Подтвердить до: ": _tr("⏰ Confirm by: ", "⏰ Potvrdit do: ", "⏰ Подтвердить до: ", "⏰ Підтвердити до: "),
    "⏰ До: ": _tr("⏰ Until: ", "⏰ Do: ", "⏰ До: ", "⏰ До: "),
    "Причина: ": _tr("Reason: ", "Důvod: ", "Причина: ", "Причина: "),
    "⏳ Ожидает подтверждения": _tr("⏳ Awaiting confirmation", "⏳ Čeká na potvrzení", "⏳ Ожидает подтверждения", "⏳ Очікує підтвердження"),
    "✅ Подтверждена": _tr("✅ Confirmed", "✅ Potvrzeno", "✅ Подтверждена", "✅ Підтверджено"),
    "Не требуется": _tr("Not required", "Není vyžadováno", "Не требуется", "Не потрібна"),

    # General user flow
    "🎟 TicketTreat — твои мероприятия в одном месте. Выбирай событие, бронируй место и управляй билетами через меню ниже.": _tr("🎟 TicketTreat — your events in one place. Discover events, reserve a spot and manage your tickets using the menu below.", "🎟 TicketTreat — všechny události na jednom místě. Vyber událost, rezervuj místo a spravuj vstupenky v nabídce níže.", "🎟 TicketTreat — твои мероприятия в одном месте. Выбирай событие, бронируй место и управляй билетами через меню ниже.", "🎟 TicketTreat — твої події в одному місці. Обирай подію, бронюй місце та керуй квитками через меню нижче."),
    "⚠️ TicketTreat is temporarily unavailable. Please try again later.": _tr("⚠️ TicketTreat is temporarily unavailable. Please try again later.", "⚠️ TicketTreat je dočasně nedostupný. Zkus to prosím později.", "⚠️ TicketTreat временно недоступен. Попробуй позже.", "⚠️ TicketTreat тимчасово недоступний. Спробуй пізніше."),
    "Привет! Я бот TicketTreat для записи на ивенты.": _tr(
        "Hi! I'm the TicketTreat bot for joining events.",
        "Ahoj! Jsem TicketTreat bot pro registraci na události.",
        "Привет! Я бот TicketTreat для записи на ивенты.",
        "Привіт! Я бот TicketTreat для реєстрації на події.",
    ),
    "Твой Telegram ID: ": _tr("Your Telegram ID: ", "Tvoje Telegram ID: ", "Твой Telegram ID: ", "Твій Telegram ID: "),
    "✅ Пройти регистрацию": _tr("✅ Register", "✅ Zaregistrovat se", "✅ Пройти регистрацию", "✅ Зареєструватися"),
    "Чтобы записываться на ивенты, сначала пройди регистрацию.": _tr(
        "Complete registration before joining events.",
        "Nejdřív dokonči registraci, abys se mohl(a) přihlásit na události.",
        "Чтобы записываться на ивенты, сначала пройди регистрацию.",
        "Щоб приєднуватися до подій, спочатку пройди реєстрацію.",
    ),
    "Пока нет доступных ивентов.": _tr("There are no available events yet.", "Zatím nejsou dostupné žádné události.", "Пока нет доступных ивентов.", "Поки немає доступних подій."),
    "Ты пока не записан ни на один ивент.": _tr("You haven't joined any events yet.", "Zatím nejsi přihlášen(a) na žádnou událost.", "Ты пока не записан ни на один ивент.", "Ти ще не приєднався(-лася) до жодної події."),
    "Ивент не найден.": _tr("Event not found.", "Událost nebyla nalezena.", "Ивент не найден.", "Подію не знайдено."),
    "Некорректная ссылка на ивент.": _tr("Invalid event link.", "Neplatný odkaz na událost.", "Некорректная ссылка на ивент.", "Некоректне посилання на подію."),

    # Registration/profile messages
    "Введи своё имя:": _tr("Enter your first name:", "Zadej své jméno:", "Введи своё имя:", "Введи своє ім'я:"),
    "Имя не может быть пустым.": _tr("First name cannot be empty.", "Jméno nemůže být prázdné.", "Имя не может быть пустым.", "Ім'я не може бути порожнім."),
    "Теперь введи фамилию:": _tr("Now enter your last name:", "Teď zadej své příjmení:", "Теперь введи фамилию:", "Тепер введи прізвище:"),
    "Фамилия не может быть пустой.": _tr("Last name cannot be empty.", "Příjmení nemůže být prázdné.", "Фамилия не может быть пустой.", "Прізвище не може бути порожнім."),
    "Отправь номер телефона или поделись контактом.": _tr("Enter your phone number or share your contact.", "Zadej telefonní číslo nebo sdílej kontakt.", "Отправь номер телефона или поделись контактом.", "Введи номер телефону або поділися контактом."),
    "Некорректный номер. Попробуй ещё раз.": _tr("Invalid phone number. Try again.", "Neplatné telefonní číslo. Zkus to znovu.", "Некорректный номер. Попробуй ещё раз.", "Некоректний номер. Спробуй ще раз."),
    "Как организаторам лучше с тобой связаться?": _tr("How should organizers contact you?", "Jak tě mají organizátoři kontaktovat?", "Как организаторам лучше с тобой связаться?", "Як організаторам краще з тобою зв'язатися?"),
    "Отправь Instagram username или ссылку:": _tr("Enter your Instagram username or link:", "Zadej uživatelské jméno nebo odkaz na Instagram:", "Отправь Instagram username или ссылку:", "Введи Instagram username або посилання:"),
    "Instagram username или ссылка слишком короткие.": _tr("Instagram username or link is too short.", "Uživatelské jméno nebo odkaz na Instagram je příliš krátký.", "Instagram username или ссылка слишком короткие.", "Instagram username або посилання занадто короткі."),
    "✅ Профиль сохранён!": _tr("✅ Profile saved!", "✅ Profil uložen!", "✅ Профиль сохранён!", "✅ Профіль збережено!"),
    "Профиль ещё не заполнен. Нажми «📝 Registration».": _tr("Your profile is not complete yet. Complete registration to continue.", "Tvůj profil ještě není dokončený. Pro pokračování dokonči registraci.", "Профиль ещё не заполнен. Заверши регистрацию, чтобы продолжить.", "Профіль ще не заповнений. Заверши реєстрацію, щоб продовжити."),
    "✅ Ты уже зарегистрирован. Данные можно изменить в профиле.": _tr("✅ You are already registered. Edit your details in your profile.", "✅ Už jsi zaregistrovaný/á. Údaje můžeš změnit v profilu.", "✅ Ты уже зарегистрирован. Данные можно изменить в профиле.", "✅ Ти вже зареєстрований/а. Дані можна змінити у профілі."),
    "✅ Данные профиля обновлены.": _tr("✅ Profile updated.", "✅ Profil aktualizován.", "✅ Данные профиля обновлены.", "✅ Дані профілю оновлено."),
    "✅ Номер телефона обновлён.": _tr("✅ Phone number updated.", "✅ Telefonní číslo aktualizováno.", "✅ Номер телефона обновлён.", "✅ Номер телефону оновлено."),
    "Редактирование отменено.": _tr("Editing cancelled.", "Úpravy zrušeny.", "Редактирование отменено.", "Редагування скасовано."),
    "Введите новое имя:": _tr("Enter a new first name:", "Zadej nové jméno:", "Введите новое имя:", "Введи нове ім'я:"),
    "Введите новую фамилию:": _tr("Enter a new last name:", "Zadej nové příjmení:", "Введите новую фамилию:", "Введи нове прізвище:"),
    "Введите новый номер телефона или поделитесь контактом:": _tr("Enter a new phone number or share your contact:", "Zadej nové telefonní číslo nebo sdílej kontakt:", "Введите новый номер телефона или поделитесь контактом:", "Введи новий номер телефону або поділися контактом:"),
    "Выберите новый способ связи:": _tr("Choose a new contact method:", "Vyber nový způsob kontaktu:", "Выберите новый способ связи:", "Оберіть новий спосіб зв'язку:"),
    "Введите новый Instagram username или ссылку:": _tr("Enter a new Instagram username or link:", "Zadej nové uživatelské jméno nebo odkaz na Instagram:", "Введите новый Instagram username или ссылку:", "Введи новий Instagram username або посилання:"),
    "🌐 Выберите язык интерфейса:": _tr("🌐 Choose interface language:", "🌐 Vyber jazyk rozhraní:", "🌐 Выберите язык интерфейса:", "🌐 Оберіть мову інтерфейсу:"),
    "✅ Язык интерфейса изменён.": _tr("✅ Interface language changed.", "✅ Jazyk rozhraní změněn.", "✅ Язык интерфейса изменён.", "✅ Мову інтерфейсу змінено."),

    # Client service
    "Client service пока не настроен.": _tr("Client service is not configured yet.", "Zákaznická podpora zatím není nastavena.", "Client service пока не настроен.", "Підтримку ще не налаштовано."),
    "💬 Написать в Client service": _tr("💬 Contact client service", "💬 Napsat podpoře", "💬 Написать в поддержку", "💬 Написати в підтримку"),
    "Если нужна помощь, напиши нашему Client service:": _tr("If you need help, contact our client service:", "Pokud potřebuješ pomoc, napiš naší podpoře:", "Если нужна помощь, напиши нашему Client service:", "Якщо потрібна допомога, напиши нашій підтримці:"),

    # Payment messages
    "ℹ️ У тебя уже есть место на этом ивенте.": _tr("ℹ️ You already have a reserved spot at this event.", "ℹ️ Na této události už máš rezervované místo.", "ℹ️ У тебя уже есть место на этом ивенте.", "ℹ️ У тебе вже є зарезервоване місце на цій події."),
    "✅ Твоё место на ивенте зарезервировано.": _tr("✅ Your place at the event has been reserved.", "✅ Tvé místo na události bylo rezervováno.", "✅ Твоё место на ивенте зарезервировано.", "✅ Твоє місце на події зарезервовано."),
    "💳 Для завершения регистрации оплати билет по реквизитам ниже:": _tr("💳 To complete registration, pay for the ticket using the details below:", "💳 Pro dokončení registrace zaplať vstupenku podle údajů níže:", "💳 Для завершения регистрации оплати билет по реквизитам ниже:", "💳 Щоб завершити реєстрацію, оплати квиток за реквізитами нижче:"),
    "⏳ Администратор должен подтвердить оплату в течение 24 часов.": _tr("⏳ An admin must confirm the payment within 24 hours.", "⏳ Administrátor musí platbu potvrdit do 24 hodin.", "⏳ Администратор должен подтвердить оплату в течение 24 часов.", "⏳ Адміністратор має підтвердити оплату протягом 24 годин."),
    "Крайний срок подтверждения: ": _tr("Confirmation deadline: ", "Termín potvrzení: ", "Крайний срок подтверждения: ", "Кінцевий термін підтвердження: "),
    "Если оплата не будет подтверждена вовремя, бронь автоматически отменится.": _tr("If payment is not confirmed in time, the reservation will be cancelled automatically.", "Pokud platba nebude včas potvrzena, rezervace se automaticky zruší.", "Если оплата не будет подтверждена вовремя, бронь автоматически отменится.", "Якщо оплату не підтвердять вчасно, бронювання буде автоматично скасовано."),
    "✅ Ты записан на ивент. Оплата не требуется.": _tr("✅ You joined the event. No payment is required.", "✅ Jsi přihlášen(a) na událost. Platba není potřeba.", "✅ Ты записан на ивент. Оплата не требуется.", "✅ Ти приєднався(-лася) до події. Оплата не потрібна."),
    "ℹ️ Ты уже записан на этот ивент.": _tr("ℹ️ You already joined this event.", "ℹ️ Na tuto událost už jsi přihlášen(a).", "ℹ️ Ты уже записан на этот ивент.", "ℹ️ Ти вже приєднався(-лася) до цієї події."),
    "💳 Реквизиты оплаты": _tr("💳 Payment details", "💳 Platební údaje", "💳 Реквизиты оплаты", "💳 Реквізити оплати"),
    "✅ Оплата подтверждена!": _tr("✅ Payment confirmed!", "✅ Platba potvrzena!", "✅ Оплата подтверждена!", "✅ Оплату підтверджено!"),
    "Твоя регистрация полностью подтверждена.": _tr("Your registration is fully confirmed.", "Tvoje registrace je plně potvrzena.", "Твоя регистрация полностью подтверждена.", "Твою реєстрацію повністю підтверджено."),
    "❌ Отписаться": _tr("❌ Leave event", "❌ Odhlásit se", "❌ Отписаться", "❌ Відписатися"),
    "✅ Ты отписался от ивента.": _tr("✅ You left the event.", "✅ Z události ses odhlásil(a).", "✅ Ты отписался от ивента.", "✅ Ти відписався(-лася) від події."),
    "⏰ Напоминание!": _tr("⏰ Reminder!", "⏰ Připomínka!", "⏰ Напоминание!", "⏰ Нагадування!"),

    # Admin panel
    "📅 Ивенты": _tr("📅 Events", "📅 Události", "📅 Ивенты", "📅 Події"),
    "➕ Add new event": _tr("➕ Add new event", "➕ Přidat událost", "➕ Добавить ивент", "➕ Додати подію"),
    "📢 Broadcast text": _tr("📢 Broadcast text", "📢 Textová rozesílka", "📢 Текстовая рассылка", "📢 Текстова розсилка"),
    "🖼 Broadcast photo": _tr("🖼 Broadcast photo", "🖼 Rozesílka s fotkou", "🖼 Рассылка с фото", "🖼 Розсилка з фото"),
    "Админ-панель:": _tr("Admin panel:", "Administrace:", "Админ-панель:", "Адмін-панель:"),
    "Выбери ивент:": _tr("Choose an event:", "Vyber událost:", "Выбери ивент:", "Оберіть подію:"),
    "👥 Participants": _tr("👥 Participants", "👥 Účastníci", "👥 Участники", "👥 Учасники"),
    "📤 Export participants": _tr("📤 Export participants", "📤 Export účastníků", "📤 Экспорт участников", "📤 Експорт учасників"),
    "✏️ Edit event": _tr("✏️ Edit event", "✏️ Upravit událost", "✏️ Редактировать ивент", "✏️ Редагувати подію"),
    "❌ Cancel event": _tr("❌ Cancel event", "❌ Zrušit událost", "❌ Отменить ивент", "❌ Скасувати подію"),
    "Управление ивентом:": _tr("Event management:", "Správa události:", "Управление ивентом:", "Керування подією:"),
    "Никто не записан.": _tr("No one is registered.", "Nikdo není přihlášen.", "Никто не записан.", "Ніхто не зареєстрований."),
    "Участники:": _tr("Participants:", "Účastníci:", "Участники:", "Учасники:"),
    "Без имени": _tr("No name", "Bez jména", "Без имени", "Без імені"),
    "Telegram: username не указан": _tr("Telegram: username not set", "Telegram: uživatelské jméno není uvedeno", "Telegram: username не указан", "Telegram: username не вказано"),
    "✅ Confirm payment: ": _tr("✅ Confirm payment: ", "✅ Potvrdit platbu: ", "✅ Подтвердить оплату: ", "✅ Підтвердити оплату: "),
    "📤 Export CSV": _tr("📤 Export CSV", "📤 Export CSV", "📤 Экспорт CSV", "📤 Експорт CSV"),
    "Оплата подтверждена": _tr("Payment confirmed", "Platba potvrzena", "Оплата подтверждена", "Оплату підтверджено"),

    # Event creation/edit
    "Введите название ивента:": _tr("Enter event title:", "Zadej název události:", "Введите название ивента:", "Введіть назву події:"),
    "Введите организатора:": _tr("Enter organizer:", "Zadej organizátora:", "Введите организатора:", "Введіть організатора:"),
    "Введите локацию ивента:": _tr("Enter event location:", "Zadej místo události:", "Введите локацию ивента:", "Введіть локацію події:"),
    "Введите описание:": _tr("Enter description:", "Zadej popis:", "Введите описание:", "Введіть опис:"),
    "Введите максимальное число участников:": _tr("Enter maximum number of participants:", "Zadej maximální počet účastníků:", "Введите максимальное число участников:", "Введіть максимальну кількість учасників:"),
    "Введите цену.": _tr("Enter the price.", "Zadej cenu.", "Введите цену.", "Введіть ціну."),
    "Примеры: 100, 99.99 или 0 для бесплатного ивента.": _tr("Examples: 100, 99.99 or 0 for a free event.", "Příklady: 100, 99.99 nebo 0 pro bezplatnou událost.", "Примеры: 100, 99.99 или 0 для бесплатного ивента.", "Приклади: 100, 99.99 або 0 для безкоштовної події."),
    "Выберите валюту стоимости ивента:": _tr("Choose event currency:", "Vyber měnu události:", "Выберите валюту стоимости ивента:", "Оберіть валюту події:"),
    "Введите реквизиты и инструкцию для оплаты билета.": _tr("Enter payment details and ticket-payment instructions.", "Zadej platební údaje a pokyny k úhradě vstupenky.", "Введите реквизиты и инструкцию для оплаты билета.", "Введіть реквізити та інструкцію для оплати квитка."),
    "Это сообщение получит пользователь после нажатия Join.": _tr("The user receives this message after pressing Join.", "Uživatel tuto zprávu dostane po stisknutí Přihlásit se.", "Это сообщение получит пользователь после нажатия Join.", "Користувач отримає це повідомлення після натискання «Приєднатися»."),
    "🌐 Выберите язык(и) ивента:": _tr("🌐 Choose event language(s):", "🌐 Vyber jazyk(y) události:", "🌐 Выберите язык(и) ивента:", "🌐 Оберіть мову/мови події:"),
    "✅ Готово": _tr("✅ Done", "✅ Hotovo", "✅ Готово", "✅ Готово"),
    "Нужно выбрать хотя бы один язык ивента.": _tr("Select at least one event language.", "Vyber alespoň jeden jazyk události.", "Нужно выбрать хотя бы один язык ивента.", "Оберіть щонайменше одну мову події."),
    "Введите дату и время начала ивента.": _tr("Enter event start date and time.", "Zadej datum a čas začátku události.", "Введите дату и время начала ивента.", "Введіть дату й час початку події."),
    "Когда отправить напоминание?": _tr("When should the reminder be sent?", "Kdy se má poslat připomínka?", "Когда отправить напоминание?", "Коли надіслати нагадування?"),
    "Введите текст напоминания:": _tr("Enter reminder text:", "Zadej text připomínky:", "Введите текст напоминания:", "Введіть текст нагадування:"),
    "Отправь постер ивента или нажми «⏭️ Пропустить».": _tr("Send the event poster or press “⏭️ Skip”.", "Pošli plakát události nebo stiskni „⏭️ Přeskočit“.", "Отправь постер ивента или нажми «⏭️ Пропустить».", "Надішли постер події або натисни «⏭️ Пропустити»."),
    "Создание ивента отменено.": _tr("Event creation cancelled.", "Vytváření události zrušeno.", "Создание ивента отменено.", "Створення події скасовано."),
    "✅ Ивент создан!": _tr("✅ Event created!", "✅ Událost vytvořena!", "✅ Ивент создан!", "✅ Подію створено!"),
    "🎉 Название: ": _tr("🎉 Title: ", "🎉 Název: ", "🎉 Название: ", "🎉 Назва: "),
    "🌐 Языки ивента": _tr("🌐 Event languages", "🌐 Jazyky události", "🌐 Языки ивента", "🌐 Мови події"),
    "🎉 Title": _tr("🎉 Title", "🎉 Název", "🎉 Название", "🎉 Назва"),
    "👤 Organizer": _tr("👤 Organizer", "👤 Organizátor", "👤 Организатор", "👤 Організатор"),
    "📍 Location": _tr("📍 Location", "📍 Místo", "📍 Локация", "📍 Локація"),
    "📝 Description": _tr("📝 Description", "📝 Popis", "📝 Описание", "📝 Опис"),
    "👥 Max participants": _tr("👥 Max participants", "👥 Max. účastníků", "👥 Макс. участников", "👥 Макс. учасників"),
    "💰 Price": _tr("💰 Price", "💰 Cena", "💰 Цена", "💰 Ціна"),
    "💱 Currency": _tr("💱 Currency", "💱 Měna", "💱 Валюта", "💱 Валюта"),
    "💳 Payment instructions": _tr("💳 Payment instructions", "💳 Platební pokyny", "💳 Реквизиты оплаты", "💳 Реквізити оплати"),
    "🕒 Start time": _tr("🕒 Start time", "🕒 Začátek", "🕒 Время начала", "🕒 Час початку"),
    "⏰ Reminder time": _tr("⏰ Reminder time", "⏰ Čas připomínky", "⏰ Время напоминания", "⏰ Час нагадування"),
    "💬 Reminder text": _tr("💬 Reminder text", "💬 Text připomínky", "💬 Текст напоминания", "💬 Текст нагадування"),
    "🖼 Poster photo": _tr("🖼 Poster photo", "🖼 Plakát", "🖼 Постер", "🖼 Постер"),
    "Что изменить?": _tr("What would you like to change?", "Co chceš změnit?", "Что изменить?", "Що змінити?"),
    "Выберите новую валюту:": _tr("Choose a new currency:", "Vyber novou měnu:", "Выберите новую валюту:", "Оберіть нову валюту:"),
    "✅ Ивент обновлён.": _tr("✅ Event updated.", "✅ Událost aktualizována.", "✅ Ивент обновлён.", "✅ Подію оновлено."),

    # Broadcast admin UI. Broadcast CONTENT itself bypasses i18n.
    "👥 All users": _tr("👥 All users", "👥 Všichni uživatelé", "👥 Все пользователи", "👥 Усі користувачі"),
    "📅 Event participants": _tr("📅 Event participants", "📅 Účastníci události", "📅 Участники ивента", "📅 Учасники події"),
    "Кому отправить рассылку?": _tr("Who should receive the broadcast?", "Komu se má rozesílka poslat?", "Кому отправить рассылку?", "Кому надіслати розсилку?"),
    "Введите текст рассылки:": _tr("Enter broadcast text:", "Zadej text rozesílky:", "Введите текст рассылки:", "Введіть текст розсилки:"),
    "Отправьте фото. Подпись фото станет текстом рассылки.": _tr("Send a photo. Its caption will be the broadcast text.", "Pošli fotku. Její popisek bude text rozesílky.", "Отправьте фото. Подпись фото станет текстом рассылки.", "Надішліть фото. Підпис стане текстом розсилки."),

    # Structured error prefixes
    "Ошибка сохранения профиля: ": _tr("Profile save error: ", "Chyba při ukládání profilu: ", "Ошибка сохранения профиля: ", "Помилка збереження профілю: "),
    "Ошибка получения профиля: ": _tr("Profile loading error: ", "Chyba při načítání profilu: ", "Ошибка получения профиля: ", "Помилка отримання профілю: "),
    "Ошибка получения ивента: ": _tr("Event loading error: ", "Chyba při načítání události: ", "Ошибка получения ивента: ", "Помилка отримання події: "),
    "Ошибка при получении ивентов: ": _tr("Error loading events: ", "Chyba při načítání událostí: ", "Ошибка при получении ивентов: ", "Помилка отримання подій: "),
    "Ошибка при регистрации: ": _tr("Registration error: ", "Chyba registrace: ", "Ошибка при регистрации: ", "Помилка реєстрації: "),
    "Ошибка получения твоих ивентов: ": _tr("Error loading your events: ", "Chyba při načítání tvých událostí: ", "Ошибка получения твоих ивентов: ", "Помилка отримання твоїх подій: "),
    "Ошибка отписки: ": _tr("Error leaving event: ", "Chyba při odhlášení z události: ", "Ошибка отписки: ", "Помилка відписки від події: "),
    "Ошибка создания ивента: ": _tr("Event creation error: ", "Chyba při vytváření události: ", "Ошибка создания ивента: ", "Помилка створення події: "),
    "Ошибка редактирования: ": _tr("Editing error: ", "Chyba při úpravě: ", "Ошибка редактирования: ", "Помилка редагування: "),
    "Ошибка рассылки: ": _tr("Broadcast error: ", "Chyba rozesílky: ", "Ошибка рассылки: ", "Помилка розсилки: "),
}


UI_TRANSLATIONS.update({
    "Free": _tr("Free", "Zdarma", "Бесплатно", "Безкоштовно"),
    "Ошибка": _tr("Error", "Chyba", "Ошибка", "Помилка"),
    "Создаю CSV...": _tr("Creating CSV...", "Vytvářím CSV...", "Создаю CSV...", "Створюю CSV..."),
    "Нет доступа": _tr("Access denied", "Přístup odepřen", "Нет доступа", "Немає доступу"),
    "⛔ Нет доступа": _tr("⛔ Access denied", "⛔ Přístup odepřen", "⛔ Нет доступа", "⛔ Немає доступу"),
    "Ивент": _tr("Event", "Událost", "Ивент", "Подія"),
    "💰 Стоимость: ": _tr("💰 Price: ", "💰 Cena: ", "💰 Стоимость: ", "💰 Вартість: "),
    "Ошибка обновления профиля: ": _tr("Profile update error: ", "Chyba při aktualizaci profilu: ", "Ошибка обновления профиля: ", "Помилка оновлення профілю: "),
    "Не удалось прочитать номер телефона.": _tr("Could not read the phone number.", "Telefonní číslo se nepodařilo načíst.", "Не удалось прочитать номер телефона.", "Не вдалося прочитати номер телефону."),
    "Ошибка обновления телефона: ": _tr("Phone update error: ", "Chyba při aktualizaci telefonu: ", "Ошибка обновления телефона: ", "Помилка оновлення телефону: "),
    "Не удалось обновить телефон: ": _tr("Could not update phone: ", "Telefon se nepodařilo aktualizovat: ", "Не удалось обновить телефон: ", "Не вдалося оновити телефон: "),
    "Контакт получен, но сейчас ввод номера телефона не активен.": _tr(
        "Contact received, but phone-number input is not active right now.",
        "Kontakt byl přijat, ale zadávání telefonního čísla teď není aktivní.",
        "Контакт получен, но сейчас ввод номера телефона не активен.",
        "Контакт отримано, але введення номера телефону зараз не активне.",
    ),
    "Неизвестное поле": _tr("Unknown field", "Neznámé pole", "Неизвестное поле", "Невідоме поле"),
    "Некорректный номер телефона. Попробуйте ещё раз.": _tr("Invalid phone number. Try again.", "Neplatné telefonní číslo. Zkus to znovu.", "Некорректный номер телефона. Попробуйте ещё раз.", "Некоректний номер телефону. Спробуйте ще раз."),
    "Выберите Telegram или Instagram.": _tr("Choose Telegram or Instagram.", "Vyber Telegram nebo Instagram.", "Выберите Telegram или Instagram.", "Оберіть Telegram або Instagram."),
    "В профиле пока нет Instagram. Введите Instagram username или ссылку:": _tr(
        "There is no Instagram in your profile yet. Enter an Instagram username or link:",
        "V profilu zatím nemáš Instagram. Zadej uživatelské jméno nebo odkaz:",
        "В профиле пока нет Instagram. Введите Instagram username или ссылку:",
        "У профілі ще немає Instagram. Введіть Instagram username або посилання:",
    ),
    "Состояние редактирования сброшено.": _tr("Editing state was reset.", "Stav úprav byl resetován.", "Состояние редактирования сброшено.", "Стан редагування скинуто."),
    "Профиль не найден.": _tr("Profile not found.", "Profil nebyl nalezen.", "Профиль не найден.", "Профіль не знайдено."),
    "Недопустимый способ связи.": _tr("Invalid contact method.", "Neplatný způsob kontaktu.", "Недопустимый способ связи.", "Недопустимий спосіб зв'язку."),
    "Для способа связи Instagram нужно указать Instagram.": _tr(
        "Instagram must be provided when Instagram is the contact method.",
        "Pokud je způsob kontaktu Instagram, musí být Instagram vyplněn.",
        "Для способа связи Instagram нужно указать Instagram.",
        "Якщо спосіб зв'язку — Instagram, потрібно вказати Instagram.",
    ),
    "Телефон не может быть пустым.": _tr("Phone cannot be empty.", "Telefon nemůže být prázdný.", "Телефон не может быть пустым.", "Телефон не може бути порожнім."),
    "Не удалось обновить профиль: ": _tr("Could not update profile: ", "Profil se nepodařilo aktualizovat: ", "Не удалось обновить профиль: ", "Не вдалося оновити профіль: "),
    "Нужно пройти регистрацию": _tr("Registration required", "Je nutná registrace", "Нужно пройти регистрацию", "Потрібна реєстрація"),
    "Ошибка регистрации": _tr("Registration error", "Chyba registrace", "Ошибка регистрации", "Помилка реєстрації"),
    "❌ На этом ивенте больше нет свободных мест.": _tr("❌ There are no spots left for this event.", "❌ Na této události už nejsou volná místa.", "❌ На этом ивенте больше нет свободных мест.", "❌ На цій події більше немає вільних місць."),
    "❌ Этот ивент был отменён.": _tr("❌ This event was cancelled.", "❌ Tato událost byla zrušena.", "❌ Этот ивент был отменён.", "❌ Цю подію було скасовано."),
    "❌ Этот ивент уже начался.": _tr("❌ This event has already started.", "❌ Tato událost už začala.", "❌ Этот ивент уже начался.", "❌ Ця подія вже почалася."),
    "❌ У этого ивента не указано время начала.": _tr("❌ This event has no start time.", "❌ U této události není uveden čas začátku.", "❌ У этого ивента не указано время начала.", "❌ Для цієї події не вказано час початку."),
    "Сначала пройди регистрацию.": _tr("Complete registration first.", "Nejdřív dokonči registraci.", "Сначала пройди регистрацию.", "Спочатку пройди реєстрацію."),
    "❌ Для этого платного ивента организатор ещё не добавил реквизиты для оплаты.": _tr(
        "❌ The organizer has not added payment details for this paid event yet.",
        "❌ Organizátor zatím nepřidal platební údaje pro tuto placenou událost.",
        "❌ Для этого платного ивента организатор ещё не добавил реквизиты для оплаты.",
        "❌ Організатор ще не додав реквізити для оплати цієї платної події.",
    ),
    "Готово!": _tr("Done!", "Hotovo!", "Готово!", "Готово!"),
    "Ты уже записан": _tr("You already joined", "Už jsi přihlášen(a)", "Ты уже записан", "Ти вже приєднався(-лася)"),
    "Не получилось": _tr("Could not complete", "Nepodařilo se", "Не получилось", "Не вдалося"),
    "Ответ сервера: ": _tr("Server response: ", "Odpověď serveru: ", "Ответ сервера: ", "Відповідь сервера: "),
    "Ошибка получения реквизитов: ": _tr("Error loading payment details: ", "Chyba při načítání platebních údajů: ", "Ошибка получения реквизитов: ", "Помилка отримання реквізитів: "),
    "Недоступно": _tr("Unavailable", "Nedostupné", "Недоступно", "Недоступно"),
    "Реквизиты недоступны: ": _tr("Payment details unavailable: ", "Platební údaje nejsou dostupné: ", "Реквизиты недоступны: ", "Реквізити недоступні: "),
    "Готово": _tr("Done", "Hotovo", "Готово", "Готово"),
    "Запись не найдена": _tr("Registration not found", "Registrace nebyla nalezena", "Запись не найдена", "Реєстрацію не знайдено"),
    "Ошибка получения участников: ": _tr("Error loading participants: ", "Chyba při načítání účastníků: ", "Ошибка получения участников: ", "Помилка отримання учасників: "),
    "Ошибка подтверждения оплаты: ": _tr("Payment confirmation error: ", "Chyba při potvrzení platby: ", "Ошибка подтверждения оплаты: ", "Помилка підтвердження оплати: "),
    "Не подтверждено": _tr("Not confirmed", "Nepotvrzeno", "Не подтверждено", "Не підтверджено"),
    "Не удалось подтвердить оплату: ": _tr("Could not confirm payment: ", "Platbu se nepodařilo potvrdit: ", "Не удалось подтвердить оплату: ", "Не вдалося підтвердити оплату: "),
    "📤 Participants: ": _tr("📤 Participants: ", "📤 Účastníci: ", "📤 Участники: ", "📤 Учасники: "),
    "Создаю CSV...": _tr("Creating CSV...", "Vytvářím CSV...", "Создаю CSV...", "Створюю CSV..."),
    "Ошибка экспорта: ": _tr("Export error: ", "Chyba exportu: ", "Ошибка экспорта: ", "Помилка експорту: "),
    "Нужно ввести целое число.": _tr("Enter a whole number.", "Zadej celé číslo.", "Нужно ввести целое число.", "Потрібно ввести ціле число."),
    "Количество участников должно быть больше нуля.": _tr("Participant limit must be greater than zero.", "Počet účastníků musí být větší než nula.", "Количество участников должно быть больше нуля.", "Кількість учасників має бути більшою за нуль."),
    "Введите корректную цену.": _tr("Enter a valid price.", "Zadej platnou cenu.", "Введите корректную цену.", "Введіть коректну ціну."),
    "Цена не может быть отрицательной.": _tr("Price cannot be negative.", "Cena nemůže být záporná.", "Цена не может быть отрицательной.", "Ціна не може бути від'ємною."),
    "Выберите CZK, EUR или USD.": _tr("Choose CZK, EUR or USD.", "Vyber CZK, EUR nebo USD.", "Выберите CZK, EUR или USD.", "Оберіть CZK, EUR або USD."),
    "Реквизиты для платного ивента не могут быть пустыми.": _tr(
        "Payment details cannot be empty for a paid event.",
        "Platební údaje u placené události nemohou být prázdné.",
        "Реквизиты для платного ивента не могут быть пустыми.",
        "Реквізити для платної події не можуть бути порожніми.",
    ),
    "Неверный формат. Используйте YYYY-MM-DD HH:MM.": _tr("Invalid format. Use YYYY-MM-DD HH:MM.", "Neplatný formát. Použij YYYY-MM-DD HH:MM.", "Неверный формат. Используйте YYYY-MM-DD HH:MM.", "Невірний формат. Використовуйте YYYY-MM-DD HH:MM."),
    "Неверный формат. Примеры: 12h, 30m, 1d или skip.": _tr("Invalid format. Examples: 12h, 30m, 1d or skip.", "Neplatný formát. Příklady: 12h, 30m, 1d nebo skip.", "Неверный формат. Примеры: 12h, 30m, 1d или skip.", "Невірний формат. Приклади: 12h, 30m, 1d або skip."),
    "Введите текст напоминания.": _tr("Enter reminder text.", "Zadej text připomínky.", "Введите текст напоминания.", "Введіть текст нагадування."),
    "Отправь новое фото постера или напиши cancel.": _tr("Send a new poster photo or type cancel.", "Pošli nový plakát nebo napiš cancel.", "Отправь новое фото постера или напиши cancel.", "Надішли нове фото постера або напиши cancel."),
    "Введите новое название:": _tr("Enter a new title:", "Zadej nový název:", "Введите новое название:", "Введіть нову назву:"),
    "Введите нового организатора:": _tr("Enter a new organizer:", "Zadej nového organizátora:", "Введите нового организатора:", "Введіть нового організатора:"),
    "Введите новую локацию:": _tr("Enter a new location:", "Zadej nové místo:", "Введите новую локацию:", "Введіть нову локацію:"),
    "Введите новое описание:": _tr("Enter a new description:", "Zadej nový popis:", "Введите новое описание:", "Введіть новий опис:"),
    "Введите новый лимит участников:": _tr("Enter a new participant limit:", "Zadej nový limit účastníků:", "Введите новый лимит участников:", "Введіть новий ліміт учасників:"),
    "Введите новую цену:": _tr("Enter a new price:", "Zadej novou cenu:", "Введите новую цену:", "Введіть нову ціну:"),
    "Введите новые реквизиты и инструкцию для оплаты:": _tr("Enter new payment details and instructions:", "Zadej nové platební údaje a pokyny:", "Введите новые реквизиты и инструкцию для оплаты:", "Введіть нові реквізити та інструкцію для оплати:"),
    "Введите новую дату: YYYY-MM-DD HH:MM": _tr("Enter a new date: YYYY-MM-DD HH:MM", "Zadej nové datum: YYYY-MM-DD HH:MM", "Введите новую дату: YYYY-MM-DD HH:MM", "Введіть нову дату: YYYY-MM-DD HH:MM"),
    "Введите новое время напоминания: 12h, 30m, 1d или skip.": _tr("Enter a new reminder time: 12h, 30m, 1d or skip.", "Zadej nový čas připomínky: 12h, 30m, 1d nebo skip.", "Введите новое время напоминания: 12h, 30m, 1d или skip.", "Введіть новий час нагадування: 12h, 30m, 1d або skip."),
    "Введите новый текст напоминания или '-' для удаления.": _tr("Enter new reminder text or '-' to remove it.", "Zadej nový text připomínky nebo '-' pro odstranění.", "Введите новый текст напоминания или '-' для удаления.", "Введіть новий текст нагадування або '-' для видалення."),
    "Не удалось обновить ивент: ": _tr("Could not update event: ", "Událost se nepodařilo aktualizovat: ", "Не удалось обновить ивент: ", "Не вдалося оновити подію: "),
    "Некорректное значение. Попробуй ещё раз.": _tr("Invalid value. Try again.", "Neplatná hodnota. Zkus to znovu.", "Некорректное значение. Попробуй ещё раз.", "Некоректне значення. Спробуй ще раз."),
    "Введите причину отмены или напишите cancel:": _tr("Enter a cancellation reason or type cancel:", "Zadej důvod zrušení nebo napiš cancel:", "Введите причину отмены или напишите cancel:", "Введіть причину скасування або напишіть cancel:"),
    "Отмена ивента отменена.": _tr("Event cancellation was cancelled.", "Rušení události bylo zrušeno.", "Отмена ивента отменена.", "Скасування події скасовано."),
    "Причина не может быть пустой.": _tr("Reason cannot be empty.", "Důvod nemůže být prázdný.", "Причина не может быть пустой.", "Причина не може бути порожньою."),
    "Ошибка отмены ивента: ": _tr("Event cancellation error: ", "Chyba při rušení události: ", "Ошибка отмены ивента: ", "Помилка скасування події: "),
    "✅ Ивент отменён.": _tr("✅ Event cancelled.", "✅ Událost zrušena.", "✅ Ивент отменён.", "✅ Подію скасовано."),
    "Уведомлено участников: ": _tr("Participants notified: ", "Informováno účastníků: ", "Уведомлено участников: ", "Повідомлено учасників: "),
    "Выберите ивент:": _tr("Choose an event:", "Vyber událost:", "Выберите ивент:", "Оберіть подію:"),
    "Текст не может быть пустым.": _tr("Text cannot be empty.", "Text nemůže být prázdný.", "Текст не может быть пустым.", "Текст не може бути порожнім."),
    "✅ Рассылка завершена.": _tr("✅ Broadcast completed.", "✅ Rozesílka dokončena.", "✅ Рассылка завершена.", "✅ Розсилку завершено."),
    "Отправлено: ": _tr("Sent: ", "Odesláno: ", "Отправлено: ", "Надіслано: "),
    "Ошибок: ": _tr("Errors: ", "Chyb: ", "Ошибок: ", "Помилок: "),
    "Ошибка обновления постера: ": _tr("Poster update error: ", "Chyba při aktualizaci plakátu: ", "Ошибка обновления постера: ", "Помилка оновлення постера: "),
    "✅ Постер обновлён.": _tr("✅ Poster updated.", "✅ Plakát aktualizován.", "✅ Постер обновлён.", "✅ Постер оновлено."),
})


def get_interface_language(
    telegram_id: int | None,
    *,
    refresh: bool = False,
) -> str:
    if telegram_id is None:
        return DEFAULT_INTERFACE_LANGUAGE

    try:
        telegram_id = int(telegram_id)
    except (TypeError, ValueError):
        return DEFAULT_INTERFACE_LANGUAGE

    if (
        not refresh
        and telegram_id in user_language_cache
    ):
        return user_language_cache[telegram_id]

    try:
        data = backend_request(
            "GET",
            f"/users/{telegram_id}/language",
            timeout=5,
        )
        language = str(
            data.get("language")
            or DEFAULT_INTERFACE_LANGUAGE
        ).lower()
    except Exception:
        language = DEFAULT_INTERFACE_LANGUAGE

    if language not in SUPPORTED_INTERFACE_LANGUAGES:
        language = DEFAULT_INTERFACE_LANGUAGE

    user_language_cache[telegram_id] = language
    return language


def set_interface_language(
    telegram_id: int,
    language: str,
) -> str:
    language = language.strip().lower()

    if language not in SUPPORTED_INTERFACE_LANGUAGES:
        raise ValueError("unsupported_language")

    data = backend_request(
        "PUT",
        f"/users/{telegram_id}/language",
        json={"language": language},
        timeout=10,
    )

    language = str(
        data.get("language") or language
    ).lower()

    user_language_cache[telegram_id] = language
    return language


def localized_language_name(
    language_code: str,
    telegram_id: int | None,
) -> str:
    interface_language = get_interface_language(
        telegram_id
    )

    return LANGUAGE_NAMES.get(
        interface_language,
        LANGUAGE_NAMES["ru"],
    ).get(
        str(language_code).lower(),
        str(language_code).upper(),
    )


_CUSTOM_TEXT_START = "\ue000"
_CUSTOM_TEXT_END = "\ue001"


def preserve_custom(value: Any) -> str:
    if value is None:
        value = "-"

    # Strip our private markers if they somehow appear in input.
    text = str(value).replace(
        _CUSTOM_TEXT_START,
        "",
    ).replace(
        _CUSTOM_TEXT_END,
        "",
    )

    return (
        f"{_CUSTOM_TEXT_START}"
        f"{text}"
        f"{_CUSTOM_TEXT_END}"
    )


def _translate_ui_segment(
    segment: str,
    language: str,
) -> str:
    result = segment

    for source in sorted(
        UI_TRANSLATIONS,
        key=len,
        reverse=True,
    ):
        if source not in result:
            continue

        replacement = UI_TRANSLATIONS[source].get(
            language
        )

        if replacement is not None:
            result = result.replace(
                source,
                replacement,
            )

    return result


def localize_system_text(
    telegram_id: int | None,
    text: str | None,
) -> str | None:
    if text is None:
        return None

    language = get_interface_language(
        telegram_id
    )
    source_text = str(text)

    parts: list[str] = []
    cursor = 0

    while True:
        start_index = source_text.find(
            _CUSTOM_TEXT_START,
            cursor,
        )

        if start_index == -1:
            parts.append(
                _translate_ui_segment(
                    source_text[cursor:],
                    language,
                )
            )
            break

        parts.append(
            _translate_ui_segment(
                source_text[cursor:start_index],
                language,
            )
        )

        content_start = (
            start_index
            + len(_CUSTOM_TEXT_START)
        )
        end_index = source_text.find(
            _CUSTOM_TEXT_END,
            content_start,
        )

        if end_index == -1:
            # Malformed marker: keep the remainder unchanged.
            parts.append(
                source_text[content_start:]
            )
            break

        parts.append(
            source_text[
                content_start:end_index
            ]
        )

        cursor = (
            end_index
            + len(_CUSTOM_TEXT_END)
        )

    return "".join(parts)


def format_event_languages(
    languages: list[str] | None,
    telegram_id: int | None,
) -> str:
    normalized: list[str] = []

    for language in languages or []:
        language = str(language).lower()

        if (
            language in SUPPORTED_INTERFACE_LANGUAGES
            and language not in normalized
        ):
            normalized.append(language)

    if not normalized:
        return localize_system_text(
            telegram_id,
            "Не указано",
        )

    return ", ".join(
        localized_language_name(
            language,
            telegram_id,
        )
        for language in normalized
    )


def ui_text_matches(
    text: str | None,
    source: str,
) -> bool:
    # Accept both legacy emoji labels and clean TicketTreat 1.0 labels.
    def clean_label(value: str) -> str:
        import unicodedata
        value = value.strip()
        while value and (unicodedata.category(value[0]) in {"So", "Sk", "Cf", "Mn"} or value[0].isspace()):
            value = value[1:]
        return value.strip()

    normalized = clean_label(text or "")
    return normalized in {
        clean_label(source),
        *(clean_label(value) for value in UI_TRANSLATIONS.get(source, {}).values()),
    }


def cancellation_word(text: str | None) -> bool:
    return (text or "").strip().lower() in {
        "cancel",
        "canceled",
        "cancelled",
        "отмена",
        "отменить",
        "zrušit",
        "zrusit",
        "скасувати",
        "скасування",
    }


def skip_word(text: str | None) -> bool:
    value = (text or "").strip().lower()

    return (
        value in {
            "skip",
            "none",
            "no",
            "-",
            "пропустить",
            "přeskočit",
            "preskocit",
            "пропустити",
        }
        or ui_text_matches(
            text,
            "⏭️ Пропустить",
        )
    )


def free_word(text: str | None) -> bool:
    return (text or "").strip().lower() in {
        "free",
        "бесплатно",
        "zdarma",
        "bezplatně",
        "bezplatne",
        "безкоштовно",
    }


def get_language_selector_keyboard(
    callback_prefix: str,
) -> InlineKeyboardMarkup:
    keyboard = InlineKeyboardMarkup()

    for language in SUPPORTED_INTERFACE_LANGUAGES:
        keyboard.add(
            InlineKeyboardButton(
                LANGUAGE_SELECTOR_LABELS[language],
                callback_data=(
                    f"{callback_prefix}:{language}"
                ),
            )
        )

    return keyboard


def get_event_languages_keyboard(
    selected: set[str] | list[str],
    *,
    callback_prefix: str,
    include_back: bool = True,
) -> InlineKeyboardMarkup:
    selected_set = {
        str(language).lower()
        for language in selected
    }

    keyboard = InlineKeyboardMarkup()

    for language in SUPPORTED_INTERFACE_LANGUAGES:
        prefix = (
            "✅"
            if language in selected_set
            else "⬜"
        )

        keyboard.add(
            InlineKeyboardButton(
                f"{prefix} "
                f"{LANGUAGE_SELECTOR_LABELS[language]}",
                callback_data=(
                    f"{callback_prefix}:toggle:{language}"
                ),
            )
        )

    keyboard.add(
        InlineKeyboardButton(
            "✅ Готово",
            callback_data=f"{callback_prefix}:done",
        )
    )

    if include_back:
        keyboard.add(
            InlineKeyboardButton(
                "⬅️ Back",
                callback_data=f"{callback_prefix}:back",
            )
        )

    return keyboard


def send_language_selection(
    chat_id: int,
    *,
    callback_prefix: str,
    registration: bool = False,
):
    keyboard = get_language_selector_keyboard(
        callback_prefix
    )

    if registration:
        # This screen is intentionally multilingual because the user
        # has not chosen an interface language yet.
        _raw_send_message(
            chat_id,
            "🌐 Choose your interface language\n"
            "🌐 Vyberte jazyk rozhraní\n"
            "🌐 Выберите язык интерфейса\n"
            "🌐 Оберіть мову інтерфейсу",
            reply_markup=keyboard,
        )
        return

    bot.send_message(
        chat_id,
        "🌐 Выберите язык интерфейса:",
        reply_markup=keyboard,
    )


def _localize_reply_markup(
    reply_markup,
    telegram_id: int | None,
):
    if reply_markup is None:
        return None

    try:
        localized = copy.deepcopy(
            reply_markup
        )

        keyboard = getattr(
            localized,
            "keyboard",
            None,
        )

        if keyboard is None:
            keyboard = getattr(
                localized,
                "inline_keyboard",
                None,
            )

        if keyboard is None:
            return localized

        for row in keyboard:
            for button in row:
                if getattr(
                    button,
                    "text",
                    None,
                ):
                    button.text = (
                        localize_system_text(
                            telegram_id,
                            button.text,
                        )
                    )

        return localized
    except Exception:
        return reply_markup


_raw_send_message = bot.send_message
_raw_send_photo = bot.send_photo
_raw_edit_message_text = bot.edit_message_text
_raw_answer_callback_query = (
    bot.answer_callback_query
)


def _localized_send_message(
    chat_id,
    text,
    *args,
    **kwargs,
):
    kwargs["reply_markup"] = (
        _localize_reply_markup(
            kwargs.get("reply_markup"),
            chat_id,
        )
    )

    return _raw_send_message(
        chat_id,
        localize_system_text(
            chat_id,
            text,
        ),
        *args,
        **kwargs,
    )


def _localized_send_photo(
    chat_id,
    photo,
    *args,
    **kwargs,
):
    if kwargs.get("caption") is not None:
        kwargs["caption"] = (
            localize_system_text(
                chat_id,
                kwargs["caption"],
            )
        )

    kwargs["reply_markup"] = (
        _localize_reply_markup(
            kwargs.get("reply_markup"),
            chat_id,
        )
    )

    return _raw_send_photo(
        chat_id,
        photo,
        *args,
        **kwargs,
    )


def _localized_edit_message_text(
    text,
    chat_id=None,
    message_id=None,
    *args,
    **kwargs,
):
    kwargs["reply_markup"] = (
        _localize_reply_markup(
            kwargs.get("reply_markup"),
            chat_id,
        )
    )

    return _raw_edit_message_text(
        localize_system_text(
            chat_id,
            text,
        ),
        chat_id,
        message_id,
        *args,
        **kwargs,
    )


def answer_callback(
    call,
    text: str | None = None,
    **kwargs,
):
    return _raw_answer_callback_query(
        call.id,
        localize_system_text(
            call.from_user.id,
            text,
        ),
        **kwargs,
    )


bot.send_message = _localized_send_message
bot.send_photo = _localized_send_photo
bot.edit_message_text = (
    _localized_edit_message_text
)


def is_admin(user_id: int) -> bool:
    return user_id in ADMIN_IDS


def require_admin_callback(call) -> bool:
    if is_admin(call.from_user.id):
        return True

    answer_callback(call, "Нет доступа")
    return False


def require_admin_message(message) -> bool:
    if is_admin(message.from_user.id):
        return True

    bot.send_message(
        message.chat.id,
        "⛔ Нет доступа",
        reply_markup=get_main_menu(message.from_user.id),
    )
    return False


def get_main_menu(user_id: int):
    keyboard = ReplyKeyboardMarkup(resize_keyboard=True, row_width=2)

    keyboard.row(
        KeyboardButton("🏠 Start"),
        KeyboardButton("📅 Events"),
    )
    keyboard.row(
        KeyboardButton("🎟 My events"),
        KeyboardButton("👤 My profile"),
    )
    keyboard.row(KeyboardButton("🆘 Client service"))

    # One real Mini App for web and Telegram (private chats only).
    # The frontend verifies signed initData with Demo API before linking identity.
    if WEB_APP_URL.startswith("https://"):
        keyboard.row(
            KeyboardButton(
                "🌐 TicketTreat Mini App",
                web_app=WebAppInfo(url=WEB_APP_URL),
            )
        )

    if is_admin(user_id):
        keyboard.row(KeyboardButton("⚙️ Admin"))

    return keyboard


def get_event_creation_nav_keyboard(
    *,
    include_skip: bool = False,
):
    keyboard = ReplyKeyboardMarkup(
        resize_keyboard=True,
        one_time_keyboard=True,
    )

    buttons = [KeyboardButton("⬅️ Назад")]

    if include_skip:
        buttons.append(KeyboardButton("⏭️ Пропустить"))

    keyboard.row(*buttons)
    keyboard.row(KeyboardButton("❌ Отмена"))

    return keyboard


def get_currency_keyboard(
    *,
    include_back: bool = True,
):
    keyboard = ReplyKeyboardMarkup(
        resize_keyboard=True,
        one_time_keyboard=True,
    )

    keyboard.row(
        KeyboardButton("CZK"),
        KeyboardButton("EUR"),
        KeyboardButton("USD"),
    )

    if include_back:
        keyboard.row(
            KeyboardButton("⬅️ Назад"),
            KeyboardButton("❌ Отмена"),
        )

    return keyboard


def get_profile_edit_keyboard():
    keyboard = InlineKeyboardMarkup()

    keyboard.row(
        InlineKeyboardButton(
            "✏️ Имя",
            callback_data="profile_edit:first_name",
        ),
        InlineKeyboardButton(
            "✏️ Фамилия",
            callback_data="profile_edit:last_name",
        ),
    )
    keyboard.row(
        InlineKeyboardButton(
            "📞 Телефон",
            callback_data="profile_edit:phone",
        )
    )
    keyboard.row(
        InlineKeyboardButton(
            "💬 Способ связи",
            callback_data="profile_edit:contact_preference",
        )
    )
    keyboard.row(
        InlineKeyboardButton(
            "📸 Instagram",
            callback_data="profile_edit:instagram",
        )
    )
    keyboard.row(
        InlineKeyboardButton(
            "🌐 Язык интерфейса",
            callback_data="profile_edit:language",
        )
    )
    keyboard.row(
        InlineKeyboardButton(
            "🔄 Обновить",
            callback_data="profile:refresh",
        )
    )

    return keyboard


def get_profile_edit_cancel_keyboard():
    keyboard = ReplyKeyboardMarkup(
        resize_keyboard=True,
        one_time_keyboard=True,
    )
    keyboard.row(KeyboardButton("❌ Отмена"))
    return keyboard


def build_event_link(event_id: int) -> str:
    if not BOT_USERNAME:
        return f"event_{event_id}"

    return f"https://t.me/{BOT_USERNAME}?start=event_{event_id}"


def build_web_event_url(
    event_id: int,
    user_id: int,
) -> str | None:
    if not WEB_APP_URL.startswith("https://"):
        return None

    language = get_interface_language(user_id)
    return f"{WEB_APP_URL}/events/{event_id}?lang={language}"


def format_event_datetime(value) -> str:
    if not value:
        return "-"

    try:
        parsed = (
            datetime.fromisoformat(value)
            if isinstance(value, str)
            else value
        )

        if parsed.tzinfo is not None:
            parsed = parsed.astimezone(PRAGUE_TZ)

        return parsed.strftime("%d.%m.%Y %H:%M")
    except Exception:
        return str(value)


def format_event_price(
    price,
    currency: str | None,
) -> str:
    if price is None:
        return "Free"

    try:
        value = Decimal(str(price))
    except (InvalidOperation, TypeError, ValueError):
        return f"{price} {currency or 'CZK'}"

    if value == 0:
        return "Free"

    formatted = format(value.normalize(), "f")

    if "." in formatted:
        formatted = formatted.rstrip("0").rstrip(".")

    currency = (currency or "CZK").upper()

    if currency == "CZK":
        return f"{formatted} Kč"

    if currency == "EUR":
        return f"€{formatted}"

    if currency == "USD":
        return f"${formatted}"

    return f"{formatted} {currency}"



def payment_status_label(
    status: str | None,
    telegram_id: int | None = None,
) -> str:
    if status == "pending":
        return localize_system_text(
            telegram_id,
            "⏳ Ожидает подтверждения",
        )

    if status == "confirmed":
        return localize_system_text(
            telegram_id,
            "✅ Подтверждена",
        )

    return "-"


def send_payment_instructions_message(
    chat_id: int,
    data: dict[str, Any],
    *,
    already_registered: bool = False,
):
    event_title = preserve_custom(
        data.get("title") or "Ивент"
    )
    instructions = preserve_custom(
        data.get("payment_instructions") or "-"
    )
    deadline = format_event_datetime(data.get("payment_deadline"))
    price_text = format_event_price(
        data.get("price"),
        data.get("currency"),
    )

    intro = (
        "ℹ️ У тебя уже есть место на этом ивенте."
        if already_registered
        else "✅ Твоё место на ивенте зарезервировано."
    )

    bot.send_message(
        chat_id,
        f"{intro}\n\n"
        f"🎉 {event_title}\n"
        f"💰 Стоимость: {price_text}\n\n"
        "💳 Для завершения регистрации оплати билет "
        "по реквизитам ниже:\n\n"
        f"{instructions}\n\n"
        "⏳ Администратор должен подтвердить оплату "
        "в течение 24 часов.\n"
        f"Крайний срок подтверждения: {deadline}\n\n"
        "Если оплата не будет подтверждена вовремя, "
        "бронь автоматически отменится.",
    )


def normalize_phone(phone: str) -> str | None:
    phone = phone.strip()

    allowed = set("0123456789+()- ")

    if any(character not in allowed for character in phone):
        return None

    cleaned = "".join(
        character
        for character in phone
        if character.isdigit() or character == "+"
    )

    digit_count = len(cleaned) - 1 if cleaned.startswith("+") else len(cleaned)

    if not 10 <= digit_count <= 15:
        return None

    return cleaned


def parse_reminder_time(text: str) -> int | None:
    normalized = text.strip().lower()

    if skip_word(text):
        return None

    try:
        if normalized.endswith("m"):
            value = int(normalized[:-1])
        elif normalized.endswith("h"):
            value = int(normalized[:-1]) * 60
        elif normalized.endswith("d"):
            value = int(normalized[:-1]) * 24 * 60
        else:
            value = int(normalized)
    except ValueError:
        return None

    return value if value > 0 else None


def is_profile_complete(telegram_id: int) -> bool:
    try:
        data = backend_request(
            "GET",
            f"/profile/{telegram_id}",
            timeout=5,
        )
        return bool(data.get("complete"))
    except Exception as error:
        print("[PROFILE CHECK ERROR]", repr(error))
        return False


def ask_to_register(chat_id: int):
    keyboard = InlineKeyboardMarkup()
    keyboard.add(
        InlineKeyboardButton(
            "✅ Пройти регистрацию",
            callback_data="go_profile",
        )
    )

    bot.send_message(
        chat_id,
        "Чтобы записываться на ивенты, сначала пройди регистрацию.",
        reply_markup=keyboard,
    )


def event_card_text(
    event: dict[str, Any],
    telegram_id: int | None = None,
) -> str:
    registered_count = event.get("registered_count", 0)
    max_participants = event.get("max_participants")
    spots_left = event.get("spots_left")

    if max_participants is None:
        capacity_line = f"👥 Участников: {registered_count}"
    else:
        capacity_line = (
            f"👥 Участников: {registered_count}/{max_participants}\n"
            f"🪑 Осталось мест: {spots_left}"
        )

    payment_line = ""

    if event.get("payment_required") and event.get("payment_status"):
        payment_line = (
            "\n💳 Оплата: "
            f"{payment_status_label(event.get('payment_status'), telegram_id)}"
        )

        if event.get("payment_status") == "pending":
            payment_line += (
                "\n⏰ Подтвердить до: "
                f"{format_event_datetime(event.get('payment_deadline'))}"
            )

    cancellation = ""

    if event.get("is_cancelled"):
        cancellation = (
            "\n\n❌ Ивент отменён"
            f"\nПричина: "
            f"{preserve_custom(event.get('cancellation_reason') or '-')}"
        )

    return (
        f"🎟 {preserve_custom(event.get('title') or '-')}\n"
        f"━━━━━━━━━━━━━━\n"
        f"👤 Организатор: "
        f"{preserve_custom(event.get('organizer') or '-')}\n"
        f"📍 Локация: "
        f"{preserve_custom(event.get('location') or '-')}\n"
        f"📝 Описание: "
        f"{preserve_custom(event.get('description') or '-')}\n"
        f"━━━━━━━━━━━━━━\n"
        f"💰 Цена: "
        f"{format_event_price(event.get('price'), event.get('currency'))}\n"
        f"🌐 Языки: "
        f"{format_event_languages(event.get('languages'), telegram_id)}\n"
        f"{capacity_line}\n"
        f"🕒 Начало: {format_event_datetime(event.get('starts_at'))}"
        f"{payment_line}"
        f"{cancellation}"
    )


def send_event_card(
    chat_id: int,
    event: dict[str, Any],
    *,
    reply_markup=None,
):
    text = event_card_text(event, chat_id)
    photo_file_id = event.get("telegram_photo_file_id")

    if photo_file_id:
        try:
            if len(text) <= 1000:
                bot.send_photo(
                    chat_id,
                    photo=photo_file_id,
                    caption=text,
                    reply_markup=reply_markup,
                )
            else:
                bot.send_photo(chat_id, photo=photo_file_id)
                bot.send_message(
                    chat_id,
                    text,
                    reply_markup=reply_markup,
                )
            return
        except Exception as error:
            print("[EVENT PHOTO ERROR]", repr(error))

    bot.send_message(
        chat_id,
        text,
        reply_markup=reply_markup,
    )


# =========================================================
# Profile helpers
# =========================================================
def save_profile_to_backend(message):
    telegram_id = message.from_user.id
    data = user_temp.get(telegram_id, {})

    payload = {
        "telegram_id": telegram_id,
        "username": message.from_user.username,
        "first_name": data.get("first_name"),
        "last_name": data.get("last_name"),
        "phone": data.get("phone"),
        "contact_preference": data.get("contact_preference"),
        "instagram": data.get("instagram"),
    }

    try:
        backend_request(
            "POST",
            "/profile",
            json=payload,
            timeout=10,
        )
    except Exception as error:
        bot.send_message(
            message.chat.id,
            f"Ошибка сохранения профиля: {error}",
            reply_markup=get_main_menu(telegram_id),
        )
        return

    user_state.pop(telegram_id, None)
    user_temp.pop(telegram_id, None)

    bot.send_message(
        message.chat.id,
        "✅ Профиль сохранён!",
        reply_markup=get_main_menu(telegram_id),
    )

    pending_event_id = (
        pending_event_after_registration.pop(
            telegram_id,
            None,
        )
    )

    if pending_event_id is not None:
        show_event_details_by_id(
            message.chat.id,
            telegram_id,
            pending_event_id,
        )


# =========================================================
# Event display helpers
# =========================================================
def show_event_details_by_id(
    chat_id: int,
    user_id: int,
    event_id: int,
):
    # Canonical published event details, media, pricing and booking rules
    # live in the unified website/Mini App, not the legacy bot endpoints.
    if WEB_APP_URL.startswith("https://"):
        keyboard = InlineKeyboardMarkup()
        keyboard.add(InlineKeyboardButton("🎟 Открыть событие в TicketTreat",
            web_app=WebAppInfo(url=f"{WEB_APP_URL}/events/{event_id}")))
        bot.send_message(chat_id,
            "Описание, фотографии, билеты и актуальная доступность мест "
            "отображаются в TicketTreat Mini App.",
            reply_markup=keyboard)
        return
    if not is_profile_complete(user_id):
        pending_event_after_registration[user_id] = (
            event_id
        )
        ask_to_register(chat_id)
        return

    try:
        event = backend_request(
            "GET",
            f"/events/{event_id}",
            timeout=10,
        )
    except Exception as error:
        bot.send_message(
            chat_id,
            f"Ошибка получения ивента: {error}",
            reply_markup=get_main_menu(user_id),
        )
        return

    if event.get("error") == "event_not_found":
        bot.send_message(
            chat_id,
            "Ивент не найден.",
            reply_markup=get_main_menu(user_id),
        )
        return

    keyboard = InlineKeyboardMarkup()

    is_cancelled = bool(event.get("is_cancelled"))
    spots_left = event.get("spots_left")

    if is_cancelled:
        keyboard.add(
            InlineKeyboardButton(
                "❌ Ивент отменён",
                callback_data="noop",
            )
        )
    elif event.get("payment_required") and WEB_APP_URL.startswith("https://"):
        keyboard.add(
            InlineKeyboardButton(
                "⏳ Заявка на оплату — 24 часа" if spots_left != 0 else "⏳ Проверить мою заявку",
                web_app=WebAppInfo(url=f"{WEB_APP_URL}/checkout/{event_id}"),
            )
        )
    elif spots_left == 0:
        keyboard.add(
            InlineKeyboardButton(
                "❌ Нет свободных мест",
                callback_data="noop",
            )
        )
    else:
        keyboard.add(
            InlineKeyboardButton(
                "✅ Записаться",
                callback_data=f"reg:{event_id}",
            )
        )

    web_event_url = build_web_event_url(
        event_id,
        user_id,
    )

    if web_event_url:
        keyboard.add(
            InlineKeyboardButton(
                "🌐 Open in app",
                web_app=WebAppInfo(url=web_event_url),
            )
        )

    send_event_card(
        chat_id,
        event,
        reply_markup=keyboard,
    )


# =========================================================
# Reminder worker
# =========================================================
def notification_worker():
    print("REMINDER WORKER STARTED")

    while True:
        try:
            events = backend_request(
                "GET",
                "/events",
                timeout=15,
            )
        except Exception as error:
            print("[REMINDER EVENTS ERROR]", repr(error))
            time.sleep(60)
            continue

        now = datetime.now()

        for event in events:
            if event.get("is_cancelled"):
                continue

            event_id = event.get("id")
            starts_at_raw = event.get("starts_at")
            reminder_minutes = event.get("reminder_minutes_before")
            reminder_text = event.get("reminder_text")
            reminder_sent = event.get("reminder_sent")

            if (
                not event_id
                or not starts_at_raw
                or not reminder_minutes
                or not reminder_text
                or reminder_sent
            ):
                continue

            try:
                starts_at = datetime.fromisoformat(starts_at_raw)
            except (TypeError, ValueError):
                continue

            difference_minutes = (
                starts_at - now
            ).total_seconds() / 60

            if not 0 < difference_minutes <= reminder_minutes:
                continue

            try:
                participants = backend_request(
                    "GET",
                    f"/events/{event_id}/participants",
                    timeout=15,
                )
            except Exception as error:
                print("[REMINDER PARTICIPANTS ERROR]", repr(error))
                continue

            for participant in participants:
                telegram_id = participant.get("telegram_id")

                if not telegram_id:
                    continue

                try:
                    bot.send_message(
                        telegram_id,
                        "⏰ Напоминание!\n\n"
                        f"{preserve_custom(reminder_text)}\n\n"
                        f"🎉 {preserve_custom(event.get('title'))}\n"
                        f"📍 {preserve_custom(event.get('location') or '-')}\n"
                        f"🕒 {format_event_datetime(starts_at_raw)}",
                    )
                except Exception as error:
                    print("[REMINDER SEND ERROR]", repr(error))

            try:
                backend_request(
                    "POST",
                    f"/events/{event_id}/reminder-sent",
                    timeout=10,
                )
            except Exception as error:
                print("[REMINDER MARK ERROR]", repr(error))

        time.sleep(60)


# =========================================================
# Start / menu
# =========================================================
@bot.message_handler(commands=["start"])
def start(message):
    parts = message.text.split(maxsplit=1)

    if len(parts) > 1:
        payload = parts[1].strip()

        if payload.startswith("link_"):
            code = payload[5:]
            # Deep-link payload is an opaque secret, never a Telegram ID or email.
            if (message.chat.type != "private" or not 24 <= len(code) <= 100
                    or any(ch not in "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-" for ch in code)):
                bot.send_message(message.chat.id, "Ссылка на привязку недействительна.")
                return
            if not WEB_APP_URL.startswith("https://"):
                bot.send_message(message.chat.id, "Привязка пока недоступна. Попробуй позже.")
                return
            keyboard = InlineKeyboardMarkup()
            keyboard.add(InlineKeyboardButton(
                "🔗 Подтвердить привязку TicketTreat",
                web_app=WebAppInfo(url=f"{WEB_APP_URL}/profile?telegram_link={code}"),
            ))
            bot.send_message(
                message.chat.id,
                "🔐 Ты собираешься связать этот Telegram с аккаунтом TicketTreat на сайте. "
                "Открой подтверждение ниже. На сайте должно быть начато подключение "
                "этого аккаунта. Ссылка действует 10 минут; никому её не пересылай. "
                "Никакие аккаунты не объединяются без твоего подтверждения.",
                reply_markup=keyboard,
            )
            return

        if payload.startswith("event_"):
            try:
                event_id = int(payload.split("_", maxsplit=1)[1])
            except (IndexError, ValueError):
                bot.send_message(
                    message.chat.id,
                    "Некорректная ссылка на ивент.",
                    reply_markup=get_main_menu(message.from_user.id),
                )
                return

            show_event_details_by_id(
                message.chat.id,
                message.from_user.id,
                event_id,
            )
            return

    bot.send_message(
        message.chat.id,
        "🎟 TicketTreat — твои мероприятия в одном месте. Выбирай событие, бронируй место и управляй билетами через меню ниже.",
        reply_markup=get_main_menu(message.from_user.id),
    )
    # Mini App is the primary UI and uses signed Telegram identity; legacy
    # profile registration remains optional for backwards compatibility.
    if WEB_APP_URL.startswith("https://"):
        keyboard = InlineKeyboardMarkup()
        keyboard.add(InlineKeyboardButton(
            "🌐 Открыть TicketTreat", web_app=WebAppInfo(url=WEB_APP_URL)
        ))
        bot.send_message(message.chat.id,
            "События, QR-билеты, очереди и поддержка доступны в Mini App. "
            "Для объединения с аккаунтом сайта открой профиль на сайте и выбери «Привязать через Telegram-бота».",
            reply_markup=keyboard)
    elif not is_profile_complete(message.from_user.id):
        ask_to_register(message.chat.id)


@bot.message_handler(commands=["app", "tickets"])
def open_tickettreat_mini_app(message):
    """Open signed Telegram Mini App, optionally on My tickets."""
    if not WEB_APP_URL.startswith("https://"):
        bot.send_message(
            message.chat.id,
            "TicketTreat Mini App пока не настроен.",
            reply_markup=get_main_menu(message.from_user.id),
        )
        return
    command = (message.text or "").split(maxsplit=1)[0].split("@")[0].lower()
    target = "/tickets" if command == "/tickets" else ""
    language = get_interface_language(message.from_user.id)
    url = f"{WEB_APP_URL}{target}?lang={language}" if target else f"{WEB_APP_URL}/?lang={language}"
    keyboard = InlineKeyboardMarkup()
    keyboard.add(
        InlineKeyboardButton(
            "🎟 Мои билеты в TicketTreat" if command == "/tickets" else "🌐 Открыть TicketTreat",
            web_app=WebAppInfo(url=url),
        )
    )
    bot.send_message(
        message.chat.id,
        "Открой Mini App, чтобы посмотреть события и QR-билеты. "
        "Существующие записи через бота также будут доступны в разделе билетов.",
        reply_markup=keyboard,
    )


@bot.message_handler(commands=["loyalty", "rewards", "passport"])
def open_loyalty_passport(message):
    if message.chat.type != "private":
        bot.reply_to(message, "Открой личный чат с @TicketTreatBot для просмотра наград.")
        return
    if not WEB_APP_URL.startswith("https://"):
        bot.send_message(message.chat.id, "Паспорт гостя временно недоступен.")
        return
    keyboard = InlineKeyboardMarkup()
    keyboard.add(InlineKeyboardButton(
        "Паспорт гостя и мои награды",
        web_app=WebAppInfo(url=WEB_APP_URL + "/loyalty"),
    ))
    bot.send_message(message.chat.id,
        "За каждый подтверждённый check-in ты получаешь штамп. "
        "Уровень «Свой» (3 посещения за сезон) даёт приоритет в очереди. "
        "Открой паспорт, чтобы увидеть прогресс и бонусы.",
        reply_markup=keyboard)


@bot.message_handler(commands=["link", "connect"])
def connect_account(message):
    if not WEB_APP_URL.startswith("https://"):
        bot.send_message(message.chat.id, "Профиль TicketTreat пока не настроен.")
        return
    keyboard = InlineKeyboardMarkup()
    keyboard.add(InlineKeyboardButton("👤 Профиль TicketTreat",
        web_app=WebAppInfo(url=f"{WEB_APP_URL}/profile")))
    bot.send_message(message.chat.id,
        "Чтобы связать старые регистрации бота с сайтом, войди на сайт в свой "
        "аккаунт, подтверди email и выбери «Привязать через Telegram-бота». "
        "Затем вернись сюда по ссылке и подтверди подключение.",
        reply_markup=keyboard)


@bot.message_handler(commands=["help", "support"])
def user_help(message):
    cmd=(message.text or "").split()[0].split("@")[0].lower()
    if not WEB_APP_URL.startswith("https://"):
        bot.send_message(message.chat.id, "Используй /events, /myevents или /profile.")
        return
    target = "/support" if cmd == "/support" else "/"
    keyboard=InlineKeyboardMarkup()
    keyboard.add(InlineKeyboardButton(
        "🆘 Поддержка TicketTreat" if cmd == "/support" else "🌐 TicketTreat Mini App",
        web_app=WebAppInfo(url=f"{WEB_APP_URL}{target}")
    ))
    bot.send_message(message.chat.id,
        "В TicketTreat доступны мероприятия, бронирования, очередь, QR-билеты "
        "и обращения в поддержку. Команды: /app, /tickets, /myevents, "
        "/events, /profile, /link, /loyalty, /support.",
        reply_markup=keyboard)


@bot.message_handler(commands=["myid"])
def my_id(message):
    bot.send_message(
        message.chat.id,
        f"Твой Telegram ID: {message.from_user.id}",
        reply_markup=get_main_menu(message.from_user.id),
    )


@bot.message_handler(func=lambda message: ui_text_matches(message.text, "🏠 Start"))
def start_button(message):
    start(message)


@bot.message_handler(func=lambda message: ui_text_matches(message.text, "📅 Events"))
def events_button(message):
    events(message)


@bot.message_handler(func=lambda message: ui_text_matches(message.text, "🎟 My events"))
def my_events_button(message):
    my_events(message)


@bot.message_handler(func=lambda message: ui_text_matches(message.text, "📝 Registration"))
def registration_button(message):
    profile(message)


@bot.message_handler(func=lambda message: ui_text_matches(message.text, "🆘 Client service"))
def client_service_button(message):
    if not CLIENT_SERVICE_URL:
        bot.send_message(
            message.chat.id,
            "Client service пока не настроен.",
            reply_markup=get_main_menu(message.from_user.id),
        )
        return

    keyboard = InlineKeyboardMarkup()
    keyboard.add(
        InlineKeyboardButton(
            "💬 Написать в Client service",
            url=CLIENT_SERVICE_URL,
        )
    )

    bot.send_message(
        message.chat.id,
        "Если нужна помощь, напиши нашему Client service:",
        reply_markup=keyboard,
    )


@bot.message_handler(func=lambda message: ui_text_matches(message.text, "⚙️ Admin"))
def admin_button(message):
    admin_panel(message)


# =========================================================
# Profile helpers
# =========================================================
def update_profile_data(
    telegram_id: int,
    payload: dict[str, Any],
):
    return backend_request(
        "PATCH",
        f"/profile/{telegram_id}",
        json=payload,
        timeout=10,
    )


def show_profile(
    chat_id: int,
    telegram_id: int,
):
    try:
        data = backend_request(
            "GET",
            f"/profile/{telegram_id}",
            timeout=10,
        )
    except Exception as error:
        bot.send_message(
            chat_id,
            f"Ошибка получения профиля: {error}",
            reply_markup=get_main_menu(telegram_id),
        )
        return

    if not data.get("exists"):
        ask_to_register(chat_id)
        return

    username = data.get("username")
    telegram_display = f"@{username}" if username else "-"

    contact_preference = (
        data.get("contact_preference") or "-"
    ).lower()

    if contact_preference == "telegram":
        contact_display = "Telegram"
    elif contact_preference == "instagram":
        contact_display = "Instagram"
    else:
        contact_display = contact_preference

    language_code = (
        data.get("language")
        or get_interface_language(telegram_id)
    )

    text = (
        "👤 Мой профиль\n\n"
        f"Имя: {preserve_custom(data.get('first_name') or '-')}\n"
        f"Фамилия: {preserve_custom(data.get('last_name') or '-')}\n"
        f"Телефон: {preserve_custom(data.get('phone') or '-')}\n"
        f"Способ связи: {preserve_custom(contact_display)}\n"
        f"Язык интерфейса: "
        f"{localized_language_name(language_code, telegram_id)}\n"
        f"Telegram: {preserve_custom(telegram_display)}\n"
        f"Instagram: {preserve_custom(data.get('instagram') or '-')}"
    )

    bot.send_message(
        chat_id,
        text,
        reply_markup=get_profile_edit_keyboard(),
    )


def finish_profile_edit(
    chat_id: int,
    telegram_id: int,
    success_message: str = "✅ Данные профиля обновлены.",
):
    profile_edit_state.pop(telegram_id, None)
    profile_edit_temp.pop(telegram_id, None)

    bot.send_message(
        chat_id,
        success_message,
        reply_markup=get_main_menu(telegram_id),
    )

    show_profile(chat_id, telegram_id)


# =========================================================
# Profile registration
# =========================================================
def begin_registration(
    chat_id: int,
    telegram_id: int,
):
    # Never restart onboarding for an existing complete profile.
    # The backend remains the source of truth; failed lookups must not
    # accidentally overwrite an existing user record.
    try:
        profile_data = backend_request("GET", f"/profile/{telegram_id}", timeout=5)
    except Exception:
        bot.send_message(chat_id, "⚠️ TicketTreat is temporarily unavailable. Please try again later.", reply_markup=get_main_menu(telegram_id))
        return
    if profile_data.get("complete"):
        bot.send_message(chat_id, "✅ Ты уже зарегистрирован. Данные можно изменить в профиле.", reply_markup=get_main_menu(telegram_id))
        return
    user_state[telegram_id] = "WAIT_LANGUAGE"
    user_temp[telegram_id] = {}

    send_language_selection(
        chat_id,
        callback_prefix="register_language",
        registration=True,
    )


@bot.message_handler(commands=["profile"])
def profile(message):
    begin_registration(
        message.chat.id,
        message.from_user.id,
    )


@bot.callback_query_handler(func=lambda call: call.data == "go_profile")
def go_profile(call):
    answer_callback(call)

    begin_registration(
        call.message.chat.id,
        call.from_user.id,
    )


@bot.callback_query_handler(
    func=lambda call: call.data.startswith("register_language:")
)
def register_language_selected(call):
    telegram_id = call.from_user.id
    language = call.data.split(":", maxsplit=1)[1]

    try:
        set_interface_language(
            telegram_id,
            language,
        )
    except Exception as error:
        answer_callback(call)
        bot.send_message(
            call.message.chat.id,
            f"Ошибка обновления профиля: {error}",
        )
        return

    user_state[telegram_id] = "WAIT_FIRST_NAME"
    user_temp.setdefault(
        telegram_id,
        {},
    )["language"] = language

    answer_callback(call)

    bot.send_message(
        call.message.chat.id,
        "Введи своё имя:",
    )


@bot.message_handler(
    func=lambda message: user_state.get(message.from_user.id) in PROFILE_STATES,
    content_types=["text"],
)
def handle_profile_steps(message):
    telegram_id = message.from_user.id
    state = user_state.get(telegram_id)
    text = (message.text or "").strip()

    if state == "WAIT_LANGUAGE":
        send_language_selection(
            message.chat.id,
            callback_prefix="register_language",
            registration=True,
        )
        return

    if state == "WAIT_FIRST_NAME":
        if not text:
            bot.send_message(message.chat.id, "Имя не может быть пустым.")
            return

        user_temp[telegram_id]["first_name"] = text
        user_state[telegram_id] = "WAIT_LAST_NAME"
        bot.send_message(message.chat.id, "Теперь введи фамилию:")
        return

    if state == "WAIT_LAST_NAME":
        if not text:
            bot.send_message(message.chat.id, "Фамилия не может быть пустой.")
            return

        user_temp[telegram_id]["last_name"] = text
        user_state[telegram_id] = "WAIT_PHONE"

        keyboard = ReplyKeyboardMarkup(
            resize_keyboard=True,
            one_time_keyboard=True,
        )
        keyboard.add(
            KeyboardButton(
                "📞 Поделиться контактом",
                request_contact=True,
            )
        )

        bot.send_message(
            message.chat.id,
            "Отправь номер телефона или поделись контактом.",
            reply_markup=keyboard,
        )
        return

    if state == "WAIT_PHONE":
        phone = normalize_phone(text)

        if not phone:
            bot.send_message(
                message.chat.id,
                "Некорректный номер. Попробуй ещё раз.",
            )
            return

        user_temp[telegram_id]["phone"] = phone
        ask_contact_method(message.chat.id, telegram_id)
        return

    if state == "WAIT_CONTACT_METHOD":
        method = text.lower()

        if method not in {"telegram", "instagram"}:
            ask_contact_method(message.chat.id, telegram_id)
            return

        user_temp[telegram_id]["contact_preference"] = method

        if method == "telegram":
            save_profile_to_backend(message)
            return

        user_state[telegram_id] = "WAIT_INSTAGRAM"
        bot.send_message(
            message.chat.id,
            "Отправь Instagram username или ссылку:",
        )
        return

    if state == "WAIT_INSTAGRAM":
        if len(text) < 2:
            bot.send_message(
                message.chat.id,
                "Instagram username или ссылка слишком короткие.",
            )
            return

        user_temp[telegram_id]["instagram"] = text
        save_profile_to_backend(message)


def ask_contact_method(chat_id: int, telegram_id: int):
    user_state[telegram_id] = "WAIT_CONTACT_METHOD"

    keyboard = ReplyKeyboardMarkup(
        resize_keyboard=True,
        one_time_keyboard=True,
    )
    keyboard.row(
        KeyboardButton("Telegram"),
        KeyboardButton("Instagram"),
    )

    bot.send_message(
        chat_id,
        "Как организаторам лучше с тобой связаться?",
        reply_markup=keyboard,
    )


@bot.message_handler(content_types=["contact"])
def handle_contact(message):
    telegram_id = message.from_user.id

    phone = normalize_phone(message.contact.phone_number)

    if not phone:
        bot.send_message(
            message.chat.id,
            "Не удалось прочитать номер телефона.",
        )
        return

    if profile_edit_state.get(telegram_id) == (
        "WAIT_PROFILE_EDIT_PHONE"
    ):
        try:
            data = update_profile_data(
                telegram_id,
                {"phone": phone},
            )
        except Exception as error:
            bot.send_message(
                message.chat.id,
                f"Ошибка обновления телефона: {error}",
                reply_markup=get_main_menu(telegram_id),
            )
            return

        if data.get("error"):
            bot.send_message(
                message.chat.id,
                f"Не удалось обновить телефон: {data.get('error')}",
            )
            return

        finish_profile_edit(
            message.chat.id,
            telegram_id,
            "✅ Номер телефона обновлён.",
        )
        return

    if user_state.get(telegram_id) == "WAIT_PHONE":
        user_temp[telegram_id]["phone"] = phone
        ask_contact_method(message.chat.id, telegram_id)
        return

    bot.send_message(
        message.chat.id,
        "Контакт получен, но сейчас ввод номера телефона не активен.",
        reply_markup=get_main_menu(telegram_id),
    )


@bot.message_handler(func=lambda message: ui_text_matches(message.text, "👤 My profile"))
def my_profile(message):
    show_profile(
        message.chat.id,
        message.from_user.id,
    )


@bot.callback_query_handler(func=lambda call: call.data == "profile:refresh")
def refresh_profile(call):
    answer_callback(call)

    show_profile(
        call.message.chat.id,
        call.from_user.id,
    )


@bot.callback_query_handler(
    func=lambda call: call.data.startswith("profile_edit:")
)
def profile_edit_field(call):
    telegram_id = call.from_user.id
    field = call.data.split(":", maxsplit=1)[1]

    valid_fields = {
        "first_name",
        "last_name",
        "phone",
        "contact_preference",
        "instagram",
        "language",
    }

    if field not in valid_fields:
        answer_callback(call, "Неизвестное поле")
        return

    profile_edit_temp[telegram_id] = {
        "field": field,
    }

    answer_callback(call)

    if field == "language":
        profile_edit_state[telegram_id] = (
            "WAIT_PROFILE_EDIT_LANGUAGE"
        )

        send_language_selection(
            call.message.chat.id,
            callback_prefix="profile_language",
        )
        return

    if field == "first_name":
        profile_edit_state[telegram_id] = (
            "WAIT_PROFILE_EDIT_FIRST_NAME"
        )
        bot.send_message(
            call.message.chat.id,
            "Введите новое имя:",
            reply_markup=get_profile_edit_cancel_keyboard(),
        )
        return

    if field == "last_name":
        profile_edit_state[telegram_id] = (
            "WAIT_PROFILE_EDIT_LAST_NAME"
        )
        bot.send_message(
            call.message.chat.id,
            "Введите новую фамилию:",
            reply_markup=get_profile_edit_cancel_keyboard(),
        )
        return

    if field == "phone":
        profile_edit_state[telegram_id] = (
            "WAIT_PROFILE_EDIT_PHONE"
        )

        keyboard = ReplyKeyboardMarkup(
            resize_keyboard=True,
            one_time_keyboard=True,
        )
        keyboard.row(
            KeyboardButton(
                "📞 Поделиться контактом",
                request_contact=True,
            )
        )
        keyboard.row(KeyboardButton("❌ Отмена"))

        bot.send_message(
            call.message.chat.id,
            "Введите новый номер телефона или поделитесь контактом:",
            reply_markup=keyboard,
        )
        return

    if field == "contact_preference":
        profile_edit_state[telegram_id] = (
            "WAIT_PROFILE_EDIT_CONTACT_METHOD"
        )

        keyboard = ReplyKeyboardMarkup(
            resize_keyboard=True,
            one_time_keyboard=True,
        )
        keyboard.row(
            KeyboardButton("Telegram"),
            KeyboardButton("Instagram"),
        )
        keyboard.row(KeyboardButton("❌ Отмена"))

        bot.send_message(
            call.message.chat.id,
            "Выберите новый способ связи:",
            reply_markup=keyboard,
        )
        return

    profile_edit_state[telegram_id] = (
        "WAIT_PROFILE_EDIT_INSTAGRAM"
    )
    bot.send_message(
        call.message.chat.id,
        "Введите новый Instagram username или ссылку:",
        reply_markup=get_profile_edit_cancel_keyboard(),
    )


@bot.callback_query_handler(
    func=lambda call: call.data.startswith("profile_language:")
)
def profile_language_selected(call):
    telegram_id = call.from_user.id
    language = call.data.split(":", maxsplit=1)[1]

    try:
        set_interface_language(
            telegram_id,
            language,
        )
    except Exception as error:
        answer_callback(call)
        bot.send_message(
            call.message.chat.id,
            f"Ошибка обновления профиля: {error}",
        )
        return

    profile_edit_state.pop(
        telegram_id,
        None,
    )
    profile_edit_temp.pop(
        telegram_id,
        None,
    )

    answer_callback(call)

    bot.send_message(
        call.message.chat.id,
        "✅ Язык интерфейса изменён.",
        reply_markup=get_main_menu(telegram_id),
    )

    show_profile(
        call.message.chat.id,
        telegram_id,
    )


@bot.message_handler(
    func=lambda message: profile_edit_state.get(
        message.from_user.id
    ) in PROFILE_EDIT_STATES,
    content_types=["text"],
)
def handle_profile_edit(message):
    telegram_id = message.from_user.id
    state = profile_edit_state.get(telegram_id)
    text = (message.text or "").strip()

    if ui_text_matches(text, "❌ Отмена"):
        profile_edit_state.pop(telegram_id, None)
        profile_edit_temp.pop(telegram_id, None)

        bot.send_message(
            message.chat.id,
            "Редактирование отменено.",
            reply_markup=get_main_menu(telegram_id),
        )
        return

    payload: dict[str, Any] = {}

    if state == "WAIT_PROFILE_EDIT_LANGUAGE":
        send_language_selection(
            message.chat.id,
            callback_prefix="profile_language",
        )
        return

    if state == "WAIT_PROFILE_EDIT_FIRST_NAME":
        if not text:
            bot.send_message(
                message.chat.id,
                "Имя не может быть пустым.",
            )
            return

        payload["first_name"] = text

    elif state == "WAIT_PROFILE_EDIT_LAST_NAME":
        if not text:
            bot.send_message(
                message.chat.id,
                "Фамилия не может быть пустой.",
            )
            return

        payload["last_name"] = text

    elif state == "WAIT_PROFILE_EDIT_PHONE":
        phone = normalize_phone(text)

        if not phone:
            bot.send_message(
                message.chat.id,
                "Некорректный номер телефона. Попробуйте ещё раз.",
            )
            return

        payload["phone"] = phone

    elif state == "WAIT_PROFILE_EDIT_INSTAGRAM":
        if len(text) < 2:
            bot.send_message(
                message.chat.id,
                "Instagram username или ссылка слишком короткие.",
            )
            return

        payload["instagram"] = text

    elif state == "WAIT_PROFILE_EDIT_CONTACT_METHOD":
        method = text.lower()

        if method not in {"telegram", "instagram"}:
            bot.send_message(
                message.chat.id,
                "Выберите Telegram или Instagram.",
            )
            return

        if method == "instagram":
            try:
                current_profile = backend_request(
                    "GET",
                    f"/profile/{telegram_id}",
                    timeout=10,
                )
            except Exception as error:
                bot.send_message(
                    message.chat.id,
                    f"Ошибка получения профиля: {error}",
                )
                return

            if current_profile.get("instagram"):
                payload["contact_preference"] = "instagram"
            else:
                profile_edit_state[telegram_id] = (
                    "WAIT_PROFILE_EDIT_INSTAGRAM_FOR_METHOD"
                )

                bot.send_message(
                    message.chat.id,
                    "В профиле пока нет Instagram. "
                    "Введите Instagram username или ссылку:",
                    reply_markup=get_profile_edit_cancel_keyboard(),
                )
                return
        else:
            payload["contact_preference"] = "telegram"

    elif state == "WAIT_PROFILE_EDIT_INSTAGRAM_FOR_METHOD":
        if len(text) < 2:
            bot.send_message(
                message.chat.id,
                "Instagram username или ссылка слишком короткие.",
            )
            return

        payload = {
            "contact_preference": "instagram",
            "instagram": text,
        }

    else:
        profile_edit_state.pop(telegram_id, None)
        profile_edit_temp.pop(telegram_id, None)
        bot.send_message(
            message.chat.id,
            "Состояние редактирования сброшено.",
            reply_markup=get_main_menu(telegram_id),
        )
        return

    try:
        data = update_profile_data(
            telegram_id,
            payload,
        )
    except Exception as error:
        bot.send_message(
            message.chat.id,
            f"Ошибка обновления профиля: {error}",
            reply_markup=get_main_menu(telegram_id),
        )
        return

    if data.get("error"):
        error_messages = {
            "profile_not_found": "Профиль не найден.",
            "invalid_contact_preference": (
                "Недопустимый способ связи."
            ),
            "instagram_required": (
                "Для способа связи Instagram нужно указать Instagram."
            ),
            "first_name_cannot_be_empty": (
                "Имя не может быть пустым."
            ),
            "last_name_cannot_be_empty": (
                "Фамилия не может быть пустой."
            ),
            "phone_cannot_be_empty": (
                "Телефон не может быть пустым."
            ),
        }

        bot.send_message(
            message.chat.id,
            error_messages.get(
                data.get("error"),
                f"Не удалось обновить профиль: {data.get('error')}",
            ),
        )
        return

    finish_profile_edit(
        message.chat.id,
        telegram_id,
    )


# =========================================================
# Events / registration / unsubscribe
# =========================================================
@bot.message_handler(commands=["events"])
def events(message):
    telegram_id = message.from_user.id

    if WEB_APP_URL.startswith("https://"):
        keyboard=InlineKeyboardMarkup()
        keyboard.add(InlineKeyboardButton(
            "📅 Все доступные события TicketTreat",
            web_app=WebAppInfo(url=WEB_APP_URL+"/")))
        bot.send_message(message.chat.id,
            "Список опубликованных мероприятий, актуальные свободные места и "
            "регистрация доступны в TicketTreat Mini App. "
            "Старые записи в боте сохраняются.",
            reply_markup=keyboard)
        return

    if not is_profile_complete(telegram_id):
        ask_to_register(message.chat.id)
        return

    try:
        items = backend_request("GET", "/events", timeout=10)
    except Exception as error:
        bot.send_message(
            message.chat.id,
            f"Ошибка при получении ивентов: {error}",
            reply_markup=get_main_menu(telegram_id),
        )
        return

    available = [
        event
        for event in items
        if not event.get("is_cancelled")
    ]

    if not available:
        bot.send_message(
            message.chat.id,
            "Пока нет доступных ивентов.",
            reply_markup=get_main_menu(telegram_id),
        )
        return

    keyboard = InlineKeyboardMarkup()
    lines = ["Доступные ивенты:\n"]

    for event in available:
        lines.append(
            f"• 🎉 {preserve_custom(event.get('title'))}\n"
            f"  🌐 Языки: "
            f"{format_event_languages(event.get('languages'), telegram_id)}"
        )
        keyboard.add(
            InlineKeyboardButton(
                "Подробнее: "
                f"{preserve_custom(event.get('title'))}",
                callback_data=f"event_details:{event.get('id')}",
            )
        )

    bot.send_message(
        message.chat.id,
        "\n".join(lines),
        reply_markup=keyboard,
    )


@bot.callback_query_handler(
    func=lambda call: call.data.startswith("event_details:")
)
def event_details(call):
    event_id = int(call.data.split(":")[1])

    answer_callback(call)

    show_event_details_by_id(
        call.message.chat.id,
        call.from_user.id,
        event_id,
    )


@bot.callback_query_handler(func=lambda call: call.data.startswith("reg:"))
def handle_register(call):
    telegram_id = call.from_user.id

    # Legacy buttons must not create a second registration in a separate
    # backend. The canonical Mini App issues the real QR ticket or waitlist.
    if WEB_APP_URL.startswith("https://"):
        answer_callback(call, "Открой TicketTreat для регистрации")
        try:
            event_id = int(call.data.split(":")[1])
        except (IndexError, ValueError):
            bot.send_message(call.message.chat.id, "Неверная ссылка на событие.")
            return
        keyboard=InlineKeyboardMarkup()
        keyboard.add(InlineKeyboardButton(
            "🎟 Записаться через TicketTreat",
            web_app=WebAppInfo(url=f"{WEB_APP_URL}/checkout/{event_id}")))
        bot.send_message(call.message.chat.id,
            "Регистрация и QR-билеты теперь едины для сайта и бота. "
            "Открой Mini App, чтобы не создавать дублирующую запись.",
            reply_markup=keyboard)
        return

    if not is_profile_complete(telegram_id):
        answer_callback(
            call,
            "Нужно пройти регистрацию",
        )
        ask_to_register(call.message.chat.id)
        return

    event_id = int(call.data.split(":")[1])

    # Paid applications have one canonical queue in TicketTreat Mini App.
    # Legacy callback buttons in old Telegram messages must not create a
    # second, separate RegistrationPayment entry on the Bot backend.
    try:
        target_event=backend_request("GET",f"/events/{event_id}",timeout=10)
    except Exception:
        target_event=None
    if target_event is None or target_event.get("error"):
        answer_callback(call,"Не удалось проверить мероприятие")
        return
    if target_event.get("payment_required"):
        answer_callback(call,"Открой TicketTreat для заявки")
        if not WEB_APP_URL.startswith("https://"):
            bot.send_message(call.message.chat.id,"Платные заявки доступны только через TicketTreat Mini App.")
            return
        keyboard=InlineKeyboardMarkup()
        keyboard.add(InlineKeyboardButton(
            "⏳ Резерв 24 часа → TicketTreat",
            web_app=WebAppInfo(url=f"{WEB_APP_URL}/checkout/{event_id}"),
        ))
        bot.send_message(call.message.chat.id,
            "Оплата производится напрямую организатору. "
            "Открой Mini App: место резервируется на 24 часа, "
            "а QR-билет появится только после подтверждения оплаты организатором.",
            reply_markup=keyboard)
        return

    payload = {
        "telegram_id": telegram_id,
        "username": call.from_user.username,
        "first_name": call.from_user.first_name,
    }

    try:
        data = backend_request(
            "POST",
            f"/events/{event_id}/register",
            json=payload,
            timeout=10,
        )
    except Exception as error:
        answer_callback(call, "Ошибка регистрации")
        bot.send_message(
            call.message.chat.id,
            f"Ошибка при регистрации: {error}",
        )
        return

    status = data.get("status")
    error = data.get("error")

    messages = {
        "event_full": "❌ На этом ивенте больше нет свободных мест.",
        "event_cancelled": "❌ Этот ивент был отменён.",
        "event_already_started": "❌ Этот ивент уже начался.",
        "event_has_no_start_time": "❌ У этого ивента не указано время начала.",
        "profile_not_found": "Сначала пройди регистрацию.",
        "event_not_found": "Ивент не найден.",
        "payment_setup_missing": (
            "❌ Для этого платного ивента организатор ещё не "
            "добавил реквизиты для оплаты."
        ),
    }

    if status == "registered":
        answer_callback(call, "Готово!")

        if data.get("payment_status") == "pending":
            send_payment_instructions_message(
                call.message.chat.id,
                data,
            )
        else:
            bot.send_message(
                call.message.chat.id,
                "✅ Ты записан на ивент. Оплата не требуется.",
                reply_markup=get_main_menu(telegram_id),
            )
        return

    if status == "already_registered":
        answer_callback(call, "Ты уже записан")

        if data.get("payment_status") == "pending":
            send_payment_instructions_message(
                call.message.chat.id,
                data,
                already_registered=True,
            )
        else:
            bot.send_message(
                call.message.chat.id,
                "ℹ️ Ты уже записан на этот ивент.\n"
                "💳 Оплата: ✅ подтверждена.",
                reply_markup=get_main_menu(telegram_id),
            )
        return

    answer_callback(call, "Не получилось")
    bot.send_message(
        call.message.chat.id,
        messages.get(error, f"Ответ сервера: {data}"),
        reply_markup=get_main_menu(telegram_id),
    )


@bot.message_handler(commands=["myevents"])
def my_events(message):
    telegram_id = message.from_user.id
    try:
        # Also load active website/Mini App tickets owned by an identity that
        # was cryptographically verified during a Telegram Mini App launch.
        items = backend_request(
            "GET",
            f"/users/{telegram_id}/events?include_web_tickets=true",
            timeout=10,
        )
    except Exception as error:
        bot.send_message(
            message.chat.id,
            "Не удалось загрузить мероприятия. Попробуй ещё раз позже.",
            reply_markup=get_main_menu(telegram_id),
        )
        return

    if not items:
        keyboard = None
        if WEB_APP_URL.startswith("https://"):
            keyboard = InlineKeyboardMarkup()
            keyboard.add(InlineKeyboardButton(
                "🎟 Открыть профиль TicketTreat",
                web_app=WebAppInfo(url=f"{WEB_APP_URL}/profile"),
            ))
        bot.send_message(
            message.chat.id,
            "В этом Telegram-аккаунте пока нет доступных записей. "
            "Если ты покупал билет на сайте, сначала привяжи Telegram "
            "к своему подтверждённому TicketTreat-аккаунту в профиле. "
            "По одному имени или email аккаунты не объединяются.",
            reply_markup=keyboard or get_main_menu(telegram_id),
        )
        return

    bot.send_message(message.chat.id, "🎟 Твои ивенты:")

    for event in items:
        keyboard = InlineKeyboardMarkup()
        ticket_id = event.get("ticket_id")
        if ticket_id and WEB_APP_URL.startswith("https://"):
            keyboard.add(InlineKeyboardButton(
                "🎫 Открыть QR-билет",
                web_app=WebAppInfo(
                    url=f"{WEB_APP_URL}/tickets/{int(ticket_id)}"
                ),
            ))
        keyboard.add(
            InlineKeyboardButton(
                "Подробнее",
                callback_data=f"event_details:{event['id']}",
            )
        )
        # Legacy registrations still use the original payment/unsubscribe
        # flows. Canonical QR passes must be cancelled by their owner in
        # Mini App (the legacy unsubscribe endpoint cannot cancel them).
        if not ticket_id:
            if event.get("payment_status") == "pending":
                keyboard.add(
                    InlineKeyboardButton(
                        "💳 Реквизиты оплаты",
                        callback_data=f"payment_info:{event['id']}",
                    )
                )
            keyboard.add(
                InlineKeyboardButton(
                    "❌ Отписаться",
                    callback_data=f"unsubscribe:{event['id']}",
                )
            )
        send_event_card(
            message.chat.id,
            event,
            reply_markup=keyboard,
        )

@bot.callback_query_handler(
    func=lambda call: call.data.startswith("payment_info:")
)
def payment_info(call):
    event_id = int(call.data.split(":")[1])

    try:
        data = backend_request(
            "GET",
            f"/events/{event_id}/payment-info/{call.from_user.id}",
            timeout=10,
        )
    except Exception as error:
        answer_callback(call, "Ошибка")
        bot.send_message(
            call.message.chat.id,
            f"Ошибка получения реквизитов: {error}",
        )
        return

    if data.get("error"):
        answer_callback(call, "Недоступно")
        bot.send_message(
            call.message.chat.id,
            f"Реквизиты недоступны: {data.get('error')}",
            reply_markup=get_main_menu(call.from_user.id),
        )
        return

    answer_callback(call)
    send_payment_instructions_message(
        call.message.chat.id,
        data,
        already_registered=True,
    )


@bot.callback_query_handler(
    func=lambda call: call.data.startswith("unsubscribe:")
)
def unsubscribe(call):
    event_id = int(call.data.split(":")[1])

    try:
        data = backend_request(
            "DELETE",
            f"/events/{event_id}/register/{call.from_user.id}",
            timeout=10,
        )
    except Exception as error:
        answer_callback(call, "Ошибка")
        bot.send_message(
            call.message.chat.id,
            f"Ошибка отписки: {error}",
        )
        return

    if data.get("status") == "unsubscribed":
        answer_callback(call, "Готово")
        bot.send_message(
            call.message.chat.id,
            "✅ Ты отписался от ивента.",
            reply_markup=get_main_menu(call.from_user.id),
        )
    else:
        answer_callback(call, "Запись не найдена")


@bot.callback_query_handler(func=lambda call: call.data == "noop")
def noop(call):
    answer_callback(call)


# =========================================================
# Admin panel
# =========================================================
@bot.message_handler(commands=["admin"])
def admin_panel(message):
    if not require_admin_message(message):
        return

    keyboard = InlineKeyboardMarkup()
    keyboard.add(
        InlineKeyboardButton(
            "📅 Ивенты",
            callback_data="admin:events",
        )
    )
    keyboard.add(
        InlineKeyboardButton(
            "➕ Add new event",
            callback_data="admin:add_event",
        )
    )
    keyboard.add(
        InlineKeyboardButton(
            "📢 Broadcast text",
            callback_data="broadcast:start:text",
        )
    )
    keyboard.add(
        InlineKeyboardButton(
            "🖼 Broadcast photo",
            callback_data="broadcast:start:photo",
        )
    )

    bot.send_message(
        message.chat.id,
        "Админ-панель:",
        reply_markup=keyboard,
    )


@bot.callback_query_handler(func=lambda call: call.data == "admin:events")
def admin_events(call):
    if not require_admin_callback(call):
        return

    try:
        items = backend_request(
            "GET",
            "/events?include_past=true",
            timeout=10,
        )
    except Exception as error:
        answer_callback(call, "Ошибка")
        bot.send_message(
            call.message.chat.id,
            f"Ошибка при получении ивентов: {error}",
        )
        return

    keyboard = InlineKeyboardMarkup()

    for event in items:
        prefix = "❌" if event.get("is_cancelled") else "⚙️"

        keyboard.add(
            InlineKeyboardButton(
                f"{prefix} "
                f"{preserve_custom(event.get('title'))}",
                callback_data=f"admin:event:{event.get('id')}",
            )
        )

    keyboard.add(
        InlineKeyboardButton(
            "➕ Add new event",
            callback_data="admin:add_event",
        )
    )

    bot.edit_message_text(
        "Выбери ивент:",
        call.message.chat.id,
        call.message.message_id,
        reply_markup=keyboard,
    )
    answer_callback(call)


@bot.callback_query_handler(
    func=lambda call: call.data.startswith("admin:event:")
)
def admin_event_options(call):
    if not require_admin_callback(call):
        return

    event_id = int(call.data.split(":")[2])

    try:
        event = backend_request(
            "GET",
            f"/events/{event_id}",
            timeout=10,
        )
    except Exception as error:
        answer_callback(call, "Ошибка")
        bot.send_message(call.message.chat.id, str(error))
        return

    keyboard = InlineKeyboardMarkup()
    keyboard.add(
        InlineKeyboardButton(
            "👥 Participants",
            callback_data=f"admin:participants:{event_id}",
        )
    )
    keyboard.add(
        InlineKeyboardButton(
            "📤 Export participants",
            callback_data=f"admin:export_participants:{event_id}",
        )
    )
    keyboard.add(
        InlineKeyboardButton(
            "✏️ Edit event",
            callback_data=f"admin:edit:{event_id}",
        )
    )

    if not event.get("is_cancelled"):
        keyboard.add(
            InlineKeyboardButton(
                "❌ Cancel event",
                callback_data=f"admin:cancel:{event_id}",
            )
        )

    keyboard.add(
        InlineKeyboardButton(
            "⬅️ Back",
            callback_data="admin:events",
        )
    )

    bot.edit_message_text(
        "Управление ивентом:\n\n"
        f"🎉 {preserve_custom(event.get('title'))}",
        call.message.chat.id,
        call.message.message_id,
        reply_markup=keyboard,
    )
    answer_callback(call)


# =========================================================
# Admin participants / CSV export
# =========================================================
def render_admin_participants(
    chat_id: int,
    message_id: int,
    event_id: int,
):
    try:
        users = backend_request(
            "GET",
            f"/events/{event_id}/participants",
            timeout=10,
        )
    except Exception as error:
        bot.send_message(
            chat_id,
            f"Ошибка получения участников: {error}",
        )
        return

    keyboard = InlineKeyboardMarkup()

    if not users:
        text = "Никто не записан."
    else:
        lines = ["Участники:\n"]

        for user in users:
            full_name = (
                f"{user.get('first_name') or ''} "
                f"{user.get('last_name') or ''}"
            ).strip() or "Без имени"

            if user.get("contact_preference") == "instagram":
                contact = f"Instagram: {user.get('instagram') or '-'}"
            else:
                username = user.get("username")
                contact = (
                    f"Telegram: @{username}"
                    if username
                    else "Telegram: username не указан"
                )

            payment_status = user.get("payment_status") or "confirmed"

            if user.get("payment_required"):
                payment_line = payment_status_label(payment_status)
            else:
                payment_line = "Не требуется"

            line = (
                f"• {preserve_custom(full_name)}\n"
                f"  {preserve_custom(contact)}\n"
                f"  💳 Оплата: {payment_line}"
            )

            if (
                user.get("payment_required")
                and payment_status == "pending"
            ):
                line += (
                    "\n  ⏰ До: "
                    f"{format_event_datetime(user.get('payment_deadline'))}"
                )

                keyboard.add(
                    InlineKeyboardButton(
                        "✅ Confirm payment: "
                        f"{preserve_custom(full_name[:25])}",
                        callback_data=(
                            f"admin:confirm_payment:"
                            f"{event_id}:{user.get('telegram_id')}"
                        ),
                    )
                )

            lines.append(line)

        text = "\n\n".join(lines)

    keyboard.add(
        InlineKeyboardButton(
            "📤 Export CSV",
            callback_data=f"admin:export_participants:{event_id}",
        )
    )
    keyboard.add(
        InlineKeyboardButton(
            "⬅️ Back",
            callback_data=f"admin:event:{event_id}",
        )
    )

    try:
        bot.edit_message_text(
            text,
            chat_id,
            message_id,
            reply_markup=keyboard,
        )
    except Exception:
        bot.send_message(
            chat_id,
            text,
            reply_markup=keyboard,
        )


@bot.callback_query_handler(
    func=lambda call: call.data.startswith("admin:participants:")
)
def admin_participants(call):
    if not require_admin_callback(call):
        return

    event_id = int(call.data.split(":")[2])
    answer_callback(call)

    render_admin_participants(
        call.message.chat.id,
        call.message.message_id,
        event_id,
    )


@bot.callback_query_handler(
    func=lambda call: call.data.startswith("admin:confirm_payment:")
)
def admin_confirm_payment(call):
    if not require_admin_callback(call):
        return

    parts = call.data.split(":")
    event_id = int(parts[2])
    participant_telegram_id = int(parts[3])

    try:
        data = backend_request(
            "POST",
            (
                f"/events/{event_id}/participants/"
                f"{participant_telegram_id}/confirm-payment"
            ),
            json={"admin_telegram_id": call.from_user.id},
            timeout=10,
        )
    except Exception as error:
        answer_callback(call, "Ошибка")
        bot.send_message(
            call.message.chat.id,
            f"Ошибка подтверждения оплаты: {error}",
        )
        return

    if data.get("error"):
        answer_callback(call, "Не подтверждено")
        bot.send_message(
            call.message.chat.id,
            f"Не удалось подтвердить оплату: {data.get('error')}",
        )

        render_admin_participants(
            call.message.chat.id,
            call.message.message_id,
            event_id,
        )
        return

    answer_callback(call, "Оплата подтверждена")

    try:
        bot.send_message(
            participant_telegram_id,
            "✅ Оплата подтверждена!\n\n"
            f"🎉 {preserve_custom(data.get('title') or 'Ивент')}\n"
            "Твоя регистрация полностью подтверждена.",
        )
    except Exception as error:
        print("[PAYMENT CONFIRM NOTIFICATION ERROR]", repr(error))

    render_admin_participants(
        call.message.chat.id,
        call.message.message_id,
        event_id,
    )


def export_participants_csv(
    chat_id: int,
    event_id: int,
):
    event = backend_request(
        "GET",
        f"/events/{event_id}",
        timeout=10,
    )
    users = backend_request(
        "GET",
        f"/events/{event_id}/participants",
        timeout=10,
    )

    temporary_path = None

    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            newline="",
            encoding="utf-8-sig",
            suffix=f"_event_{event_id}_participants.csv",
            delete=False,
        ) as file:
            temporary_path = file.name
            writer = csv.writer(file)

            writer.writerow(["Event ID", event.get("id")])
            writer.writerow(["Event title", event.get("title")])
            writer.writerow([])
            writer.writerow(
                [
                    "telegram_id",
                    "first_name",
                    "last_name",
                    "username",
                    "phone",
                    "contact_preference",
                    "instagram",
                    "payment_status",
                    "payment_deadline",
                    "payment_confirmed_at",
                    "payment_confirmed_by",
                ]
            )

            for user in users:
                writer.writerow(
                    [
                        user.get("telegram_id"),
                        user.get("first_name"),
                        user.get("last_name"),
                        user.get("username"),
                        user.get("phone"),
                        user.get("contact_preference"),
                        user.get("instagram"),
                        user.get("payment_status"),
                        user.get("payment_deadline"),
                        user.get("payment_confirmed_at"),
                        user.get("payment_confirmed_by"),
                    ]
                )

        with open(temporary_path, "rb") as document:
            bot.send_document(
                chat_id,
                document,
                caption=(
                    "📤 Participants: "
                    f"{preserve_custom(event.get('title'))}\n"
                    f"Total: {len(users)}"
                ),
            )
    finally:
        if temporary_path and os.path.exists(temporary_path):
            os.remove(temporary_path)


@bot.callback_query_handler(
    func=lambda call: call.data.startswith("admin:export_participants:")
)
def admin_export_participants(call):
    if not require_admin_callback(call):
        return

    event_id = int(call.data.split(":")[2])
    answer_callback(call, "Создаю CSV...")

    try:
        export_participants_csv(
            call.message.chat.id,
            event_id,
        )
    except Exception as error:
        bot.send_message(
            call.message.chat.id,
            f"Ошибка экспорта: {error}",
        )


# =========================================================
# Admin event creation
# =========================================================
def prompt_creation_state(
    chat_id: int,
    telegram_id: int,
    state: str,
):
    admin_event_state[telegram_id] = state

    prompts = {
        "WAIT_EVENT_NAME": "Введите название ивента:",
        "WAIT_EVENT_ORGANIZER": "Введите организатора:",
        "WAIT_EVENT_LOCATION": "Введите локацию ивента:",
        "WAIT_EVENT_DESCRIPTION": "Введите описание:",
        "WAIT_EVENT_MAX_PARTICIPANTS": (
            "Введите максимальное число участников:"
        ),
        "WAIT_EVENT_PRICE": (
            "Введите цену.\n\n"
            "Примеры: 100, 99.99 или 0 для бесплатного ивента."
        ),
        "WAIT_EVENT_PAYMENT_INSTRUCTIONS": (
            "Введите реквизиты и инструкцию для оплаты билета.\n\n"
            "Это сообщение получит пользователь после нажатия Join.\n\n"
            "Пример:\n"
            "Bank: ČSOB\n"
            "Account: 123456789/0300\n"
            "Variable symbol: Telegram ID\n"
            "Comment: имя участника"
        ),
        "WAIT_EVENT_START_TIME": (
            "Введите дату и время начала ивента.\n\n"
            "Формат: YYYY-MM-DD HH:MM\n"
            "Пример: 2026-09-01 18:30"
        ),
        "WAIT_EVENT_REMINDER_TIME": (
            "Когда отправить напоминание?\n\n"
            "Примеры: 12h, 3h, 30m, 1d.\n"
            "Напиши skip, если напоминание не нужно."
        ),
        "WAIT_EVENT_REMINDER_TEXT": "Введите текст напоминания:",
        "WAIT_EVENT_PHOTO": (
            "Отправь постер ивента или нажми «⏭️ Пропустить»."
        ),
    }

    if state == "WAIT_EVENT_CURRENCY":
        bot.send_message(
            chat_id,
            "Выберите валюту стоимости ивента:",
            reply_markup=get_currency_keyboard(),
        )
        return

    if state == "WAIT_EVENT_LANGUAGES":
        selected = set(
            admin_event_temp.get(
                telegram_id,
                {},
            ).get("languages", [])
        )

        bot.send_message(
            chat_id,
            "🌐 Выберите язык(и) ивента:",
            reply_markup=get_event_languages_keyboard(
                selected,
                callback_prefix="admin:event_lang",
            ),
        )
        return

    bot.send_message(
        chat_id,
        prompts[state],
        reply_markup=get_event_creation_nav_keyboard(
            include_skip=state in {
                "WAIT_EVENT_REMINDER_TIME",
                "WAIT_EVENT_PHOTO",
            }
        ),
    )


@bot.callback_query_handler(func=lambda call: call.data == "admin:add_event")
def admin_add_event(call):
    if not require_admin_callback(call):
        return

    telegram_id = call.from_user.id
    admin_event_temp[telegram_id] = {}

    answer_callback(call)

    prompt_creation_state(
        call.message.chat.id,
        telegram_id,
        "WAIT_EVENT_NAME",
    )


def cancel_event_creation(message):
    telegram_id = message.from_user.id

    admin_event_state.pop(telegram_id, None)
    admin_event_temp.pop(telegram_id, None)

    bot.send_message(
        message.chat.id,
        "Создание ивента отменено.",
        reply_markup=get_main_menu(telegram_id),
    )


def move_creation_back(
    message,
    state: str,
):
    telegram_id = message.from_user.id

    previous = {
        "WAIT_EVENT_ORGANIZER": "WAIT_EVENT_NAME",
        "WAIT_EVENT_LOCATION": "WAIT_EVENT_ORGANIZER",
        "WAIT_EVENT_DESCRIPTION": "WAIT_EVENT_LOCATION",
        "WAIT_EVENT_MAX_PARTICIPANTS": "WAIT_EVENT_DESCRIPTION",
        "WAIT_EVENT_PRICE": "WAIT_EVENT_MAX_PARTICIPANTS",
        "WAIT_EVENT_CURRENCY": "WAIT_EVENT_PRICE",
        "WAIT_EVENT_PAYMENT_INSTRUCTIONS": "WAIT_EVENT_CURRENCY",
        "WAIT_EVENT_LANGUAGES": "WAIT_EVENT_CURRENCY",
        "WAIT_EVENT_REMINDER_TIME": "WAIT_EVENT_START_TIME",
        "WAIT_EVENT_REMINDER_TEXT": "WAIT_EVENT_REMINDER_TIME",
    }

    if state == "WAIT_EVENT_NAME":
        prompt_creation_state(
            message.chat.id,
            telegram_id,
            state,
        )
        return

    if state == "WAIT_EVENT_PHOTO":
        previous_state = (
            "WAIT_EVENT_REMINDER_TEXT"
            if admin_event_temp[telegram_id].get(
                "reminder_minutes_before"
            )
            else "WAIT_EVENT_REMINDER_TIME"
        )
    elif state == "WAIT_EVENT_START_TIME":
        previous_state = "WAIT_EVENT_LANGUAGES"
    else:
        previous_state = previous.get(state)

    if previous_state:
        prompt_creation_state(
            message.chat.id,
            telegram_id,
            previous_state,
        )


@bot.callback_query_handler(
    func=lambda call: call.data.startswith("admin:event_lang:")
)
def admin_event_language_selection(call):
    if not require_admin_callback(call):
        return

    telegram_id = call.from_user.id

    if (
        admin_event_state.get(telegram_id)
        != "WAIT_EVENT_LANGUAGES"
    ):
        answer_callback(call)
        return

    temporary = admin_event_temp.setdefault(
        telegram_id,
        {},
    )
    selected = set(
        temporary.get("languages", [])
    )

    parts = call.data.split(":")
    action = parts[2]

    if action == "toggle":
        language = parts[3]

        if language in SUPPORTED_INTERFACE_LANGUAGES:
            if language in selected:
                selected.remove(language)
            else:
                selected.add(language)

        temporary["languages"] = [
            language
            for language in SUPPORTED_INTERFACE_LANGUAGES
            if language in selected
        ]

        bot.edit_message_text(
            "🌐 Выберите язык(и) ивента:",
            call.message.chat.id,
            call.message.message_id,
            reply_markup=get_event_languages_keyboard(
                selected,
                callback_prefix="admin:event_lang",
            ),
        )
        answer_callback(call)
        return

    if action == "back":
        answer_callback(call)

        previous_state = (
            "WAIT_EVENT_PAYMENT_INSTRUCTIONS"
            if float(
                temporary.get("price") or 0
            ) > 0
            else "WAIT_EVENT_CURRENCY"
        )

        prompt_creation_state(
            call.message.chat.id,
            telegram_id,
            previous_state,
        )
        return

    if action == "done":
        if not selected:
            answer_callback(
                call,
                "Нужно выбрать хотя бы один язык ивента.",
                show_alert=True,
            )
            return

        temporary["languages"] = [
            language
            for language in SUPPORTED_INTERFACE_LANGUAGES
            if language in selected
        ]
        answer_callback(call)

        prompt_creation_state(
            call.message.chat.id,
            telegram_id,
            "WAIT_EVENT_START_TIME",
        )


def create_event_from_temp(
    chat_id: int,
    telegram_id: int,
):
    temporary = admin_event_temp[telegram_id]

    payload = {
        "title": temporary["title"],
        "organizer": temporary["organizer"],
        "location": temporary["location"],
        "description": temporary["description"],
        "max_participants": temporary["max_participants"],
        "price": temporary["price"],
        "currency": temporary.get("currency", "CZK"),
        "payment_instructions": temporary.get("payment_instructions"),
        "languages": temporary.get("languages", []),
        "starts_at": temporary.get("starts_at"),
        "telegram_photo_file_id": temporary.get(
            "telegram_photo_file_id"
        ),
        "reminder_minutes_before": temporary.get(
            "reminder_minutes_before"
        ),
        "reminder_text": temporary.get("reminder_text"),
    }

    try:
        event = backend_request(
            "POST",
            "/events",
            json=payload,
            timeout=15,
        )

        if event.get("error"):
            bot.send_message(
                chat_id,
                f"Ошибка создания ивента: {event.get('error')}",
                reply_markup=get_main_menu(telegram_id),
            )
            return
    except Exception as error:
        bot.send_message(
            chat_id,
            f"Ошибка создания ивента: {error}",
            reply_markup=get_main_menu(telegram_id),
        )
        return

    admin_event_state.pop(telegram_id, None)
    admin_event_temp.pop(telegram_id, None)

    bot.send_message(
        chat_id,
        "✅ Ивент создан!\n\n"
        f"🆔 ID: {event.get('id')}\n"
        f"🎉 Название: {preserve_custom(event.get('title'))}\n"
        f"💰 Цена: "
        f"{format_event_price(event.get('price'), event.get('currency'))}\n"
        f"🌐 Языки: "
        f"{format_event_languages(event.get('languages'), telegram_id)}\n"
        f"🕒 Начало: {format_event_datetime(event.get('starts_at'))}\n\n"
        f"🔗 {build_event_link(event.get('id'))}",
        reply_markup=get_main_menu(telegram_id),
    )


@bot.message_handler(
    func=lambda message: admin_event_state.get(
        message.from_user.id
    ) in CREATION_STATES,
    content_types=["text"],
)
def handle_admin_event_creation(message):
    if not require_admin_message(message):
        return

    telegram_id = message.from_user.id
    state = admin_event_state.get(telegram_id)
    text = (message.text or "").strip()

    if ui_text_matches(text, "❌ Отмена"):
        cancel_event_creation(message)
        return

    if ui_text_matches(text, "⬅️ Назад"):
        move_creation_back(message, state)
        return

    temporary = admin_event_temp[telegram_id]

    if state == "WAIT_EVENT_NAME":
        if not text:
            prompt_creation_state(message.chat.id, telegram_id, state)
            return

        temporary["title"] = text
        prompt_creation_state(
            message.chat.id,
            telegram_id,
            "WAIT_EVENT_ORGANIZER",
        )
        return

    if state == "WAIT_EVENT_ORGANIZER":
        if not text:
            prompt_creation_state(message.chat.id, telegram_id, state)
            return

        temporary["organizer"] = text
        prompt_creation_state(
            message.chat.id,
            telegram_id,
            "WAIT_EVENT_LOCATION",
        )
        return

    if state == "WAIT_EVENT_LOCATION":
        if not text:
            prompt_creation_state(message.chat.id, telegram_id, state)
            return

        temporary["location"] = text
        prompt_creation_state(
            message.chat.id,
            telegram_id,
            "WAIT_EVENT_DESCRIPTION",
        )
        return

    if state == "WAIT_EVENT_DESCRIPTION":
        if not text:
            prompt_creation_state(message.chat.id, telegram_id, state)
            return

        temporary["description"] = text
        prompt_creation_state(
            message.chat.id,
            telegram_id,
            "WAIT_EVENT_MAX_PARTICIPANTS",
        )
        return

    if state == "WAIT_EVENT_MAX_PARTICIPANTS":
        try:
            value = int(text)
        except ValueError:
            bot.send_message(
                message.chat.id,
                "Нужно ввести целое число.",
            )
            return

        if value <= 0:
            bot.send_message(
                message.chat.id,
                "Количество участников должно быть больше нуля.",
            )
            return

        temporary["max_participants"] = value
        prompt_creation_state(
            message.chat.id,
            telegram_id,
            "WAIT_EVENT_PRICE",
        )
        return

    if state == "WAIT_EVENT_PRICE":
        normalized = text.replace(",", ".")

        if free_word(normalized):
            value = 0.0
        else:
            try:
                value = float(normalized)
            except ValueError:
                bot.send_message(
                    message.chat.id,
                    "Введите корректную цену.",
                )
                return

        if value < 0:
            bot.send_message(
                message.chat.id,
                "Цена не может быть отрицательной.",
            )
            return

        temporary["price"] = value
        prompt_creation_state(
            message.chat.id,
            telegram_id,
            "WAIT_EVENT_CURRENCY",
        )
        return

    if state == "WAIT_EVENT_CURRENCY":
        currency = text.upper()

        if currency not in {"CZK", "EUR", "USD"}:
            bot.send_message(
                message.chat.id,
                "Выберите CZK, EUR или USD.",
                reply_markup=get_currency_keyboard(),
            )
            return

        temporary["currency"] = currency

        next_state = (
            "WAIT_EVENT_PAYMENT_INSTRUCTIONS"
            if float(temporary.get("price") or 0) > 0
            else "WAIT_EVENT_LANGUAGES"
        )

        prompt_creation_state(
            message.chat.id,
            telegram_id,
            next_state,
        )
        return

    if state == "WAIT_EVENT_PAYMENT_INSTRUCTIONS":
        if not text:
            bot.send_message(
                message.chat.id,
                "Реквизиты для платного ивента не могут быть пустыми.",
                reply_markup=get_event_creation_nav_keyboard(),
            )
            return

        temporary["payment_instructions"] = text

        prompt_creation_state(
            message.chat.id,
            telegram_id,
            "WAIT_EVENT_LANGUAGES",
        )
        return

    if state == "WAIT_EVENT_LANGUAGES":
        bot.send_message(
            message.chat.id,
            "🌐 Выберите язык(и) ивента:",
            reply_markup=get_event_languages_keyboard(
                temporary.get("languages", []),
                callback_prefix="admin:event_lang",
            ),
        )
        return

    if state == "WAIT_EVENT_START_TIME":
        try:
            value = datetime.strptime(
                text,
                "%Y-%m-%d %H:%M",
            )
        except ValueError:
            bot.send_message(
                message.chat.id,
                "Неверный формат. Используйте YYYY-MM-DD HH:MM.",
            )
            return

        temporary["starts_at"] = value.isoformat()
        prompt_creation_state(
            message.chat.id,
            telegram_id,
            "WAIT_EVENT_REMINDER_TIME",
        )
        return

    if state == "WAIT_EVENT_REMINDER_TIME":
        reminder = parse_reminder_time(text)

        if (
            reminder is None
            and not skip_word(text)
        ):
            bot.send_message(
                message.chat.id,
                "Неверный формат. Примеры: 12h, 30m, 1d или skip.",
            )
            return

        temporary["reminder_minutes_before"] = reminder

        if reminder is None:
            temporary["reminder_text"] = None
            prompt_creation_state(
                message.chat.id,
                telegram_id,
                "WAIT_EVENT_PHOTO",
            )
        else:
            prompt_creation_state(
                message.chat.id,
                telegram_id,
                "WAIT_EVENT_REMINDER_TEXT",
            )
        return

    if state == "WAIT_EVENT_REMINDER_TEXT":
        if not text:
            bot.send_message(
                message.chat.id,
                "Введите текст напоминания.",
            )
            return

        temporary["reminder_text"] = text
        prompt_creation_state(
            message.chat.id,
            telegram_id,
            "WAIT_EVENT_PHOTO",
        )
        return

    if state == "WAIT_EVENT_PHOTO":
        if ui_text_matches(text, "⏭️ Пропустить"):
            create_event_from_temp(
                message.chat.id,
                telegram_id,
            )
            return

        bot.send_message(
            message.chat.id,
            "Отправь фото или нажми «⏭️ Пропустить».",
            reply_markup=get_event_creation_nav_keyboard(
                include_skip=True
            ),
        )


# =========================================================
# Admin event editing
# =========================================================
EDIT_FIELDS = [
    ("🎉 Title", "title"),
    ("👤 Organizer", "organizer"),
    ("📍 Location", "location"),
    ("📝 Description", "description"),
    ("👥 Max participants", "max_participants"),
    ("💰 Price", "price"),
    ("💱 Currency", "currency"),
    ("💳 Payment instructions", "payment_instructions"),
    ("🌐 Языки ивента", "languages"),
    ("🕒 Start time", "starts_at"),
    ("⏰ Reminder time", "reminder_minutes_before"),
    ("💬 Reminder text", "reminder_text"),
    ("🖼 Poster photo", "telegram_photo_file_id"),
]


@bot.callback_query_handler(
    func=lambda call: call.data.startswith("admin:edit:")
)
def admin_edit_event(call):
    if not require_admin_callback(call):
        return

    event_id = int(call.data.split(":")[2])
    keyboard = InlineKeyboardMarkup()

    for label, field in EDIT_FIELDS:
        keyboard.add(
            InlineKeyboardButton(
                label,
                callback_data=(
                    f"admin:edit_field:{event_id}:{field}"
                ),
            )
        )

    keyboard.add(
        InlineKeyboardButton(
            "⬅️ Back",
            callback_data=f"admin:event:{event_id}",
        )
    )

    bot.edit_message_text(
        "Что изменить?",
        call.message.chat.id,
        call.message.message_id,
        reply_markup=keyboard,
    )
    answer_callback(call)


@bot.callback_query_handler(
    func=lambda call: call.data.startswith("admin:edit_field:")
)
def admin_choose_edit_field(call):
    if not require_admin_callback(call):
        return

    _, _, event_id_raw, field = call.data.split(":", maxsplit=3)
    event_id = int(event_id_raw)
    telegram_id = call.from_user.id

    admin_edit_state[telegram_id] = "WAIT_EDIT_VALUE"
    admin_edit_temp[telegram_id] = {
        "event_id": event_id,
        "field": field,
    }

    answer_callback(call)

    if field == "languages":
        admin_edit_state[telegram_id] = (
            "WAIT_EDIT_LANGUAGES"
        )

        try:
            event = backend_request(
                "GET",
                f"/events/{event_id}",
                timeout=10,
            )
        except Exception as error:
            bot.send_message(
                call.message.chat.id,
                f"Ошибка получения ивента: {error}",
            )
            return

        selected = set(
            event.get("languages") or []
        )
        admin_edit_temp[telegram_id][
            "languages"
        ] = list(selected)

        bot.send_message(
            call.message.chat.id,
            "🌐 Выберите язык(и) ивента:",
            reply_markup=get_event_languages_keyboard(
                selected,
                callback_prefix=(
                    f"admin:edit_lang:{event_id}"
                ),
            ),
        )
        return

    if field == "telegram_photo_file_id":
        admin_edit_state[telegram_id] = "WAIT_EDIT_PHOTO"
        bot.send_message(
            call.message.chat.id,
            "Отправь новое фото постера или напиши cancel.",
        )
        return

    if field == "currency":
        bot.send_message(
            call.message.chat.id,
            "Выберите новую валюту:",
            reply_markup=get_currency_keyboard(
                include_back=False
            ),
        )
        return

    prompts = {
        "title": "Введите новое название:",
        "organizer": "Введите нового организатора:",
        "location": "Введите новую локацию:",
        "description": "Введите новое описание:",
        "max_participants": "Введите новый лимит участников:",
        "price": "Введите новую цену:",
        "payment_instructions": (
            "Введите новые реквизиты и инструкцию для оплаты:"
        ),
        "starts_at": (
            "Введите новую дату: YYYY-MM-DD HH:MM"
        ),
        "reminder_minutes_before": (
            "Введите новое время напоминания: 12h, 30m, 1d "
            "или skip."
        ),
        "reminder_text": (
            "Введите новый текст напоминания "
            "или '-' для удаления."
        ),
    }

    bot.send_message(
        call.message.chat.id,
        prompts[field],
    )


@bot.callback_query_handler(
    func=lambda call: call.data.startswith("admin:edit_lang:")
)
def admin_edit_event_languages(call):
    if not require_admin_callback(call):
        return

    parts = call.data.split(":")
    event_id = int(parts[2])
    action = parts[3]
    telegram_id = call.from_user.id

    temporary = admin_edit_temp.get(
        telegram_id
    )

    if (
        not temporary
        or temporary.get("event_id") != event_id
        or temporary.get("field") != "languages"
    ):
        answer_callback(call)
        return

    selected = set(
        temporary.get("languages", [])
    )

    if action == "toggle":
        language = parts[4]

        if language in SUPPORTED_INTERFACE_LANGUAGES:
            if language in selected:
                selected.remove(language)
            else:
                selected.add(language)

        temporary["languages"] = [
            language
            for language in SUPPORTED_INTERFACE_LANGUAGES
            if language in selected
        ]

        bot.edit_message_text(
            "🌐 Выберите язык(и) ивента:",
            call.message.chat.id,
            call.message.message_id,
            reply_markup=get_event_languages_keyboard(
                selected,
                callback_prefix=(
                    f"admin:edit_lang:{event_id}"
                ),
            ),
        )
        answer_callback(call)
        return

    if action == "back":
        admin_edit_state.pop(
            telegram_id,
            None,
        )
        admin_edit_temp.pop(
            telegram_id,
            None,
        )
        answer_callback(call)

        keyboard = InlineKeyboardMarkup()

        for label, field in EDIT_FIELDS:
            keyboard.add(
                InlineKeyboardButton(
                    label,
                    callback_data=(
                        f"admin:edit_field:"
                        f"{event_id}:{field}"
                    ),
                )
            )

        keyboard.add(
            InlineKeyboardButton(
                "⬅️ Back",
                callback_data=(
                    f"admin:event:{event_id}"
                ),
            )
        )

        bot.send_message(
            call.message.chat.id,
            "Что изменить?",
            reply_markup=keyboard,
        )
        return

    if action == "done":
        if not selected:
            answer_callback(
                call,
                "Нужно выбрать хотя бы один язык ивента.",
                show_alert=True,
            )
            return

        try:
            event = backend_request(
                "PUT",
                f"/events/{event_id}/languages",
                json={
                    "languages": [
                        language
                        for language in SUPPORTED_INTERFACE_LANGUAGES
                        if language in selected
                    ]
                },
                timeout=15,
            )
        except Exception as error:
            answer_callback(call)
            bot.send_message(
                call.message.chat.id,
                f"Ошибка редактирования: {error}",
            )
            return

        if event.get("error"):
            answer_callback(call)
            bot.send_message(
                call.message.chat.id,
                "Не удалось обновить ивент: "
                f"{event.get('error')}",
            )
            return

        admin_edit_state.pop(
            telegram_id,
            None,
        )
        admin_edit_temp.pop(
            telegram_id,
            None,
        )
        answer_callback(call)

        bot.send_message(
            call.message.chat.id,
            "✅ Ивент обновлён.\n\n"
            f"🌐 Языки: "
            f"{format_event_languages(event.get('languages'), telegram_id)}",
            reply_markup=get_main_menu(
                telegram_id
            ),
        )


@bot.message_handler(
    func=lambda message: admin_edit_state.get(
        message.from_user.id
    ) == "WAIT_EDIT_VALUE",
    content_types=["text"],
)
def handle_admin_edit_value(message):
    if not require_admin_message(message):
        return

    telegram_id = message.from_user.id
    temporary = admin_edit_temp.get(telegram_id, {})
    event_id = temporary.get("event_id")
    field = temporary.get("field")
    text = (message.text or "").strip()

    if cancellation_word(text):
        admin_edit_state.pop(telegram_id, None)
        admin_edit_temp.pop(telegram_id, None)
        bot.send_message(
            message.chat.id,
            "Редактирование отменено.",
        )
        return

    payload: dict[str, Any] = {}

    try:
        if field == "max_participants":
            value = int(text)

            if value <= 0:
                raise ValueError

            payload[field] = value

        elif field == "price":
            value = float(text.replace(",", "."))

            if value < 0:
                raise ValueError

            payload[field] = value

        elif field == "currency":
            currency = text.upper()

            if currency not in {"CZK", "EUR", "USD"}:
                bot.send_message(
                    message.chat.id,
                    "Выберите CZK, EUR или USD.",
                    reply_markup=get_currency_keyboard(
                        include_back=False
                    ),
                )
                return

            payload[field] = currency

        elif field == "starts_at":
            value = datetime.strptime(
                text,
                "%Y-%m-%d %H:%M",
            )
            payload[field] = value.isoformat()

        elif field == "reminder_minutes_before":
            value = parse_reminder_time(text)

            if (
                value is None
                and not skip_word(text)
            ):
                raise ValueError

            payload[field] = value

        elif field == "reminder_text":
            payload[field] = None if text == "-" else text

        else:
            if not text:
                raise ValueError

            payload[field] = text

    except ValueError:
        bot.send_message(
            message.chat.id,
            "Некорректное значение. Попробуй ещё раз.",
        )
        return

    try:
        event = backend_request(
            "PATCH",
            f"/events/{event_id}",
            json=payload,
            timeout=15,
        )

        if event.get("error"):
            bot.send_message(
                message.chat.id,
                f"Не удалось обновить ивент: {event.get('error')}",
            )
            return
    except Exception as error:
        bot.send_message(
            message.chat.id,
            f"Ошибка редактирования: {error}",
        )
        return

    admin_edit_state.pop(telegram_id, None)
    admin_edit_temp.pop(telegram_id, None)

    bot.send_message(
        message.chat.id,
        "✅ Ивент обновлён.\n\n"
        f"💰 Цена: "
        f"{format_event_price(event.get('price'), event.get('currency'))}",
        reply_markup=get_main_menu(telegram_id),
    )


# =========================================================
# Admin event cancellation
# =========================================================
@bot.callback_query_handler(
    func=lambda call: call.data.startswith("admin:cancel:")
)
def admin_cancel_event(call):
    if not require_admin_callback(call):
        return

    event_id = int(call.data.split(":")[2])
    telegram_id = call.from_user.id

    admin_cancel_state[telegram_id] = "WAIT_CANCEL_REASON"
    admin_cancel_temp[telegram_id] = {
        "event_id": event_id,
    }

    answer_callback(call)
    bot.send_message(
        call.message.chat.id,
        "Введите причину отмены или напишите cancel:",
    )


@bot.message_handler(
    func=lambda message: admin_cancel_state.get(
        message.from_user.id
    ) == "WAIT_CANCEL_REASON",
    content_types=["text"],
)
def handle_admin_cancel_reason(message):
    if not require_admin_message(message):
        return

    telegram_id = message.from_user.id
    text = (message.text or "").strip()

    if cancellation_word(text):
        admin_cancel_state.pop(telegram_id, None)
        admin_cancel_temp.pop(telegram_id, None)
        bot.send_message(
            message.chat.id,
            "Отмена ивента отменена.",
        )
        return

    if not text:
        bot.send_message(
            message.chat.id,
            "Причина не может быть пустой.",
        )
        return

    event_id = admin_cancel_temp[telegram_id]["event_id"]

    try:
        participants = backend_request(
            "GET",
            f"/events/{event_id}/participants",
            timeout=10,
        )
        event = backend_request(
            "POST",
            f"/events/{event_id}/cancel",
            json={"reason": text},
            timeout=15,
        )
    except Exception as error:
        bot.send_message(
            message.chat.id,
            f"Ошибка отмены ивента: {error}",
        )
        return

    notified = 0

    for participant in participants:
        participant_id = participant.get("telegram_id")

        if not participant_id:
            continue

        try:
            bot.send_message(
                participant_id,
                "❌ Ивент отменён\n\n"
                f"🎉 {preserve_custom(event.get('title'))}\n"
                f"Причина: {preserve_custom(text)}",
            )
            notified += 1
        except Exception as error:
            print("[CANCEL NOTIFICATION ERROR]", repr(error))

    admin_cancel_state.pop(telegram_id, None)
    admin_cancel_temp.pop(telegram_id, None)

    bot.send_message(
        message.chat.id,
        "✅ Ивент отменён.\n"
        f"Уведомлено участников: {notified}",
        reply_markup=get_main_menu(telegram_id),
    )


# =========================================================
# Broadcasts
# =========================================================
@bot.message_handler(commands=["broadcast"])
def broadcast_command(message):
    if not require_admin_message(message):
        return

    start_broadcast_selection(
        message.chat.id,
        message.from_user.id,
        "text",
    )


@bot.message_handler(commands=["broadcast_photo"])
def broadcast_photo_command(message):
    if not require_admin_message(message):
        return

    start_broadcast_selection(
        message.chat.id,
        message.from_user.id,
        "photo",
    )


@bot.callback_query_handler(
    func=lambda call: call.data.startswith("broadcast:start:")
)
def broadcast_start_callback(call):
    if not require_admin_callback(call):
        return

    mode = call.data.split(":")[2]
    answer_callback(call)

    start_broadcast_selection(
        call.message.chat.id,
        call.from_user.id,
        mode,
    )


def start_broadcast_selection(
    chat_id: int,
    telegram_id: int,
    mode: str,
):
    broadcast_temp[telegram_id] = {
        "mode": mode,
    }

    keyboard = InlineKeyboardMarkup()
    keyboard.add(
        InlineKeyboardButton(
            "👥 All users",
            callback_data="broadcast:audience:all",
        )
    )
    keyboard.add(
        InlineKeyboardButton(
            "📅 Event participants",
            callback_data="broadcast:audience:events",
        )
    )

    bot.send_message(
        chat_id,
        "Кому отправить рассылку?",
        reply_markup=keyboard,
    )


@bot.callback_query_handler(
    func=lambda call: call.data == "broadcast:audience:all"
)
def broadcast_all_audience(call):
    if not require_admin_callback(call):
        return

    telegram_id = call.from_user.id
    broadcast_temp.setdefault(telegram_id, {})["audience"] = "all"

    answer_callback(call)
    prompt_broadcast_content(
        call.message.chat.id,
        telegram_id,
    )


@bot.callback_query_handler(
    func=lambda call: call.data == "broadcast:audience:events"
)
def broadcast_events_audience(call):
    if not require_admin_callback(call):
        return

    try:
        events_list = backend_request(
            "GET",
            "/events",
            timeout=10,
        )
    except Exception as error:
        answer_callback(call, "Ошибка")
        bot.send_message(call.message.chat.id, str(error))
        return

    keyboard = InlineKeyboardMarkup()

    for event in events_list:
        keyboard.add(
            InlineKeyboardButton(
                preserve_custom(event.get("title")),
                callback_data=f"broadcast:event:{event.get('id')}",
            )
        )

    bot.edit_message_text(
        "Выберите ивент:",
        call.message.chat.id,
        call.message.message_id,
        reply_markup=keyboard,
    )
    answer_callback(call)


@bot.callback_query_handler(
    func=lambda call: call.data.startswith("broadcast:event:")
)
def broadcast_event_audience(call):
    if not require_admin_callback(call):
        return

    telegram_id = call.from_user.id
    event_id = int(call.data.split(":")[2])

    broadcast_temp.setdefault(telegram_id, {}).update(
        {
            "audience": "event",
            "event_id": event_id,
        }
    )

    answer_callback(call)
    prompt_broadcast_content(
        call.message.chat.id,
        telegram_id,
    )


def prompt_broadcast_content(
    chat_id: int,
    telegram_id: int,
):
    mode = broadcast_temp[telegram_id]["mode"]

    if mode == "photo":
        broadcast_state[telegram_id] = "WAIT_BROADCAST_PHOTO"
        bot.send_message(
            chat_id,
            "Отправьте фото. Подпись фото станет текстом рассылки.",
        )
    else:
        broadcast_state[telegram_id] = "WAIT_BROADCAST_TEXT"
        bot.send_message(
            chat_id,
            "Введите текст рассылки:",
        )


def get_broadcast_recipients(
    telegram_id: int,
) -> list[dict[str, Any]]:
    temporary = broadcast_temp[telegram_id]

    if temporary.get("audience") == "event":
        return backend_request(
            "GET",
            f"/events/{temporary['event_id']}/participants",
            timeout=20,
        )

    return backend_request(
        "GET",
        "/users",
        timeout=20,
    )


def send_broadcast(
    telegram_id: int,
    *,
    text: str | None = None,
    photo_file_id: str | None = None,
):
    recipients = get_broadcast_recipients(telegram_id)

    sent = 0
    failed = 0

    for recipient in recipients:
        recipient_id = recipient.get("telegram_id")

        if not recipient_id:
            failed += 1
            continue

        try:
            if photo_file_id:
                _raw_send_photo(
                    recipient_id,
                    photo_file_id,
                    caption=text or None,
                )
            else:
                _raw_send_message(
                    recipient_id,
                    text or "",
                )

            sent += 1
        except Exception as error:
            print(
                f"[BROADCAST ERROR user={recipient_id}]",
                repr(error),
            )
            failed += 1

        time.sleep(0.04)

    return sent, failed


@bot.message_handler(
    func=lambda message: broadcast_state.get(
        message.from_user.id
    ) == "WAIT_BROADCAST_TEXT",
    content_types=["text"],
)
def handle_broadcast_text(message):
    if not require_admin_message(message):
        return

    telegram_id = message.from_user.id
    text = (message.text or "").strip()

    if not text:
        bot.send_message(
            message.chat.id,
            "Текст не может быть пустым.",
        )
        return

    try:
        sent, failed = send_broadcast(
            telegram_id,
            text=text,
        )
    except Exception as error:
        bot.send_message(
            message.chat.id,
            f"Ошибка рассылки: {error}",
        )
        return

    broadcast_state.pop(telegram_id, None)
    broadcast_temp.pop(telegram_id, None)

    bot.send_message(
        message.chat.id,
        "✅ Рассылка завершена.\n"
        f"Отправлено: {sent}\n"
        f"Ошибок: {failed}",
        reply_markup=get_main_menu(telegram_id),
    )


# =========================================================
# Shared photo handler
# =========================================================
@bot.message_handler(content_types=["photo"])
def handle_photo(message):
    telegram_id = message.from_user.id
    file_id = message.photo[-1].file_id

    if admin_event_state.get(telegram_id) == "WAIT_EVENT_PHOTO":
        if not require_admin_message(message):
            return

        admin_event_temp[telegram_id][
            "telegram_photo_file_id"
        ] = file_id

        create_event_from_temp(
            message.chat.id,
            telegram_id,
        )
        return

    if admin_edit_state.get(telegram_id) == "WAIT_EDIT_PHOTO":
        if not require_admin_message(message):
            return

        temporary = admin_edit_temp[telegram_id]
        event_id = temporary["event_id"]

        try:
            backend_request(
                "PATCH",
                f"/events/{event_id}",
                json={"telegram_photo_file_id": file_id},
                timeout=15,
            )
        except Exception as error:
            bot.send_message(
                message.chat.id,
                f"Ошибка обновления постера: {error}",
            )
            return

        admin_edit_state.pop(telegram_id, None)
        admin_edit_temp.pop(telegram_id, None)

        bot.send_message(
            message.chat.id,
            "✅ Постер обновлён.",
            reply_markup=get_main_menu(telegram_id),
        )
        return

    if broadcast_state.get(telegram_id) == "WAIT_BROADCAST_PHOTO":
        if not require_admin_message(message):
            return

        try:
            sent, failed = send_broadcast(
                telegram_id,
                text=message.caption,
                photo_file_id=file_id,
            )
        except Exception as error:
            bot.send_message(
                message.chat.id,
                f"Ошибка рассылки: {error}",
            )
            return

        broadcast_state.pop(telegram_id, None)
        broadcast_temp.pop(telegram_id, None)

        bot.send_message(
            message.chat.id,
            "✅ Рассылка завершена.\n"
            f"Отправлено: {sent}\n"
            f"Ошибок: {failed}",
            reply_markup=get_main_menu(telegram_id),
        )


# =========================================================
# Start polling
# =========================================================
# Optional, one-shot deployment maintenance action. No changes to polling behavior.
from brand_avatar import apply_avatar_on_startup
apply_avatar_on_startup()

print("BOT STARTED")

# Event reminders are now delivered by the durable Demo API Telegram outbox.
# Do not run the legacy one-shot bot reminder worker: it would double-send
# notices to Telegram registrants and ignore organizer-custom intervals.
# Keep the old function above temporarily for rollback/reference only.

bot.remove_webhook()
time.sleep(1)

print("STARTING POLLING")
bot.infinity_polling(
    skip_pending=True,
    timeout=30,
    long_polling_timeout=30,
)
