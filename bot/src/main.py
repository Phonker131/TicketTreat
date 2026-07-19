import os
import requests
import threading
import time
import csv
import tempfile
from datetime import datetime, timedelta, UTC
import telebot
from dotenv import load_dotenv
from telebot.types import (
    InlineKeyboardMarkup,
    InlineKeyboardButton,
    ReplyKeyboardMarkup,
    KeyboardButton,
)

load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN")
BOT_USERNAME = os.getenv("BOT_USERNAME")
BACKEND_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:8000")

ADMIN_IDS = [
    int(x)
    for x in os.getenv("ADMIN_IDS", "").split(",")
    if x.strip()
]

if not BOT_TOKEN:
    raise RuntimeError("BOT_TOKEN is not set in .env")

bot = telebot.TeleBot(BOT_TOKEN)

# ---------- User registration state ----------
user_state = {}
user_temp = {}

# ---------- Admin event creation state ----------
admin_event_state = {}
admin_event_temp = {}
admin_edit_state = {}
admin_edit_temp = {}

admin_cancel_state = {}
admin_cancel_temp = {}

# ---------- Broadcast state ----------
broadcast_state = {}
broadcast_temp = {}

sent_reminders = set()

# =========================================================
# Helpers
# =========================================================

def clear_admin_edit_flow(user_id: int):
    admin_edit_state.pop(user_id, None)
    admin_edit_temp.pop(user_id, None)


def clear_admin_cancel_flow(user_id: int):
    admin_cancel_state.pop(user_id, None)
    admin_cancel_temp.pop(user_id, None)


def get_admin_event_options_keyboard(event_id: int):
    markup = InlineKeyboardMarkup()
    markup.add(
        InlineKeyboardButton(
            "👥 Participants",
            callback_data=f"admin:participants:{event_id}",
        )
    )
    markup.add(
        InlineKeyboardButton(
            "📤 Export participants",
            callback_data=f"admin:export_participants:{event_id}",
        )
    )
    markup.add(
        InlineKeyboardButton(
            "✏️ Edit event",
            callback_data=f"admin:edit:{event_id}",
        )
    )
    markup.add(
        InlineKeyboardButton(
            "❌ Cancel event",
            callback_data=f"admin:cancel:{event_id}",
        )
    )
    markup.add(
        InlineKeyboardButton(
            "⬅️ Back to events",
            callback_data="admin:events",
        )
    )
    return markup

def export_participants_csv(chat_id: int, admin_user_id: int, event_id: int):
    if admin_user_id not in ADMIN_IDS:
        bot.send_message(
            chat_id,
            "⛔ Нет доступа",
            reply_markup=get_main_menu(admin_user_id),
        )
        return

    try:
        event_resp = requests.get(f"{BACKEND_URL}/events/{event_id}", timeout=10)
        event_resp.raise_for_status()
        event = event_resp.json()
    except Exception as e:
        bot.send_message(
            chat_id,
            f"Ошибка получения ивента: {e}",
            reply_markup=get_main_menu(admin_user_id),
        )
        return

    try:
        participants_resp = requests.get(
            f"{BACKEND_URL}/events/{event_id}/participants",
            timeout=10,
        )
        participants_resp.raise_for_status()
        participants = participants_resp.json()
    except Exception as e:
        bot.send_message(
            chat_id,
            f"Ошибка получения участников: {e}",
            reply_markup=get_main_menu(admin_user_id),
        )
        return

    safe_title = "".join(
        ch for ch in (event.get("title") or f"event_{event_id}")
        if ch.isalnum() or ch in (" ", "_", "-")
    ).strip().replace(" ", "_")

    if not safe_title:
        safe_title = f"event_{event_id}"

    filename = f"participants_{safe_title}_{event_id}.csv"
    file_path = os.path.join(tempfile.gettempdir(), filename)

    try:
        with open(file_path, "w", encoding="utf-8-sig", newline="") as csvfile:
            writer = csv.writer(csvfile)

            writer.writerow([
                "event_id",
                "event_title",
                "event_location",
                "event_starts_at",
                "telegram_id",
                "first_name",
                "last_name",
                "username",
                "phone",
                "contact_preference",
                "instagram",
            ])

            for user in participants:
                writer.writerow([
                    event.get("id"),
                    event.get("title"),
                    event.get("location"),
                    format_event_datetime(event.get("starts_at")),
                    user.get("telegram_id"),
                    user.get("first_name"),
                    user.get("last_name"),
                    user.get("username"),
                    user.get("phone"),
                    user.get("contact_preference"),
                    user.get("instagram"),
                ])

        with open(file_path, "rb") as document:
            bot.send_document(
                chat_id,
                document,
                caption=(
                    f"📤 Export participants\n\n"
                    f"🎉 {event.get('title')}\n"
                    f"👥 Participants: {len(participants)}"
                ),
                reply_markup=get_main_menu(admin_user_id),
            )

    except Exception as e:
        bot.send_message(
            chat_id,
            f"Ошибка создания/export CSV: {e}",
            reply_markup=get_main_menu(admin_user_id),
        )
    finally:
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
        except Exception:
            pass

def get_edit_event_fields_keyboard(event_id: int):
    markup = InlineKeyboardMarkup()

    fields = [
        ("🎉 Title", "title"),
        ("👤 Organizer", "organizer"),
        ("📍 Location", "location"),
        ("📝 Description", "description"),
        ("👥 Max participants", "max_participants"),
        ("💰 Price", "price"),
        ("🕒 Start time", "starts_at"),
        ("⏰ Reminder time", "reminder_minutes_before"),
        ("💬 Reminder text", "reminder_text"),
        ("🖼 Poster photo", "telegram_photo_file_id"),
    ]

    for label, field in fields:
        markup.add(
            InlineKeyboardButton(
                label,
                callback_data=f"admin:edit_field:{event_id}:{field}",
            )
        )

    markup.add(
        InlineKeyboardButton(
            "⬅️ Back",
            callback_data=f"admin:event_options:{event_id}",
        )
    )

    return markup


