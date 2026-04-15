import os
import requests
import threading
import time
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


# =========================================================
# Helpers
# =========================================================
def get_main_menu(user_id: int):
    kb = ReplyKeyboardMarkup(resize_keyboard=True)

    kb.row(
        KeyboardButton("🏠 Start"),
        KeyboardButton("📅 Events"),
    )
    kb.row(
        KeyboardButton("📝 Registration"),
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
    while True:
        try:
            resp = requests.get(f"{BACKEND_URL}/events", timeout=5)
            resp.raise_for_status()
            events = resp.json()
        except Exception:
            time.sleep(600)
            continue

        now = datetime.now(UTC)

        for e in events:
            if not e.get("starts_at"):
                continue

            try:
                start_time = datetime.fromisoformat(e["starts_at"])
            except Exception:
                continue

            diff = start_time - now

            if timedelta(hours=11, minutes=50) < diff < timedelta(hours=12, minutes=10):
                try:
                    resp = requests.get(
                        f"{BACKEND_URL}/events/{e['id']}/participants",
                        timeout=5
                    )
                    resp.raise_for_status()
                    users = resp.json()
                except Exception:
                    continue

                for u in users:
                    try:
                        bot.send_message(
                            u["telegram_id"],
                            f"⏰ Напоминание!\n\n"
                            f"Завтра ивент:\n"
                            f"🎉 {e['title']}\n"
                            f"🕒 Начало: {format_event_datetime(e.get('starts_at'))}"
                        )
                    except Exception:
                        pass

        time.sleep(600)

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

    text = (
        f"🎉 {event['title']}\n"
        f"👤 Организатор: {event.get('organizer') or '-'}\n"
        f"📝 Описание: {event.get('description') or '-'}\n"
        f"💰 Цена: {event.get('price') or 'Free'}\n"
        f"👥 Макс. участников: {event.get('max_participants') or '-'}\n"
        f"🕒 Начало: {format_event_datetime(event.get('starts_at'))}"
    )

    markup = InlineKeyboardMarkup()
    markup.add(
        InlineKeyboardButton(
            "✅ Записаться",
            callback_data=f"reg:{event['id']}",
        )
    )

    photo_file_id = event.get("telegram_photo_file_id")

    if photo_file_id:
        bot.send_photo(
            chat_id,
            photo=photo_file_id,
            caption=text,
            reply_markup=markup,
        )
    else:
        bot.send_message(
            chat_id,
            text,
            reply_markup=markup,
        )


def create_event_from_temp(chat_id: int, temp_user_id: int, reply_user_id: int):
    payload = {
        "title": admin_event_temp[temp_user_id]["title"],
        "organizer": admin_event_temp[temp_user_id]["organizer"],
        "description": admin_event_temp[temp_user_id]["description"],
        "max_participants": admin_event_temp[temp_user_id]["max_participants"],
        "price": admin_event_temp[temp_user_id]["price"],
        "starts_at": admin_event_temp[temp_user_id].get("starts_at"),
        "telegram_photo_file_id": admin_event_temp[temp_user_id].get("telegram_photo_file_id"),
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

    text = (
        "👤 Профиль\n\n"
        f"Имя: {data.get('first_name') or '-'}\n"
        f"Фамилия: {data.get('last_name') or '-'}\n"
        f"Телефон: {data.get('phone') or '-'}"
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
    func=lambda m: user_state.get(m.from_user.id) in ("WAIT_FIRST_NAME", "WAIT_LAST_NAME", "WAIT_PHONE"),
    content_types=["text"]
)
def handle_profile_steps(message):
    tid = message.from_user.id
    state = user_state.get(tid)

    if state == "WAIT_FIRST_NAME":
        user_temp[tid]["first_name"] = message.text.strip()
        user_state[tid] = "WAIT_LAST_NAME"
        bot.send_message(message.chat.id, "Теперь введи фамилию:")
        return

    if state == "WAIT_LAST_NAME":
        user_temp[tid]["last_name"] = message.text.strip()
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
        phone = normalize_phone(message.text)

        if not phone:
            bot.send_message(
                message.chat.id,
                "Некорректный номер телефона.\n"
                "Введи номер вручную ещё раз или нажми «📞 Поделиться контактом».",
            )
            return

        payload = {
            "telegram_id": tid,
            "username": message.from_user.username,
            "first_name": user_temp.get(tid, {}).get("first_name"),
            "last_name": user_temp.get(tid, {}).get("last_name"),
            "phone": phone,
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


@bot.message_handler(content_types=["contact"])
def handle_contact(message):
    tid = message.from_user.id

    # ---------- profile phone ----------
    if user_state.get(tid) == "WAIT_PHONE":
        phone = normalize_phone(message.contact.phone_number)

        if not phone:
            bot.send_message(
                message.chat.id,
                "Не удалось прочитать номер телефона. Попробуй ещё раз.",
            )
            return

        payload = {
            "telegram_id": tid,
            "username": message.from_user.username,
            "first_name": user_temp.get(tid, {}).get("first_name"),
            "last_name": user_temp.get(tid, {}).get("last_name"),
            "phone": phone,
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
        return

    # ---------- anything else ----------
    bot.send_message(
        message.chat.id,
        "Контакт получен, но сейчас регистрация не активна. Напиши /profile",
        reply_markup=get_main_menu(message.from_user.id),
    )


# =========================================================
# Events
# =========================================================
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
    elif data.get("status") == "already_registered":
        bot.answer_callback_query(call.id, "Ты уже записан")
        bot.send_message(
            call.message.chat.id,
            f"ℹ️ Ты уже записан на ивент #{event_id}",
            reply_markup=get_main_menu(call.from_user.id),
        )
    else:
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
    for e in items:
        markup.add(
            InlineKeyboardButton(
                f"👥 Участники: {e['title']}",
                callback_data=f"admin:participants:{e['id']}",
            )
        )

    bot.edit_message_text(
        "Выбери ивент:",
        call.message.chat.id,
        call.message.message_id,
        reply_markup=markup,
    )
    bot.answer_callback_query(call.id)


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

            full_name = f"{fname} {lname}".strip() or "Без имени"

            if uname:
                lines.append(f"- {full_name} (@{uname})")
            else:
                lines.append(f"- {full_name}")

        text = "\n".join(lines)

    markup = InlineKeyboardMarkup()
    markup.add(InlineKeyboardButton("⬅️ Назад к ивентам", callback_data="admin:events"))

    bot.edit_message_text(
        text,
        call.message.chat.id,
        call.message.message_id,
        reply_markup=markup,
    )
    bot.answer_callback_query(call.id)


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


@bot.message_handler(func=lambda m: admin_event_state.get(m.from_user.id) in (
    "WAIT_EVENT_NAME",
    "WAIT_EVENT_ORGANIZER",
    "WAIT_EVENT_DESCRIPTION",
    "WAIT_EVENT_MAX_PARTICIPANTS",
    "WAIT_EVENT_PRICE",
    "WAIT_EVENT_START_TIME",
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

        if state == "WAIT_EVENT_DESCRIPTION":
            admin_event_state[tid] = "WAIT_EVENT_ORGANIZER"
            bot.send_message(
                message.chat.id,
                "Введите организатора:",
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

        if state == "WAIT_EVENT_PHOTO":
            admin_event_state[tid] = "WAIT_EVENT_START_TIME"
            bot.send_message(
                message.chat.id,
                "Введите дату и время начала ивента.\n\n"
                "Формат:\n"
                "YYYY-MM-DD HH:MM\n\n"
                "Пример:\n"
                "2026-04-10 18:30",
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
            "2026-04-10 18:30",
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
                "2026-04-10 18:30",
                reply_markup=get_event_creation_nav_keyboard(),
            )
            return

        admin_event_temp[tid]["starts_at"] = starts_at.isoformat()
        admin_event_state[tid] = "WAIT_EVENT_PHOTO"

        bot.send_message(
            message.chat.id,
            "Теперь отправь постер ивента фото.\n"
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
            "На этом шаге нужно отправить фото,\nили нажать «⏭️ Пропустить»,\nили «⬅️ Назад».",
            reply_markup=get_event_creation_nav_keyboard(include_skip=True),
        )
        return


@bot.message_handler(content_types=["photo"])
def handle_event_photo(message):
    tid = message.from_user.id

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


if __name__ == "__main__":

    threading.Thread(
        target=notification_worker,
        daemon=True
    ).start()

    bot.infinity_polling()
