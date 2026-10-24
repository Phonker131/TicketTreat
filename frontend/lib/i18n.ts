import type { LanguageCode } from "@/lib/types";

export const SUPPORTED_LANGUAGES: LanguageCode[] = ["en", "cs", "ru", "uk"];

export const LANGUAGE_LABELS: Record<LanguageCode, string> = {
  en: "🇬🇧 English",
  cs: "🇨🇿 Čeština",
  ru: "🇷🇺 Русский",
  uk: "🇺🇦 Українська",
};

export const LANGUAGE_NAMES: Record<LanguageCode, Record<LanguageCode, string>> = {
  en: {en: "English", cs: "Czech", ru: "Russian", uk: "Ukrainian"},
  cs: {en: "angličtina", cs: "čeština", ru: "ruština", uk: "ukrajinština"},
  ru: {en: "английский", cs: "чешский", ru: "русский", uk: "украинский"},
  uk: {en: "англійська", cs: "чеська", ru: "російська", uk: "українська"},
};

const translations = {
  en: {
    tagline: "Events, tickets and reminders in one place.",
    upcoming: "Upcoming events", upcomingHint: "Choose an event and see all details.",
    loading: "Loading…", noEvents: "No upcoming events yet.",
    loadError: "Could not load data. Try again shortly.", details: "Details",
    organizer: "Organizer", location: "Location", price: "Price", startsAt: "Starts",
    spots: "Places left", languages: "Event languages", notSpecified: "Not specified",
    free: "Free", soldOut: "Sold out", cancelled: "Cancelled", join: "Book a spot",
    back: "Back", eventNotFound: "Event not found.", home: "Events",
    telegramMode: "Telegram Mini App", webMode: "Web app", tickets: "My tickets",
    admin: "Organizer", profile: "My profile", demo: "DEMO", demoHint: "Showcase mode — no real money is charged.",
    checkout: "Checkout", yourDetails: "Your details", firstName: "First name",
    lastName: "Last name", email: "Email", continue: "Continue", payment: "Payment",
    card: "Card", applePay: "Apple Pay", googlePay: "Google Pay", pay: "Pay",
    paymentSuccess: "Payment successful", ticketReady: "Your ticket is ready.",
    viewTicket: "View ticket", noTickets: "You do not have tickets yet.",
    ticket: "Ticket", paid: "Paid", checkedIn: "Checked in", notCheckedIn: "Not checked in",
    cancelTicket: "Cancel ticket", cancelledTicket: "Ticket cancelled", waitlist: "Join waitlist",
    waitlistJoined: "You are on the waitlist.", qrHint: "Show this QR code at the entrance.",
  },
  cs: {
    tagline: "Události, vstupenky a připomínky na jednom místě.",
    upcoming: "Nadcházející události", upcomingHint: "Vyber událost a zobraz podrobnosti.",
    loading: "Načítám…", noEvents: "Zatím nejsou žádné nadcházející události.",
    loadError: "Data se nepodařilo načíst.", details: "Podrobnosti",
    organizer: "Organizátor", location: "Místo", price: "Cena", startsAt: "Začátek",
    spots: "Volná místa", languages: "Jazyky události", notSpecified: "Neuvedeno",
    free: "Zdarma", soldOut: "Vyprodáno", cancelled: "Zrušeno", join: "Rezervovat místo",
    back: "Zpět", eventNotFound: "Událost nebyla nalezena.", home: "Události",
    telegramMode: "Telegram Mini App", webMode: "Webová aplikace", tickets: "Moje vstupenky",
    admin: "Organizátor", profile: "Můj profil", demo: "DEMO", demoHint: "Ukázkový režim — žádné skutečné peníze se nestrhávají.",
    checkout: "Platba", yourDetails: "Tvoje údaje", firstName: "Jméno",
    lastName: "Příjmení", email: "E-mail", continue: "Pokračovat", payment: "Platba",
    card: "Karta", applePay: "Apple Pay", googlePay: "Google Pay", pay: "Zaplatit",
    paymentSuccess: "Platba proběhla", ticketReady: "Vstupenka je připravena.",
    viewTicket: "Zobrazit vstupenku", noTickets: "Zatím nemáš žádné vstupenky.",
    ticket: "Vstupenka", paid: "Zaplaceno", checkedIn: "Odbaveno", notCheckedIn: "Neodbaveno",
    cancelTicket: "Zrušit vstupenku", cancelledTicket: "Vstupenka zrušena", waitlist: "Přidat se na čekací listinu",
    waitlistJoined: "Jsi na čekací listině.", qrHint: "Ukaž tento QR kód u vstupu.",
  },
  ru: {
    tagline: "Ивенты, билеты и напоминания в одном месте.",
    upcoming: "Ближайшие ивенты", upcomingHint: "Выбери ивент и посмотри все детали.",
    loading: "Загружаем…", noEvents: "Пока нет ближайших ивентов.",
    loadError: "Не удалось загрузить данные.", details: "Подробнее",
    organizer: "Организатор", location: "Локация", price: "Цена", startsAt: "Начало",
    spots: "Осталось мест", languages: "Языки ивента", notSpecified: "Не указано",
    free: "Бесплатно", soldOut: "Мест нет", cancelled: "Отменён", join: "Записаться",
    back: "Назад", eventNotFound: "Ивент не найден.", home: "Ивенты",
    telegramMode: "Telegram Mini App", webMode: "Веб-приложение", tickets: "Мои билеты",
    admin: "Организатор", profile: "Мой профиль", demo: "DEMO", demoHint: "Демо-режим — реальные деньги не списываются.",
    checkout: "Оплата", yourDetails: "Твои данные", firstName: "Имя",
    lastName: "Фамилия", email: "Email", continue: "Продолжить", payment: "Оплата",
    card: "Карта", applePay: "Apple Pay", googlePay: "Google Pay", pay: "Оплатить",
    paymentSuccess: "Оплата прошла", ticketReady: "Твой билет готов.",
    viewTicket: "Открыть билет", noTickets: "У тебя пока нет билетов.",
    ticket: "Билет", paid: "Оплачено", checkedIn: "Check-in выполнен", notCheckedIn: "Check-in не выполнен",
    cancelTicket: "Отменить билет", cancelledTicket: "Билет отменён", waitlist: "Встать в лист ожидания",
    waitlistJoined: "Ты в листе ожидания.", qrHint: "Покажи этот QR-код на входе.",
  },
  uk: {
    tagline: "Події, квитки та нагадування в одному місці.",
    upcoming: "Найближчі події", upcomingHint: "Обери подію та переглянь усі деталі.",
    loading: "Завантажуємо…", noEvents: "Поки немає найближчих подій.",
    loadError: "Не вдалося завантажити дані.", details: "Докладніше",
    organizer: "Організатор", location: "Локація", price: "Ціна", startsAt: "Початок",
    spots: "Залишилось місць", languages: "Мови події", notSpecified: "Не вказано",
    free: "Безкоштовно", soldOut: "Місць немає", cancelled: "Скасовано", join: "Забронювати місце",
    back: "Назад", eventNotFound: "Подію не знайдено.", home: "Події",
    telegramMode: "Telegram Mini App", webMode: "Вебзастосунок", tickets: "Мої квитки",
    admin: "Організатор", profile: "Мій профіль", demo: "DEMO", demoHint: "Демо-режим — реальні гроші не списуються.",
    checkout: "Оплата", yourDetails: "Твої дані", firstName: "Ім'я",
    lastName: "Прізвище", email: "Email", continue: "Продовжити", payment: "Оплата",
    card: "Картка", applePay: "Apple Pay", googlePay: "Google Pay", pay: "Оплатити",
    paymentSuccess: "Оплата пройшла", ticketReady: "Твій квиток готовий.",
    viewTicket: "Відкрити квиток", noTickets: "У тебе поки немає квитків.",
    ticket: "Квиток", paid: "Оплачено", checkedIn: "Check-in виконано", notCheckedIn: "Check-in не виконано",
    cancelTicket: "Скасувати квиток", cancelledTicket: "Квиток скасовано", waitlist: "Стати в лист очікування",
    waitlistJoined: "Ти в листі очікування.", qrHint: "Покажи цей QR-код на вході.",
  },
} as const;

export type TranslationKey = keyof typeof translations.en;

export function t(language: LanguageCode, key: TranslationKey): string {
  return translations[language][key];
}

export function normalizeLanguage(value: string | null | undefined): LanguageCode | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().replace("_", "-").split("-")[0];
  if (normalized === "en" || normalized === "cs" || normalized === "ru" || normalized === "uk") {
    return normalized;
  }
  return null;
}

export function localeForLanguage(language: LanguageCode): string {
  return {en: "en-GB", cs: "cs-CZ", ru: "ru-RU", uk: "uk-UA"}[language];
}