def patch_event(event_id: int, payload: dict):
    resp = requests.patch(
        f"{BACKEND_URL}/events/{event_id}",
        json=payload,
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()


def show_admin_event_options(chat_id: int, event_id: int):
    try:
        resp = requests.get(f"{BACKEND_URL}/events/{event_id}", timeout=5)
        resp.raise_for_status()
        event = resp.json()
    except Exception as e:
        bot.send_message(chat_id, f"Ошибка получения ивента: {e}")
        return

    if event.get("error") == "event_not_found":
        bot.send_message(chat_id, "Ивент не найден.")
        return

    text = (
        f"⚙️ Управление ивентом\n\n"
        f"🎉 {event.get('title')}\n"
        f"👤 Организатор: {event.get('organizer') or '-'}\n"
        f"📍 Локация: {event.get('location') or '-'}\n"
        f"🕒 Начало: {format_event_datetime(event.get('starts_at'))}"
    )

    bot.send_message(
        chat_id,
        text,
        reply_markup=get_admin_event_options_keyboard(event_id),
    )

def save_profile_to_backend(message):
    tid = message.from_user.id

    payload = {
        "telegram_id": tid,
        "username": message.from_user.username,
        "first_name": user_temp.get(tid, {}).get("first_name"),
        "last_name": user_temp.get(tid, {}).get("last_name"),
        "phone": user_temp.get(tid, {}).get("phone"),
        "contact_preference": user_temp.get(tid, {}).get("contact_preference"),
        "instagram": user_temp.get(tid, {}).get("instagram"),
    }

    try:
        resp = requests.post(f"{BACKEND_URL}/profile", json=payload, timeout=5)
        resp.raise_for_status()
    except Exception as e:
        bot.send_message(
            message.chat.id,
            f"Ошибка сохранения профиля: {e}",
            reply_markup=get_main_menu(message.from_user.id),
        )
        return

    user_state.pop(tid, None)
    user_temp.pop(tid, None)

    bot.send_message(
        message.chat.id,
        "✅ Профиль сохранён! Теперь можешь записываться через Events.",
        reply_markup=get_main_menu(message.from_user.id),
    )

def parse_reminder_time(text: str) -> int | None:
    text = text.strip().lower()

    if text in ("no", "none", "skip", "пропустить", "-"):
        return None

    try:
        if text.endswith("m"):
            return int(text[:-1])

        if text.endswith("h"):
            return int(text[:-1]) * 60

        if text.endswith("d"):
            return int(text[:-1]) * 24 * 60

        return int(text)
    except ValueError:
        return None

def get_main_menu(user_id: int):
    kb = ReplyKeyboardMarkup(resize_keyboard=True)

    kb.row(
        KeyboardButton("🏠 Start"),
        KeyboardButton("📅 Events"),
    )
    kb.row(
        KeyboardButton("🎟 My events"),
        KeyboardButton("📝 Registration"),
    )
    kb.row(
        KeyboardButton("👤 My profile"),
    )

    if user_id in ADMIN_IDS:
        kb.row(KeyboardButton("⚙️ Admin"))

    return kb


def get_event_creation_nav_keyboard(include_skip: bool = False):
    kb = ReplyKeyboardMarkup(resize_keyboard=True, one_time_keyboard=True)

    buttons = [KeyboardButton("⬅️ Назад")]
    if include_skip:
        buttons.append(KeyboardButton("⏭️ Пропустить"))

    kb.row(*buttons)
    return kb


def build_event_link(event_id: int) -> str:
    if not BOT_USERNAME:
        return f"event_{event_id}"
    return f"https://t.me/{BOT_USERNAME}?start=event_{event_id}"


def is_profile_complete(telegram_id: int) -> bool:
    try:
        resp = requests.get(f"{BACKEND_URL}/profile/{telegram_id}", timeout=5)
        resp.raise_for_status()
        data = resp.json()
        return bool(data.get("complete"))
    except Exception:
        return False


def ask_to_register(chat_id: int):
    markup = InlineKeyboardMarkup()
    markup.add(
        InlineKeyboardButton(
            "✅ Пройти регистрацию",
            callback_data="go_profile",
        )
    )
    bot.send_message(
        chat_id,
        "Чтобы записываться на ивенты, сначала пройди регистрацию.",
        reply_markup=markup,
    )


def notification_worker():
    print("REMINDER WORKER STARTED")

    while True:
        try:
            resp = requests.get(f"{BACKEND_URL}/events", timeout=10)
            resp.raise_for_status()
            events = resp.json()
        except Exception as e:
            print("Reminder worker: cannot get events:", e)
            time.sleep(60)
            continue

        now = datetime.now()

        for event in events:
            event_id = event.get("id")
            starts_at_raw = event.get("starts_at")
            reminder_minutes = event.get("reminder_minutes_before")
            reminder_text = event.get("reminder_text")
            reminder_sent = event.get("reminder_sent")

            if not event_id or not starts_at_raw:
                continue

            if not reminder_minutes or not reminder_text or reminder_sent:
                continue

            try:
                starts_at = datetime.fromisoformat(starts_at_raw)
            except Exception:
                continue

            diff_minutes = (starts_at - now).total_seconds() / 60

            if 0 < diff_minutes <= reminder_minutes:
                try:
                    resp = requests.get(
                        f"{BACKEND_URL}/events/{event_id}/participants",
                        timeout=10,
                    )
                    resp.raise_for_status()
                    participants = resp.json()
                except Exception as e:
                    print("Reminder worker: cannot get participants:", e)
                    continue

                for participant in participants:
                    try:
                        bot.send_message(
                            participant["telegram_id"],
                            f"⏰ Напоминание!\n\n"
                            f"{reminder_text}\n\n"
                            f"🎉 {event.get('title')}\n"
                            f"📍 {event.get('location') or '-'}\n"
                            f"🕒 {format_event_datetime(starts_at_raw)}"
                        )
                    except Exception as e:
                        print("Reminder worker: cannot send reminder:", e)

                try:
                    requests.post(
                        f"{BACKEND_URL}/events/{event_id}/reminder-sent",
                        timeout=10,
                    )
                except Exception as e:
                    print("Reminder worker: cannot mark reminder sent:", e)

        time.sleep(60)

def format_event_datetime(dt_value) -> str:
    if not dt_value:
        return "-"

    try:
        if isinstance(dt_value, str):
            dt = datetime.fromisoformat(dt_value)
        else:
            dt = dt_value

        return dt.strftime("%d.%m.%Y %H:%M")
    except Exception:
        return str(dt_value)
def normalize_phone(phone: str) -> str | None:
    phone = phone.strip()

    allowed = set("0123456789+()- ")
    if any(ch not in allowed for ch in phone):
        return None

    cleaned = "".join(ch for ch in phone if ch.isdigit() or ch == "+")

    if cleaned.startswith("+"):
        digits_count = len(cleaned) - 1
    else:
        digits_count = len(cleaned)

    if digits_count < 10 or digits_count > 15:
        return None

    return cleaned

def get_broadcast_target_keyboard(kind: str):
    """
    kind: "text" or "photo"
    """
    markup = InlineKeyboardMarkup()
    markup.add(
        InlineKeyboardButton(
            "🌍 All users",
            callback_data=f"broadcast:{kind}:all",
        )
    )
    markup.add(
        InlineKeyboardButton(
            "📅 Participants of event",
            callback_data=f"broadcast:{kind}:event",
        )
    )
    return markup


def clear_broadcast_flow(user_id: int):
    broadcast_state.pop(user_id, None)
    broadcast_temp.pop(user_id, None)


def get_unique_recipients(users: list[dict]) -> list[dict]:
    result = []
    seen = set()

    for user in users:
        telegram_id = user.get("telegram_id")

        if not telegram_id:
            continue

        if telegram_id in seen:
            continue

        seen.add(telegram_id)
        result.append(user)

    return result


def fetch_broadcast_recipients(target: str, event_id: int | None = None) -> list[dict]:
    if target == "all":
        resp = requests.get(f"{BACKEND_URL}/users", timeout=10)
        resp.raise_for_status()
        return get_unique_recipients(resp.json())

    if target == "event":
        if event_id is None:
            return []

        resp = requests.get(
            f"{BACKEND_URL}/events/{event_id}/participants",
            timeout=10,
        )
        resp.raise_for_status()
        return get_unique_recipients(resp.json())

    return []


def send_text_broadcast(admin_chat_id: int, admin_user_id: int, text: str):
    target = broadcast_temp.get(admin_user_id, {}).get("target")
    event_id = broadcast_temp.get(admin_user_id, {}).get("event_id")

    try:
        recipients = fetch_broadcast_recipients(target, event_id)
    except Exception as e:
        bot.send_message(
            admin_chat_id,
            f"Ошибка получения получателей: {e}",
            reply_markup=get_main_menu(admin_user_id),
        )
        clear_broadcast_flow(admin_user_id)
        return

    success = 0
    failed = 0

    for recipient in recipients:
        try:
            bot.send_message(
                recipient["telegram_id"],
                text,
            )
            success += 1
        except Exception as e:
            print("Broadcast text failed:", recipient.get("telegram_id"), e)
            failed += 1

    clear_broadcast_flow(admin_user_id)

    bot.send_message(
        admin_chat_id,
        "✅ Broadcast completed\n\n"
        f"Recipients: {len(recipients)}\n"
        f"Delivered: {success}\n"
        f"Failed: {failed}",
        reply_markup=get_main_menu(admin_user_id),
    )


def send_photo_broadcast(admin_chat_id: int, admin_user_id: int):
    target = broadcast_temp.get(admin_user_id, {}).get("target")
    event_id = broadcast_temp.get(admin_user_id, {}).get("event_id")
    photo_file_id = broadcast_temp.get(admin_user_id, {}).get("photo_file_id")
    caption = broadcast_temp.get(admin_user_id, {}).get("caption")

    if not photo_file_id:
        bot.send_message(
            admin_chat_id,
            "Фото не найдено. Попробуй /broadcast_photo ещё раз.",
            reply_markup=get_main_menu(admin_user_id),
        )
        clear_broadcast_flow(admin_user_id)
        return

    try:
        recipients = fetch_broadcast_recipients(target, event_id)
    except Exception as e:
        bot.send_message(
            admin_chat_id,
            f"Ошибка получения получателей: {e}",
            reply_markup=get_main_menu(admin_user_id),
        )
        clear_broadcast_flow(admin_user_id)
        return

    success = 0
    failed = 0

    for recipient in recipients:
        try:
            bot.send_photo(
                recipient["telegram_id"],
                photo=photo_file_id,
                caption=caption if caption else None,
            )
            success += 1
        except Exception as e:
            print("Broadcast photo failed:", recipient.get("telegram_id"), e)
            failed += 1

    clear_broadcast_flow(admin_user_id)

    bot.send_message(
        admin_chat_id,
        "✅ Photo broadcast completed\n\n"
        f"Recipients: {len(recipients)}\n"
        f"Delivered: {success}\n"
        f"Failed: {failed}",
        reply_markup=get_main_menu(admin_user_id),
    )


def show_broadcast_event_picker(chat_id: int, kind: str):
    try:
        resp = requests.get(f"{BACKEND_URL}/events", timeout=10)
        resp.raise_for_status()
        events = resp.json()
    except Exception as e:
        bot.send_message(
            chat_id,
            f"Ошибка получения ивентов: {e}",
        )
        return

    if not events:
        bot.send_message(chat_id, "Нет доступных ивентов.")
        return

    markup = InlineKeyboardMarkup()

    for event in events:
        markup.add(
            InlineKeyboardButton(
                f"📅 {event['title']}",
                callback_data=f"broadcast:{kind}:event:{event['id']}",
            )
        )

    bot.send_message(
        chat_id,
        "Выбери ивент:",
        reply_markup=markup,
    )


def show_event_details_by_id(chat_id: int, user_id: int, event_id: int):
    if not is_profile_complete(user_id):
        ask_to_register(chat_id)
        return

    try:
        resp = requests.get(f"{BACKEND_URL}/events/{event_id}", timeout=5)
        resp.raise_for_status()
        event = resp.json()
    except Exception as e:
        bot.send_message(
            chat_id,
            f"Ошибка получения ивента: {e}",
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

    registered_count = event.get("registered_count")
    max_participants = event.get("max_participants")
    spots_left = event.get("spots_left")

    if max_participants is None:
        participants_line = "👥 Участники: без лимита"
    else:
        participants_line = (
            f"👥 Участники: {registered_count or 0}/{max_participants}\n"
            f"🪑 Осталось мест: {spots_left if spots_left is not None else '-'}"
        )

    text = (
        f"🎉 {event['title']}\n"
        f"👤 Организатор: {event.get('organizer') or '-'}\n"
        f"📍 Локация: {event.get('location') or '-'}\n"
        f"📝 Описание: {event.get('description') or '-'}\n"
        f"💰 Цена: {event.get('price') or 'Free'}\n"
        f"{participants_line}\n"
        f"🕒 Начало: {format_event_datetime(event.get('starts_at'))}"
    )

    markup = InlineKeyboardMarkup()

    if max_participants is not None and spots_left == 0:
        markup.add(
            InlineKeyboardButton(
                "❌ Мест нет",
                callback_data="noop:event_full",
            )
        )
    else:
        markup.add(
            InlineKeyboardButton(
                "✅ Записаться",
                callback_data=f"reg:{event['id']}",
            )
        )

    photo_file_id = event.get("telegram_photo_file_id")

    if photo_file_id:
        try:
            bot.send_photo(
                chat_id,
                photo=photo_file_id,
                caption=text,
                reply_markup=markup,
            )
            return
        except Exception:
            pass

    bot.send_message(
        chat_id,
        text,
        reply_markup=markup,
    )

@bot.callback_query_handler(func=lambda call: call.data.startswith("noop:"))
def noop_callback(call):
    if call.data == "noop:event_full":
        bot.answer_callback_query(call.id, "На этот ивент уже нет мест.")
        return

    bot.answer_callback_query(call.id)


def create_event_from_temp(chat_id: int, temp_user_id: int, reply_user_id: int):
    payload = {
        "title": admin_event_temp[temp_user_id]["title"],
        "organizer": admin_event_temp[temp_user_id]["organizer"],
        "location": admin_event_temp[temp_user_id]["location"],
        "description": admin_event_temp[temp_user_id]["description"],
        "max_participants": admin_event_temp[temp_user_id]["max_participants"],
        "price": admin_event_temp[temp_user_id]["price"],
        "starts_at": admin_event_temp[temp_user_id].get("starts_at"),
        "telegram_photo_file_id": admin_event_temp[temp_user_id].get("telegram_photo_file_id"),
        "reminder_minutes_before": admin_event_temp[temp_user_id].get("reminder_minutes_before"),
        "reminder_text": admin_event_temp[temp_user_id].get("reminder_text"),
    }

    try:
        resp = requests.post(f"{BACKEND_URL}/events", json=payload, timeout=10)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        bot.send_message(
            chat_id,
            f"Ошибка создания ивента: {e}",
            reply_markup=get_main_menu(reply_user_id),
        )
        return

    admin_event_state.pop(temp_user_id, None)
    admin_event_temp.pop(temp_user_id, None)

    event_link = build_event_link(data["id"])

    bot.send_message(
        chat_id,
        f"✅ Ивент создан!\n\n"
        f"🆔 ID: {data['id']}\n"
        f"🎉 Название: {data['title']}\n"
        f"👤 Организатор: {data.get('organizer') or '-'}\n"
        f"📍 Локация: {data.get('location') or '-'}\n"
        f"📝 Описание: {data.get('description') or '-'}\n"
        f"👥 Макс. участников: {data.get('max_participants') or '-'}\n"
        f"💰 Цена: {data.get('price') or 'Free'}\n"
        f"🕒 Начало: {format_event_datetime(data.get('starts_at'))}\n\n"
        f"🔗 Ссылка на ивент:\n{event_link}",
        reply_markup=get_main_menu(reply_user_id),
    )


# =========================================================
# Start / Main menu
# =========================================================
@bot.message_handler(commands=["start"])
def start(message):
    parts = message.text.split(maxsplit=1)

    if len(parts) > 1:
        payload = parts[1].strip()

        if payload.startswith("event_"):
            try:
                event_id = int(payload.split("_")[1])
            except (IndexError, ValueError):
                bot.send_message(
                    message.chat.id,
                    "Некорректная ссылка на ивент.",
                    reply_markup=get_main_menu(message.from_user.id),
                )
                return

            show_event_details_by_id(message.chat.id, message.from_user.id, event_id)
            return

    bot.send_message(
        message.chat.id,
        "Привет! Я бот для записи на ивенты.\n\n"
        "Выбери действие через кнопки ниже.",
        reply_markup=get_main_menu(message.from_user.id),
    )


@bot.message_handler(commands=["myid"])
def my_id(message):
    bot.send_message(
        message.chat.id,
        f"Твой Telegram ID: {message.from_user.id}",
        reply_markup=get_main_menu(message.from_user.id),
    )


@bot.message_handler(func=lambda message: message.text == "🏠 Start")
def start_button(message):
    start(message)


@bot.message_handler(func=lambda message: message.text == "📅 Events")
def events_button(message):
    events(message)


@bot.message_handler(func=lambda message: message.text == "📝 Registration")
def registration_button(message):
    profile(message)


@bot.message_handler(func=lambda message: message.text == "👤 My profile")
def my_profile(message):
    tid = message.from_user.id

    try:
        resp = requests.get(f"{BACKEND_URL}/profile/{tid}", timeout=5)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        bot.send_message(
            message.chat.id,
            f"Ошибка получения профиля: {e}",
            reply_markup=get_main_menu(message.from_user.id),
        )
        return

    if not data.get("exists"):
        bot.send_message(
            message.chat.id,
            "Профиль ещё не заполнен. Нажми «📝 Registration».",
            reply_markup=get_main_menu(message.from_user.id),
        )
        return

    username = data.get("username")
    contact_preference = data.get("contact_preference") or "-"
    instagram = data.get("instagram") or "-"

    text = (
        "👤 Профиль\n\n"
        f"Имя: {data.get('first_name') or '-'}\n"
        f"Фамилия: {data.get('last_name') or '-'}\n"
        f"Телефон: {data.get('phone') or '-'}\n"
        f"Способ связи: {contact_preference}\n"
        f"Telegram: @{username if username else '-'}\n"
        f"Instagram: {instagram}"
    )

    bot.send_message(
        message.chat.id,
        text,
        reply_markup=get_main_menu(message.from_user.id),
    )


@bot.message_handler(func=lambda message: message.text == "⚙️ Admin")
def admin_button(message):
    admin_panel(message)


# =========================================================
# Profile registration
# =========================================================
@bot.message_handler(commands=["profile"])
def profile(message):
    tid = message.from_user.id
    user_state[tid] = "WAIT_FIRST_NAME"
    user_temp[tid] = {}

    bot.send_message(
        message.chat.id,
        "Введи своё имя:",
        reply_markup=get_main_menu(message.from_user.id),
    )


@bot.callback_query_handler(func=lambda call: call.data == "go_profile")
def go_profile(call):
    tid = call.from_user.id
    user_state[tid] = "WAIT_FIRST_NAME"
    user_temp[tid] = {}

    bot.answer_callback_query(call.id)
    bot.send_message(call.message.chat.id, "Введи своё имя:")


@bot.message_handler(
    func=lambda m: user_state.get(m.from_user.id) in (
        "WAIT_FIRST_NAME",
        "WAIT_LAST_NAME",
        "WAIT_PHONE",
        "WAIT_CONTACT_METHOD",
        "WAIT_INSTAGRAM",
    ),
    content_types=["text"]
)
def handle_profile_steps(message):
    tid = message.from_user.id
    state = user_state.get(tid)
    text = (message.text or "").strip()

    if state == "WAIT_FIRST_NAME":
        user_temp[tid]["first_name"] = text
        user_state[tid] = "WAIT_LAST_NAME"
        bot.send_message(message.chat.id, "Теперь введи фамилию:")
        return

    if state == "WAIT_LAST_NAME":
        user_temp[tid]["last_name"] = text
        user_state[tid] = "WAIT_PHONE"

        kb = ReplyKeyboardMarkup(resize_keyboard=True, one_time_keyboard=True)
        kb.add(KeyboardButton("📞 Поделиться контактом", request_contact=True))

        bot.send_message(
            message.chat.id,
            "Теперь отправь номер телефона.\n"
            "Можно нажать «📞 Поделиться контактом» или ввести номер вручную.",
            reply_markup=kb,
        )
        return

    if state == "WAIT_PHONE":
        phone = normalize_phone(text)

        if not phone:
            bot.send_message(
                message.chat.id,
                "Некорректный номер телефона.\n"
                "Введи номер вручную ещё раз или нажми «📞 Поделиться контактом».",
            )
            return

        user_temp[tid]["phone"] = phone
        user_state[tid] = "WAIT_CONTACT_METHOD"

        kb = ReplyKeyboardMarkup(resize_keyboard=True, one_time_keyboard=True)
        kb.row(
            KeyboardButton("Telegram"),
            KeyboardButton("Instagram"),
        )

        bot.send_message(
            message.chat.id,
            "Как организаторам лучше с тобой связаться?",
            reply_markup=kb,
        )
        return

    if state == "WAIT_CONTACT_METHOD":
        method = text.lower()

        if method not in ("telegram", "instagram"):
            kb = ReplyKeyboardMarkup(resize_keyboard=True, one_time_keyboard=True)
            kb.row(
                KeyboardButton("Telegram"),
                KeyboardButton("Instagram"),
            )

            bot.send_message(
                message.chat.id,
                "Выбери способ связи кнопкой: Telegram или Instagram.",
                reply_markup=kb,
            )
            return

        user_temp[tid]["contact_preference"] = method

        if method == "telegram":
            save_profile_to_backend(message)
            return

        if method == "instagram":
            user_state[tid] = "WAIT_INSTAGRAM"
            bot.send_message(
                message.chat.id,
                "Отправь ссылку на Instagram или свой Instagram тег:",
            )
            return

    if state == "WAIT_INSTAGRAM":
        instagram = text

        if len(instagram) < 2:
            bot.send_message(
                message.chat.id,
                "Instagram тег или ссылка слишком короткие. Попробуй ещё раз:",
            )
            return

        user_temp[tid]["instagram"] = instagram
        save_profile_to_backend(message)
        return


@bot.message_handler(content_types=["contact"])
def handle_contact(message):
    tid = message.from_user.id

    if user_state.get(tid) != "WAIT_PHONE":
        bot.send_message(
            message.chat.id,
            "Контакт получен, но сейчас регистрация не активна. Напиши /profile",
            reply_markup=get_main_menu(message.from_user.id),
        )
        return

    phone = normalize_phone(message.contact.phone_number)

    if not phone:
        bot.send_message(
            message.chat.id,
            "Не удалось прочитать номер телефона. Попробуй ещё раз.",
        )
        return

    user_temp[tid]["phone"] = phone
    user_state[tid] = "WAIT_CONTACT_METHOD"

    kb = ReplyKeyboardMarkup(resize_keyboard=True, one_time_keyboard=True)
    kb.row(
        KeyboardButton("Telegram"),
        KeyboardButton("Instagram"),
    )

    bot.send_message(
        message.chat.id,
        "Как организаторам лучше с тобой связаться?",
        reply_markup=kb,
    )


# =========================================================
# Events
# =========================================================
@bot.message_handler(commands=["my_events"])
def my_events_command(message):
    my_events(message)


@bot.message_handler(func=lambda message: message.text == "🎟 My events")
def my_events_button(message):
    my_events(message)


def my_events(message):
    tid = message.from_user.id

    if not is_profile_complete(tid):
        ask_to_register(message.chat.id)
        return

    try:
        resp = requests.get(f"{BACKEND_URL}/users/{tid}/events", timeout=10)
        resp.raise_for_status()
        events = resp.json()
    except Exception as e:
        bot.send_message(
            message.chat.id,
            f"Ошибка получения твоих ивентов: {e}",
            reply_markup=get_main_menu(tid),
        )
        return

    if not events:
        bot.send_message(
            message.chat.id,
            "У тебя пока нет записей на ивенты.",
            reply_markup=get_main_menu(tid),
        )
        return

    text = ["🎟 Твои ивенты:\n"]
    markup = InlineKeyboardMarkup()

    for event in events:
        text.append(
            f"🎉 {event.get('title')}\n"
            f"📍 {event.get('location') or '-'}\n"
            f"🕒 {format_event_datetime(event.get('starts_at'))}\n"
        )

        markup.add(
            InlineKeyboardButton(
                f"❌ Отписаться: {event.get('title')}",
                callback_data=f"user:unsubscribe:{event.get('id')}",
            )
        )

    bot.send_message(
        message.chat.id,
        "\n".join(text),
        reply_markup=markup,
    )

@bot.callback_query_handler(func=lambda call: call.data.startswith("user:unsubscribe:"))
def handle_user_unsubscribe(call):
    tid = call.from_user.id

    try:
        event_id = int(call.data.split(":")[2])
    except ValueError:
        bot.answer_callback_query(call.id, "Некорректный event id")
        return

    try:
        resp = requests.delete(
            f"{BACKEND_URL}/events/{event_id}/register/{tid}",
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        bot.answer_callback_query(call.id, "Ошибка")
        bot.send_message(
            call.message.chat.id,
            f"Ошибка отписки от ивента: {e}",
            reply_markup=get_main_menu(tid),
        )
        return

    if data.get("status") == "unregistered":
        bot.answer_callback_query(call.id, "Ты отписан")
        bot.send_message(
            call.message.chat.id,
            "✅ Ты успешно отписался от ивента.",
            reply_markup=get_main_menu(tid),
        )
    else:
        bot.answer_callback_query(call.id, "Ты не был записан")
        bot.send_message(
            call.message.chat.id,
            "ℹ️ Ты не был записан на этот ивент.",
            reply_markup=get_main_menu(tid),
        )

@bot.message_handler(commands=["events"])
def events(message):
    tid = message.from_user.id

    if not is_profile_complete(tid):
        ask_to_register(message.chat.id)
        return

    try:
        resp = requests.get(f"{BACKEND_URL}/events", timeout=5)
        resp.raise_for_status()
        items = resp.json()
    except Exception as e:
        bot.send_message(
            message.chat.id,
            f"Ошибка при получении ивентов: {e}",
            reply_markup=get_main_menu(message.from_user.id),
        )
        return

    if not items:
        bot.send_message(
            message.chat.id,
            "Пока нет доступных ивентов.",
            reply_markup=get_main_menu(message.from_user.id),
        )
        return

    lines = ["Доступные ивенты:\n"]
    markup = InlineKeyboardMarkup()

    for e in items:
        lines.append(f"• 🎉 {e['title']}")
        markup.add(
            InlineKeyboardButton(
                f"Подробнее: {e['title']}",
                callback_data=f"event_details:{e['id']}",
            )
        )

    bot.send_message(
        message.chat.id,
        "\n".join(lines),
        reply_markup=markup,
    )


@bot.callback_query_handler(func=lambda call: call.data.startswith("event_details:"))
def event_details(call):
    tid = call.from_user.id
    event_id = int(call.data.split(":")[1])

    bot.answer_callback_query(call.id)
    show_event_details_by_id(call.message.chat.id, tid, event_id)


@bot.callback_query_handler(func=lambda call: call.data.startswith("reg:"))
def handle_register(call):
    tid = call.from_user.id

    if not is_profile_complete(tid):
        bot.answer_callback_query(call.id, "Нужно пройти регистрацию")
        ask_to_register(call.message.chat.id)
        return

    event_id = int(call.data.split(":")[1])

    payload = {
        "telegram_id": tid,
        "username": call.from_user.username,
        "first_name": call.from_user.first_name,
    }

    try:
        resp = requests.post(
            f"{BACKEND_URL}/events/{event_id}/register",
            json=payload,
            timeout=5,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        bot.answer_callback_query(call.id, "Ошибка регистрации")
        bot.send_message(call.message.chat.id, f"Ошибка при регистрации: {e}")
        return

    if data.get("status") == "registered":
        bot.answer_callback_query(call.id, "Готово!")
        bot.send_message(
            call.message.chat.id,
            f"✅ Ты записан на ивент #{event_id}",
            reply_markup=get_main_menu(call.from_user.id),
        )
        return

    if data.get("status") == "already_registered":
        bot.answer_callback_query(call.id, "Ты уже записан")
        bot.send_message(
            call.message.chat.id,
            f"ℹ️ Ты уже записан на ивент #{event_id}",
            reply_markup=get_main_menu(call.from_user.id),
        )
        return

    if data.get("error") == "event_full":
        bot.answer_callback_query(call.id, "Мест нет")
        bot.send_message(
            call.message.chat.id,
            "❌ К сожалению, мест на этот ивент уже нет.\n\n"
            f"Зарегистрировано: {data.get('registered_count')}\n"
            f"Лимит: {data.get('max_participants')}",
            reply_markup=get_main_menu(call.from_user.id),
        )
        return

    if data.get("error") == "event_cancelled":
        bot.answer_callback_query(call.id, "Ивент отменён")
        bot.send_message(
            call.message.chat.id,
            "❌ Этот ивент отменён, регистрация закрыта.",
            reply_markup=get_main_menu(call.from_user.id),
        )
        return

    if data.get("error") == "event_already_started":
        bot.answer_callback_query(call.id, "Ивент уже начался")
        bot.send_message(
            call.message.chat.id,
            "❌ Этот ивент уже начался, регистрация закрыта.",
            reply_markup=get_main_menu(call.from_user.id),
        )
        return

    bot.answer_callback_query(call.id, "Не получилось")
    bot.send_message(
        call.message.chat.id,
        f"Ответ сервера: {data}",
        reply_markup=get_main_menu(call.from_user.id),
    )


# =========================================================
# Admin panel
# =========================================================
@bot.message_handler(commands=["admin"])
def admin_panel(message):
    if message.from_user.id not in ADMIN_IDS:
        bot.send_message(
            message.chat.id,
            "⛔ Нет доступа",
            reply_markup=get_main_menu(message.from_user.id),
        )
        return

    markup = InlineKeyboardMarkup()
    markup.add(InlineKeyboardButton("📅 Ивенты", callback_data="admin:events"))
    markup.add(InlineKeyboardButton("➕ Add new event", callback_data="admin:add_event"))
    markup.add(InlineKeyboardButton("📢 Broadcast text", callback_data="admin:broadcast_text"))
    markup.add(InlineKeyboardButton("🖼 Broadcast photo", callback_data="admin:broadcast_photo"))

    bot.send_message(
        message.chat.id,
        "Админ-панель:",
        reply_markup=markup,
    )


@bot.callback_query_handler(func=lambda call: call.data == "admin:events")
def admin_events(call):
    if call.from_user.id not in ADMIN_IDS:
        bot.answer_callback_query(call.id, "Нет доступа")
        return

    clear_admin_edit_flow(call.from_user.id)
    clear_admin_cancel_flow(call.from_user.id)

    try:
        resp = requests.get(f"{BACKEND_URL}/events", timeout=5)
        resp.raise_for_status()
        items = resp.json()
    except Exception as e:
        bot.answer_callback_query(call.id, "Ошибка")
        bot.send_message(call.message.chat.id, f"Ошибка при получении ивентов: {e}")
        return

    if not items:
        bot.edit_message_text(
            "Ивентов пока нет.",
            call.message.chat.id,
            call.message.message_id,
        )
        return

    markup = InlineKeyboardMarkup()

    for event in items:
        markup.add(
            InlineKeyboardButton(
                f"⚙️ {event['title']}",
                callback_data=f"admin:event_options:{event['id']}",
            )
        )

    bot.edit_message_text(
        "Выбери ивент для управления:",
        call.message.chat.id,
        call.message.message_id,
        reply_markup=markup,
    )

    bot.answer_callback_query(call.id)

@bot.callback_query_handler(func=lambda call: call.data.startswith("admin:event_options:"))
def admin_event_options(call):
    if call.from_user.id not in ADMIN_IDS:
        bot.answer_callback_query(call.id, "Нет доступа")
        return

    try:
        event_id = int(call.data.split(":")[2])
    except ValueError:
        bot.answer_callback_query(call.id, "Некорректный event id")
        return

    try:
        resp = requests.get(f"{BACKEND_URL}/events/{event_id}", timeout=5)
        resp.raise_for_status()
        event = resp.json()
    except Exception as e:
        bot.answer_callback_query(call.id, "Ошибка")
        bot.send_message(call.message.chat.id, f"Ошибка получения ивента: {e}")
        return

    text = (
        f"⚙️ Управление ивентом\n\n"
        f"🎉 {event.get('title')}\n"
        f"👤 Организатор: {event.get('organizer') or '-'}\n"
        f"📍 Локация: {event.get('location') or '-'}\n"
        f"🕒 Начало: {format_event_datetime(event.get('starts_at'))}"
    )

    bot.edit_message_text(
        text,
        call.message.chat.id,
        call.message.message_id,
        reply_markup=get_admin_event_options_keyboard(event_id),
    )

    bot.answer_callback_query(call.id)

@bot.callback_query_handler(func=lambda call: call.data.startswith("admin:export_participants:"))
def admin_export_participants(call):
    if call.from_user.id not in ADMIN_IDS:
        bot.answer_callback_query(call.id, "Нет доступа")
        return

    try:
        event_id = int(call.data.split(":")[2])
    except ValueError:
        bot.answer_callback_query(call.id, "Некорректный event id")
        return

    bot.answer_callback_query(call.id, "Готовлю CSV...")

    export_participants_csv(
        chat_id=call.message.chat.id,
        admin_user_id=call.from_user.id,
        event_id=event_id,
    )

@bot.callback_query_handler(func=lambda call: call.data.startswith("admin:participants:"))
def admin_participants(call):
    if call.from_user.id not in ADMIN_IDS:
        bot.answer_callback_query(call.id, "Нет доступа")
        return

    event_id = int(call.data.split(":")[2])

    try:
        resp = requests.get(f"{BACKEND_URL}/events/{event_id}/participants", timeout=5)
        resp.raise_for_status()
        users = resp.json()
    except Exception as e:
        bot.answer_callback_query(call.id, "Ошибка")
        bot.send_message(call.message.chat.id, f"Ошибка получения участников: {e}")
        return

    if not users:
        text = f"Ивент #{event_id}\n\nНикто не записан."
    else:
        lines = [f"Ивент #{event_id}\n\nУчастники:"]

        for u in users:
            uname = u.get("username")
            fname = u.get("first_name") or ""
            lname = u.get("last_name") or ""
            contact_preference = u.get("contact_preference")
            instagram = u.get("instagram")

            full_name = f"{fname} {lname}".strip() or "Без имени"

            if contact_preference == "telegram":
                if uname:
                    lines.append(f"- {full_name} | Telegram: @{uname}")
                else:
                    lines.append(f"- {full_name} | Telegram: username не указан")

            elif contact_preference == "instagram":
                lines.append(f"- {full_name} | Instagram: {instagram or '-'}")

            else:
                if uname:
                    lines.append(f"- {full_name} (@{uname})")
                else:
                    lines.append(f"- {full_name}")

        text = "\n".join(lines)

    markup = InlineKeyboardMarkup()
    markup.add(
        InlineKeyboardButton(
            "⬅️ Back",
            callback_data=f"admin:event_options:{event_id}",
        )
    )

    bot.edit_message_text(
        text,
        call.message.chat.id,
        call.message.message_id,
        reply_markup=markup,
    )

    bot.answer_callback_query(call.id)

@bot.callback_query_handler(func=lambda call: call.data.startswith("admin:edit:"))
def admin_edit_event(call):
    if call.from_user.id not in ADMIN_IDS:
        bot.answer_callback_query(call.id, "Нет доступа")
        return

    event_id = int(call.data.split(":")[2])

    clear_admin_edit_flow(call.from_user.id)
    clear_admin_cancel_flow(call.from_user.id)

    bot.edit_message_text(
        "Что изменить?",
        call.message.chat.id,
        call.message.message_id,
        reply_markup=get_edit_event_fields_keyboard(event_id),
    )

    bot.answer_callback_query(call.id)


@bot.callback_query_handler(func=lambda call: call.data.startswith("admin:edit_field:"))
def admin_edit_field(call):
    if call.from_user.id not in ADMIN_IDS:
        bot.answer_callback_query(call.id, "Нет доступа")
        return

    parts = call.data.split(":")
    event_id = int(parts[2])
    field = parts[3]
    tid = call.from_user.id

    admin_edit_temp[tid] = {
        "event_id": event_id,
        "field": field,
    }

    if field == "telegram_photo_file_id":
        admin_edit_state[tid] = "WAIT_EDIT_EVENT_PHOTO"

        bot.answer_callback_query(call.id)
        bot.send_message(
            call.message.chat.id,
            "Отправь новое фото постера.\n\n"
            "Если хочешь удалить фото, напиши remove.\n"
            "Если передумал, напиши skip.",
        )
        return

    admin_edit_state[tid] = "WAIT_EDIT_EVENT_VALUE"

    field_labels = {
        "title": "новое название",
        "organizer": "нового организатора",
        "location": "новую локацию",
        "description": "новое описание",
        "max_participants": "новое максимальное число участников",
        "price": "новую цену",
        "starts_at": "новую дату и время в формате YYYY-MM-DD HH:MM",
        "reminder_minutes_before": "новое время напоминания, например 12h, 3h, 30m, 1d или skip",
        "reminder_text": "новый текст напоминания",
    }

    bot.answer_callback_query(call.id)
    bot.send_message(
        call.message.chat.id,
        f"Введите {field_labels.get(field, 'новое значение')}:",
    )

@bot.message_handler(
    func=lambda m: admin_edit_state.get(m.from_user.id) == "WAIT_EDIT_EVENT_VALUE",
    content_types=["text"]
)
def handle_admin_edit_value(message):
    tid = message.from_user.id

    if tid not in ADMIN_IDS:
        bot.send_message(message.chat.id, "⛔ Нет доступа")
        clear_admin_edit_flow(tid)
        return

    text = (message.text or "").strip()

    if not text:
        bot.send_message(message.chat.id, "Значение не может быть пустым.")
        return

    event_id = admin_edit_temp.get(tid, {}).get("event_id")
    field = admin_edit_temp.get(tid, {}).get("field")

    if not event_id or not field:
        bot.send_message(message.chat.id, "Ошибка состояния edit flow.")
        clear_admin_edit_flow(tid)
        return

    payload = {}

    try:
        if field in ("title", "organizer", "location", "description", "reminder_text"):
            payload[field] = text

        elif field == "max_participants":
            payload[field] = int(text)

        elif field == "price":
            payload[field] = float(text.replace(",", "."))

        elif field == "starts_at":
            starts_at = datetime.strptime(text, "%Y-%m-%d %H:%M")
            payload[field] = starts_at.isoformat()

        elif field == "reminder_minutes_before":
            reminder_minutes = parse_reminder_time(text)

            if reminder_minutes is None and text.lower() not in (
                "skip",
                "пропустить",
                "-",
                "none",
                "no",
            ):
                bot.send_message(
                    message.chat.id,
                    "Неверный формат.\n\n"
                    "Примеры: 12h, 3h, 30m, 1d или skip.",
                )
                return

            payload["reminder_minutes_before"] = reminder_minutes

            if reminder_minutes is None:
                payload["reminder_text"] = None

        else:
            bot.send_message(message.chat.id, "Это поле пока нельзя изменить.")
            clear_admin_edit_flow(tid)
            return

    except ValueError:
        bot.send_message(message.chat.id, "Неверный формат значения. Попробуй ещё раз.")
        return

    try:
        result = patch_event(event_id, payload)
    except Exception as e:
        bot.send_message(
            message.chat.id,
            f"Ошибка обновления ивента: {e}",
            reply_markup=get_main_menu(tid),
        )
        clear_admin_edit_flow(tid)
        return

    clear_admin_edit_flow(tid)

    event = result.get("event", {})

    bot.send_message(
        message.chat.id,
        "✅ Ивент обновлён.\n\n"
        f"🎉 {event.get('title')}\n"
        f"📍 {event.get('location') or '-'}\n"
        f"🕒 {format_event_datetime(event.get('starts_at'))}",
        reply_markup=get_main_menu(tid),
    )

@bot.message_handler(
    func=lambda m: admin_edit_state.get(m.from_user.id) == "WAIT_EDIT_EVENT_PHOTO",
    content_types=["text"]
)
def handle_admin_edit_photo_text(message):
    tid = message.from_user.id
    text = (message.text or "").strip().lower()

    if tid not in ADMIN_IDS:
        bot.send_message(message.chat.id, "⛔ Нет доступа")
        clear_admin_edit_flow(tid)
        return

    event_id = admin_edit_temp.get(tid, {}).get("event_id")

    if not event_id:
        bot.send_message(message.chat.id, "Ошибка состояния edit photo flow.")
        clear_admin_edit_flow(tid)
        return

    if text in ("skip", "пропустить", "-"):
        bot.send_message(
            message.chat.id,
            "Редактирование фото отменено.",
            reply_markup=get_main_menu(tid),
        )
        clear_admin_edit_flow(tid)
        return

    if text in ("remove", "delete", "удалить"):
        try:
            patch_event(event_id, {"telegram_photo_file_id": None})
        except Exception as e:
            bot.send_message(
                message.chat.id,
                f"Ошибка удаления фото: {e}",
                reply_markup=get_main_menu(tid),
            )
            clear_admin_edit_flow(tid)
            return

        bot.send_message(
            message.chat.id,
            "✅ Фото ивента удалено.",
            reply_markup=get_main_menu(tid),
        )
        clear_admin_edit_flow(tid)
        return

    bot.send_message(
        message.chat.id,
        "Отправь новое фото, напиши remove чтобы удалить, или skip чтобы отменить.",
    )

@bot.callback_query_handler(func=lambda call: call.data.startswith("admin:cancel:"))
def admin_cancel_event(call):
    if call.from_user.id not in ADMIN_IDS:
        bot.answer_callback_query(call.id, "Нет доступа")
        return

    event_id = int(call.data.split(":")[2])
    tid = call.from_user.id

    clear_admin_edit_flow(tid)
    clear_admin_cancel_flow(tid)

    admin_cancel_state[tid] = "WAIT_CANCEL_REASON"
    admin_cancel_temp[tid] = {
        "event_id": event_id,
    }

    bot.answer_callback_query(call.id)
    bot.send_message(
        call.message.chat.id,
        "Введите причину отмены ивента.\n\n"
        "Она будет отправлена всем участникам:",
    )


@bot.message_handler(
    func=lambda m: admin_cancel_state.get(m.from_user.id) == "WAIT_CANCEL_REASON",
    content_types=["text"]
)
def handle_cancel_reason(message):
    tid = message.from_user.id

    if tid not in ADMIN_IDS:
        bot.send_message(message.chat.id, "⛔ Нет доступа")
        clear_admin_cancel_flow(tid)
        return

    reason = (message.text or "").strip()

    if not reason:
        bot.send_message(message.chat.id, "Причина не может быть пустой.")
        return

    event_id = admin_cancel_temp.get(tid, {}).get("event_id")

    if not event_id:
        bot.send_message(message.chat.id, "Ошибка состояния cancel flow.")
        clear_admin_cancel_flow(tid)
        return

    try:
        participants_resp = requests.get(
            f"{BACKEND_URL}/events/{event_id}/participants",
            timeout=10,
        )
        participants_resp.raise_for_status()
        participants = participants_resp.json()
    except Exception as e:
        bot.send_message(message.chat.id, f"Ошибка получения участников: {e}")
        clear_admin_cancel_flow(tid)
        return

    try:
        cancel_resp = requests.post(
            f"{BACKEND_URL}/events/{event_id}/cancel",
            json={"reason": reason},
            timeout=10,
        )
        cancel_resp.raise_for_status()
        cancel_data = cancel_resp.json()
    except Exception as e:
        bot.send_message(message.chat.id, f"Ошибка отмены ивента: {e}")
        clear_admin_cancel_flow(tid)
        return

    event = cancel_data.get("event", {})

    success = 0
    failed = 0

    for participant in participants:
        try:
            bot.send_message(
                participant["telegram_id"],
                "❌ Ивент отменён\n\n"
                f"🎉 {event.get('title')}\n"
                f"📍 {event.get('location') or '-'}\n"
                f"🕒 {format_event_datetime(event.get('starts_at'))}\n\n"
                f"Причина:\n{reason}",
            )
            success += 1
        except Exception as e:
            print("Cancel notification failed:", participant.get("telegram_id"), e)
            failed += 1

    clear_admin_cancel_flow(tid)

    bot.send_message(
        message.chat.id,
        "✅ Ивент отменён.\n\n"
        f"Уведомлено: {success}\n"
        f"Не доставлено: {failed}",
        reply_markup=get_main_menu(tid),
    )


# =========================================================
# Admin event creation
# =========================================================
@bot.callback_query_handler(func=lambda call: call.data == "admin:add_event")
def admin_add_event(call):
    if call.from_user.id not in ADMIN_IDS:
        bot.answer_callback_query(call.id, "Нет доступа")
        return

    tid = call.from_user.id
    admin_event_state[tid] = "WAIT_EVENT_NAME"
    admin_event_temp[tid] = {}

    bot.answer_callback_query(call.id)
    bot.send_message(
        call.message.chat.id,
        "Введите название ивента:",
        reply_markup=get_event_creation_nav_keyboard(),
    )

@bot.message_handler(
    func=lambda m: broadcast_state.get(m.from_user.id) == "WAIT_BROADCAST_TEXT",
    content_types=["text"]
)
def handle_broadcast_text(message):
    if message.from_user.id not in ADMIN_IDS:
        bot.send_message(
            message.chat.id,
            "⛔ Нет доступа",
            reply_markup=get_main_menu(message.from_user.id),
        )
        clear_broadcast_flow(message.from_user.id)
        return

    text = (message.text or "").strip()

    if not text:
        bot.send_message(message.chat.id, "Текст не может быть пустым.")
        return

    send_text_broadcast(
        admin_chat_id=message.chat.id,
        admin_user_id=message.from_user.id,
        text=text,
    )

@bot.message_handler(
    func=lambda m: broadcast_state.get(m.from_user.id) == "WAIT_BROADCAST_PHOTO_CAPTION",
    content_types=["text"]
)
def handle_broadcast_photo_caption(message):
    if message.from_user.id not in ADMIN_IDS:
        bot.send_message(
            message.chat.id,
            "⛔ Нет доступа",
            reply_markup=get_main_menu(message.from_user.id),
        )
        clear_broadcast_flow(message.from_user.id)
        return

    caption = (message.text or "").strip()

    if caption.lower() in ("skip", "пропустить", "-", "no", "none"):
        caption = ""

    broadcast_temp[message.from_user.id]["caption"] = caption

    send_photo_broadcast(
        admin_chat_id=message.chat.id,
        admin_user_id=message.from_user.id,
    )


@bot.message_handler(func=lambda m: admin_event_state.get(m.from_user.id) in (
    "WAIT_EVENT_NAME",
    "WAIT_EVENT_ORGANIZER",
    "WAIT_EVENT_LOCATION",
    "WAIT_EVENT_DESCRIPTION",
    "WAIT_EVENT_MAX_PARTICIPANTS",
    "WAIT_EVENT_PRICE",
    "WAIT_EVENT_START_TIME",
    "WAIT_EVENT_REMINDER_TIME",
    "WAIT_EVENT_REMINDER_TEXT",
    "WAIT_EVENT_PHOTO",
))
def handle_admin_event_creation(message):
    tid = message.from_user.id

    if tid not in ADMIN_IDS:
        bot.send_message(
            message.chat.id,
            "⛔ Нет доступа",
            reply_markup=get_main_menu(message.from_user.id),
        )
        return

    state = admin_event_state.get(tid)
    text = (message.text or "").strip()

    # ---------- BACK ----------
    if text == "⬅️ Назад":
        if state == "WAIT_EVENT_NAME":
            bot.send_message(
                message.chat.id,
                "Ты уже на первом шаге. Введи название ивента:",
                reply_markup=get_event_creation_nav_keyboard(),
            )
            return

        if state == "WAIT_EVENT_ORGANIZER":
            admin_event_state[tid] = "WAIT_EVENT_NAME"
            bot.send_message(
                message.chat.id,
                "Введите название ивента:",
                reply_markup=get_event_creation_nav_keyboard(),
            )
            return

        if state == "WAIT_EVENT_LOCATION":
            admin_event_state[tid] = "WAIT_EVENT_ORGANIZER"
            bot.send_message(
                message.chat.id,
                "Введите организатора:",
                reply_markup=get_event_creation_nav_keyboard(),
            )
            return

        if state == "WAIT_EVENT_DESCRIPTION":
            admin_event_state[tid] = "WAIT_EVENT_LOCATION"
            bot.send_message(
                message.chat.id,
                "Введите локацию ивента:",
                reply_markup=get_event_creation_nav_keyboard(),
            )
            return

        if state == "WAIT_EVENT_MAX_PARTICIPANTS":
            admin_event_state[tid] = "WAIT_EVENT_DESCRIPTION"
            bot.send_message(
                message.chat.id,
                "Введите описание:",
                reply_markup=get_event_creation_nav_keyboard(),
            )
            return

        if state == "WAIT_EVENT_PRICE":
            admin_event_state[tid] = "WAIT_EVENT_MAX_PARTICIPANTS"
            bot.send_message(
                message.chat.id,
                "Введите максимальное число участников:",
                reply_markup=get_event_creation_nav_keyboard(),
            )
            return

        if state == "WAIT_EVENT_START_TIME":
            admin_event_state[tid] = "WAIT_EVENT_PRICE"
            bot.send_message(
                message.chat.id,
                "Введите цену (например 100 или 99.99):",
                reply_markup=get_event_creation_nav_keyboard(),
            )
            return

        if state == "WAIT_EVENT_REMINDER_TIME":
            admin_event_state[tid] = "WAIT_EVENT_START_TIME"
            bot.send_message(
                message.chat.id,
                "Введите дату и время начала ивента.\n\n"
                "Формат:\n"
                "YYYY-MM-DD HH:MM\n\n"
                "Пример:\n"
                "2026-05-10 18:30",
                reply_markup=get_event_creation_nav_keyboard(),
            )
            return

        if state == "WAIT_EVENT_REMINDER_TEXT":
            admin_event_state[tid] = "WAIT_EVENT_REMINDER_TIME"
            bot.send_message(
                message.chat.id,
                "Когда отправить напоминание?\n\n"
                "Примеры:\n"
                "12h — за 12 часов\n"
                "3h — за 3 часа\n"
                "30m — за 30 минут\n"
                "1d — за 1 день\n\n"
                "Если напоминание не нужно, напиши:\n"
                "skip",
                reply_markup=get_event_creation_nav_keyboard(),
            )
            return

        if state == "WAIT_EVENT_PHOTO":
            if admin_event_temp.get(tid, {}).get("reminder_minutes_before") is None:
                admin_event_state[tid] = "WAIT_EVENT_REMINDER_TIME"
                bot.send_message(
                    message.chat.id,
                    "Когда отправить напоминание?\n\n"
                    "Примеры:\n"
                    "12h — за 12 часов\n"
                    "3h — за 3 часа\n"
                    "30m — за 30 минут\n"
                    "1d — за 1 день\n\n"
                    "Если напоминание не нужно, напиши:\n"
                    "skip",
                    reply_markup=get_event_creation_nav_keyboard(),
                )
            else:
                admin_event_state[tid] = "WAIT_EVENT_REMINDER_TEXT"
                bot.send_message(
                    message.chat.id,
                    "Введите текст напоминания:",
                    reply_markup=get_event_creation_nav_keyboard(),
                )
            return

    # ---------- NORMAL FLOW ----------
    if state == "WAIT_EVENT_NAME":
        if not text or text in ("⬅️ Назад", "⏭️ Пропустить"):
            bot.send_message(
                message.chat.id,
                "Введите корректное название ивента:",
                reply_markup=get_event_creation_nav_keyboard(),
            )
            return

        admin_event_temp[tid]["title"] = text
        admin_event_state[tid] = "WAIT_EVENT_ORGANIZER"
        bot.send_message(
            message.chat.id,
            "Введите организатора:",
            reply_markup=get_event_creation_nav_keyboard(),
        )
        return

    if state == "WAIT_EVENT_ORGANIZER":
        if not text or text in ("⬅️ Назад", "⏭️ Пропустить"):
            bot.send_message(
                message.chat.id,
                "Введите корректного организатора:",
                reply_markup=get_event_creation_nav_keyboard(),
            )
            return

        admin_event_temp[tid]["organizer"] = text
        admin_event_state[tid] = "WAIT_EVENT_LOCATION"
        bot.send_message(
            message.chat.id,
            "Введите локацию ивента:",
            reply_markup=get_event_creation_nav_keyboard(),
        )
        return

    if state == "WAIT_EVENT_LOCATION":
        if not text or text in ("⬅️ Назад", "⏭️ Пропустить"):
            bot.send_message(
                message.chat.id,
                "Введите корректную локацию:",
                reply_markup=get_event_creation_nav_keyboard(),
            )
            return

        admin_event_temp[tid]["location"] = text
        admin_event_state[tid] = "WAIT_EVENT_DESCRIPTION"
        bot.send_message(
            message.chat.id,
            "Введите описание:",
            reply_markup=get_event_creation_nav_keyboard(),
        )
        return

    if state == "WAIT_EVENT_DESCRIPTION":
        if not text or text in ("⬅️ Назад", "⏭️ Пропустить"):
            bot.send_message(
                message.chat.id,
                "Введите корректное описание:",
                reply_markup=get_event_creation_nav_keyboard(),
            )
            return

        admin_event_temp[tid]["description"] = text
        admin_event_state[tid] = "WAIT_EVENT_MAX_PARTICIPANTS"
        bot.send_message(
            message.chat.id,
            "Введите максимальное число участников:",
            reply_markup=get_event_creation_nav_keyboard(),
        )
        return

    if state == "WAIT_EVENT_MAX_PARTICIPANTS":
        try:
            max_participants = int(text)
        except ValueError:
            bot.send_message(
                message.chat.id,
                "Нужно ввести целое число. Попробуй ещё раз:",
                reply_markup=get_event_creation_nav_keyboard(),
            )
            return

        admin_event_temp[tid]["max_participants"] = max_participants
        admin_event_state[tid] = "WAIT_EVENT_PRICE"
        bot.send_message(
            message.chat.id,
            "Введите цену (например 100 или 99.99):",
            reply_markup=get_event_creation_nav_keyboard(),
        )
        return

    if state == "WAIT_EVENT_PRICE":
        try:
            price = float(text.replace(",", "."))
        except ValueError:
            bot.send_message(
                message.chat.id,
                "Нужно ввести число. Попробуй ещё раз:",
                reply_markup=get_event_creation_nav_keyboard(),
            )
            return

        admin_event_temp[tid]["price"] = price
        admin_event_state[tid] = "WAIT_EVENT_START_TIME"
        bot.send_message(
            message.chat.id,
            "Введите дату и время начала ивента.\n\n"
            "Формат:\n"
            "YYYY-MM-DD HH:MM\n\n"
            "Пример:\n"
            "2026-05-10 18:30",
            reply_markup=get_event_creation_nav_keyboard(),
        )
        return

    if state == "WAIT_EVENT_START_TIME":
        try:
            starts_at = datetime.strptime(text, "%Y-%m-%d %H:%M")
        except ValueError:
            bot.send_message(
                message.chat.id,
                "Неверный формат.\n\n"
                "Используй:\n"
                "YYYY-MM-DD HH:MM\n\n"
                "Пример:\n"
                "2026-05-10 18:30",
                reply_markup=get_event_creation_nav_keyboard(),
            )
            return

        admin_event_temp[tid]["starts_at"] = starts_at.isoformat()
        admin_event_state[tid] = "WAIT_EVENT_REMINDER_TIME"
        bot.send_message(
            message.chat.id,
            "Когда отправить напоминание?\n\n"
            "Примеры:\n"
            "12h — за 12 часов\n"
            "3h — за 3 часа\n"
            "30m — за 30 минут\n"
            "1d — за 1 день\n\n"
            "Если напоминание не нужно, напиши:\n"
            "skip",
            reply_markup=get_event_creation_nav_keyboard(),
        )
        return

    if state == "WAIT_EVENT_REMINDER_TIME":
        reminder_minutes = parse_reminder_time(text)

        if reminder_minutes is None and text.lower() not in (
            "skip",
            "пропустить",
            "-",
            "none",
            "no",
        ):
            bot.send_message(
                message.chat.id,
                "Неверный формат.\n\n"
                "Примеры:\n"
                "12h\n"
                "3h\n"
                "30m\n"
                "1d\n\n"
                "Или напиши skip.",
                reply_markup=get_event_creation_nav_keyboard(),
            )
            return

        admin_event_temp[tid]["reminder_minutes_before"] = reminder_minutes

        if reminder_minutes is None:
            admin_event_temp[tid]["reminder_text"] = None
            admin_event_state[tid] = "WAIT_EVENT_PHOTO"
            bot.send_message(
                message.chat.id,
                "Теперь отправь постер ивента.\n"
                "Или нажми «⏭️ Пропустить».",
                reply_markup=get_event_creation_nav_keyboard(include_skip=True),
            )
            return

        admin_event_state[tid] = "WAIT_EVENT_REMINDER_TEXT"
        bot.send_message(
            message.chat.id,
            "Введите текст напоминания:",
            reply_markup=get_event_creation_nav_keyboard(),
        )
        return

    if state == "WAIT_EVENT_REMINDER_TEXT":
        if not text or text in ("⬅️ Назад", "⏭️ Пропустить"):
            bot.send_message(
                message.chat.id,
                "Введите корректный текст напоминания:",
                reply_markup=get_event_creation_nav_keyboard(),
            )
            return

        admin_event_temp[tid]["reminder_text"] = text
        admin_event_state[tid] = "WAIT_EVENT_PHOTO"
        bot.send_message(
            message.chat.id,
            "Теперь отправь постер ивента.\n"
            "Или нажми «⏭️ Пропустить».",
            reply_markup=get_event_creation_nav_keyboard(include_skip=True),
        )
        return

    if state == "WAIT_EVENT_PHOTO":
        if text == "⏭️ Пропустить":
            create_event_from_temp(message.chat.id, tid, message.from_user.id)
            return

        bot.send_message(
            message.chat.id,
            "На этом шаге нужно отправить фото,\n"
            "или нажать «⏭️ Пропустить»,\n"
            "или «⬅️ Назад».",
            reply_markup=get_event_creation_nav_keyboard(include_skip=True),
        )
        return




@bot.message_handler(content_types=["photo"])
def handle_event_photo(message):
    tid = message.from_user.id

    # ---------- edit event photo ----------
    if admin_edit_state.get(tid) == "WAIT_EDIT_EVENT_PHOTO":
        if tid not in ADMIN_IDS:
            bot.send_message(
                message.chat.id,
                "⛔ Нет доступа",
                reply_markup=get_main_menu(message.from_user.id),
            )
            clear_admin_edit_flow(tid)
            return

        event_id = admin_edit_temp.get(tid, {}).get("event_id")

        if not event_id:
            bot.send_message(
                message.chat.id,
                "Ошибка состояния edit photo flow.",
                reply_markup=get_main_menu(tid),
            )
            clear_admin_edit_flow(tid)
            return

        file_id = message.photo[-1].file_id

        try:
            patch_event(event_id, {"telegram_photo_file_id": file_id})
        except Exception as e:
            bot.send_message(
                message.chat.id,
                f"Ошибка обновления фото: {e}",
                reply_markup=get_main_menu(tid),
            )
            clear_admin_edit_flow(tid)
            return

        clear_admin_edit_flow(tid)

        bot.send_message(
            message.chat.id,
            "✅ Фото ивента обновлено.",
            reply_markup=get_main_menu(tid),
        )
        return

    # ---------- broadcast photo ----------
    if broadcast_state.get(tid) == "WAIT_BROADCAST_PHOTO":
        if tid not in ADMIN_IDS:
            bot.send_message(
                message.chat.id,
                "⛔ Нет доступа",
                reply_markup=get_main_menu(message.from_user.id),
            )
            clear_broadcast_flow(tid)
            return

        file_id = message.photo[-1].file_id
        caption = message.caption

        broadcast_temp.setdefault(tid, {})
        broadcast_temp[tid]["photo_file_id"] = file_id

        if caption:
            broadcast_temp[tid]["caption"] = caption
            send_photo_broadcast(
                admin_chat_id=message.chat.id,
                admin_user_id=tid,
            )
            return

        broadcast_state[tid] = "WAIT_BROADCAST_PHOTO_CAPTION"

        bot.send_message(
            message.chat.id,
            "Фото получено.\n\n"
            "Теперь введи caption для announcement.\n"
            "Если caption не нужен, напиши skip.",
        )
        return

    # ---------- admin event poster ----------
    if admin_event_state.get(tid) == "WAIT_EVENT_PHOTO":
        if tid not in ADMIN_IDS:
            bot.send_message(
                message.chat.id,
                "⛔ Нет доступа",
                reply_markup=get_main_menu(message.from_user.id),
            )
            return

        file_id = message.photo[-1].file_id
        admin_event_temp[tid]["telegram_photo_file_id"] = file_id

        create_event_from_temp(message.chat.id, tid, message.from_user.id)
        return

@bot.message_handler(commands=["broadcast"])
def broadcast_command(message):
    if message.from_user.id not in ADMIN_IDS:
        bot.send_message(
            message.chat.id,
            "⛔ Нет доступа",
            reply_markup=get_main_menu(message.from_user.id),
        )
        return

    tid = message.from_user.id

    clear_broadcast_flow(tid)
    admin_event_state.pop(tid, None)
    admin_event_temp.pop(tid, None)

    bot.send_message(
        message.chat.id,
        "Кому отправить announcement?",
        reply_markup=get_broadcast_target_keyboard("text"),
    )


@bot.message_handler(commands=["broadcast_photo"])
def broadcast_photo_command(message):
    if message.from_user.id not in ADMIN_IDS:
        bot.send_message(
            message.chat.id,
            "⛔ Нет доступа",
            reply_markup=get_main_menu(message.from_user.id),
        )
        return

    tid = message.from_user.id

    clear_broadcast_flow(tid)
    admin_event_state.pop(tid, None)
    admin_event_temp.pop(tid, None)

    bot.send_message(
        message.chat.id,
        "Кому отправить photo announcement?",
        reply_markup=get_broadcast_target_keyboard("photo"),
    )

@bot.callback_query_handler(func=lambda call: call.data.startswith("broadcast:"))
def handle_broadcast_target(call):
    if call.from_user.id not in ADMIN_IDS:
        bot.answer_callback_query(call.id, "Нет доступа")
        return

    parts = call.data.split(":")
    # broadcast:text:all
    # broadcast:text:event
    # broadcast:text:event:123
    # broadcast:photo:all
    # broadcast:photo:event
    # broadcast:photo:event:123

    if len(parts) < 3:
        bot.answer_callback_query(call.id, "Некорректный broadcast action")
        return

    kind = parts[1]      # text / photo
    target = parts[2]    # all / event
    tid = call.from_user.id

    if kind not in ("text", "photo"):
        bot.answer_callback_query(call.id, "Некорректный тип broadcast")
        return

    if target == "all":
        broadcast_temp[tid] = {
            "kind": kind,
            "target": "all",
            "event_id": None,
        }

        if kind == "text":
            broadcast_state[tid] = "WAIT_BROADCAST_TEXT"
            bot.answer_callback_query(call.id)
            bot.send_message(
                call.message.chat.id,
                "Введите текст announcement:",
            )
            return

        if kind == "photo":
            broadcast_state[tid] = "WAIT_BROADCAST_PHOTO"
            bot.answer_callback_query(call.id)
            bot.send_message(
                call.message.chat.id,
                "Отправь фото для announcement:",
            )
            return

    if target == "event" and len(parts) == 3:
        bot.answer_callback_query(call.id)
        show_broadcast_event_picker(call.message.chat.id, kind)
        return

    if target == "event" and len(parts) == 4:
        try:
            event_id = int(parts[3])
        except ValueError:
            bot.answer_callback_query(call.id, "Некорректный event id")
            return

        broadcast_temp[tid] = {
            "kind": kind,
            "target": "event",
            "event_id": event_id,
        }

        if kind == "text":
            broadcast_state[tid] = "WAIT_BROADCAST_TEXT"
            bot.answer_callback_query(call.id)
            bot.send_message(
                call.message.chat.id,
                "Введите текст announcement для участников ивента:",
            )
            return

        if kind == "photo":
            broadcast_state[tid] = "WAIT_BROADCAST_PHOTO"
            bot.answer_callback_query(call.id)
            bot.send_message(
                call.message.chat.id,
                "Отправь фото для участников ивента:",
            )
            return

    bot.answer_callback_query(call.id, "Некорректный выбор")

@bot.callback_query_handler(func=lambda call: call.data == "admin:broadcast_text")
def admin_broadcast_text_button(call):
    if call.from_user.id not in ADMIN_IDS:
        bot.answer_callback_query(call.id, "Нет доступа")
        return

    tid = call.from_user.id

    clear_broadcast_flow(tid)
    admin_event_state.pop(tid, None)
    admin_event_temp.pop(tid, None)

    bot.answer_callback_query(call.id)
    bot.send_message(
        call.message.chat.id,
        "Кому отправить announcement?",
        reply_markup=get_broadcast_target_keyboard("text"),
    )


@bot.callback_query_handler(func=lambda call: call.data == "admin:broadcast_photo")
def admin_broadcast_photo_button(call):
    if call.from_user.id not in ADMIN_IDS:
        bot.answer_callback_query(call.id, "Нет доступа")
        return

    tid = call.from_user.id

    clear_broadcast_flow(tid)
    admin_event_state.pop(tid, None)
    admin_event_temp.pop(tid, None)

    bot.answer_callback_query(call.id)
    bot.send_message(
        call.message.chat.id,
        "Кому отправить photo announcement?",
        reply_markup=get_broadcast_target_keyboard("photo"),
    )


print("BOT STARTED")

threading.Thread(
    target=notification_worker,
    daemon=True
).start()

bot.remove_webhook()
time.sleep(1)

print("STARTING POLLING")
bot.infinity_polling(skip_pending=True)
