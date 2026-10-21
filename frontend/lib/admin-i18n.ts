import type {LanguageCode} from "@/lib/types";

/** Curated administrator-facing TicketTreat translations.
 * Missing entries are intentionally exposed in Russian for QA, not
 * silently translated using a browser/plugin with uncertain meaning.
 */
const translations:Record<string,Partial<Record<LanguageCode,string>>> =  {
  "Все события TicketTreat": {
    "en": "All TicketTreat events",
    "cs": "Všechny akce TicketTreat",
    "uk": "Усі події TicketTreat"
  },
  "Мои ивенты": {
    "en": "My events",
    "cs": "Moje akce",
    "uk": "Мої події"
  },
  "Все события": {
    "en": "All events",
    "cs": "Všechny akce",
    "uk": "Усі події"
  },
  "Мои события": {
    "en": "My events",
    "cs": "Moje akce",
    "uk": "Мої події"
  },
  "Управление аккаунтами": {
    "en": "Manage accounts",
    "cs": "Správa účtů",
    "uk": "Керування акаунтами"
  },
  "Контент сайта": {
    "en": "Website content",
    "cs": "Obsah webu",
    "uk": "Контент сайту"
  },
  "Заявки организаторов": {
    "en": "Organizer applications",
    "cs": "Žádosti pořadatelů",
    "uk": "Заявки організаторів"
  },
  "Запросы на удаление": {
    "en": "Deletion requests",
    "cs": "Žádosti o výmaz",
    "uk": "Запити на видалення"
  },
  "Создать черновик": {
    "en": "Create draft",
    "cs": "Vytvořit koncept",
    "uk": "Створити чернетку"
  },
  "Новый ивент": {
    "en": "New event",
    "cs": "Nová akce",
    "uk": "Нова подія"
  },
  "Название": {
    "en": "Title",
    "cs": "Název",
    "uk": "Назва"
  },
  "Организатор": {
    "en": "Organizer",
    "cs": "Pořadatel",
    "uk": "Організатор"
  },
  "Описание": {
    "en": "Description",
    "cs": "Popis",
    "uk": "Опис"
  },
  "Адрес или место проведения": {
    "en": "Venue or address",
    "cs": "Místo konání nebo adresa",
    "uk": "Місце проведення або адреса"
  },
  "Языки ивента": {
    "en": "Event languages",
    "cs": "Jazyky akce",
    "uk": "Мови події"
  },
  "Постер JPG/PNG/WebP до 4 МБ": {
    "en": "Poster JPG/PNG/WebP up to 4 MB",
    "cs": "Plakát JPG/PNG/WebP do 4 MB",
    "uk": "Афіша JPG/PNG/WebP до 4 МБ"
  },
  "Начало": {
    "en": "Starts",
    "cs": "Začátek",
    "uk": "Початок"
  },
  "Мест": {
    "en": "Capacity",
    "cs": "Kapacita",
    "uk": "Місць"
  },
  "Цена": {
    "en": "Price",
    "cs": "Cena",
    "uk": "Ціна"
  },
  "Валюта": {
    "en": "Currency",
    "cs": "Měna",
    "uk": "Валюта"
  },
  "Закрыть": {
    "en": "Close",
    "cs": "Zavřít",
    "uk": "Закрити"
  },
  "Редактировать ивент": {
    "en": "Edit event",
    "cs": "Upravit akci",
    "uk": "Редагувати подію"
  },
  "Отменить ивент": {
    "en": "Cancel event",
    "cs": "Zrušit akci",
    "uk": "Скасувати подію"
  },
  "Предпросмотр ↗": {
    "en": "Preview ↗",
    "cs": "Náhled ↗",
    "uk": "Попередній перегляд ↗"
  },
  "Публичная страница ↗": {
    "en": "Public page ↗",
    "cs": "Veřejná stránka ↗",
    "uk": "Публічна сторінка ↗"
  },
  "Копировать ивент": {
    "en": "Duplicate event",
    "cs": "Duplikovat akci",
    "uk": "Копіювати подію"
  },
  "Публикация мероприятия": {
    "en": "Event publishing",
    "cs": "Publikování akce",
    "uk": "Публікація події"
  },
  "Опубликовать сейчас": {
    "en": "Publish now",
    "cs": "Publikovat nyní",
    "uk": "Опублікувати зараз"
  },
  "Снять с публикации": {
    "en": "Unpublish",
    "cs": "Zrušit zveřejnění",
    "uk": "Зняти з публікації"
  },
  "Опубликовать автоматически": {
    "en": "Schedule publication",
    "cs": "Naplánovat zveřejnění",
    "uk": "Запланувати публікацію"
  },
  "Запланировать": {
    "en": "Schedule",
    "cs": "Naplánovat",
    "uk": "Запланувати"
  },
  "Копировать ссылку": {
    "en": "Copy link",
    "cs": "Kopírovat odkaz",
    "uk": "Копіювати посилання"
  },
  "Скачать QR для афиши": {
    "en": "Download promo QR",
    "cs": "Stáhnout QR pro plakát",
    "uk": "Завантажити QR для афіші"
  },
  "Редактировать информацию": {
    "en": "Edit details",
    "cs": "Upravit informace",
    "uk": "Редагувати інформацію"
  },
  "Фото мероприятия (HTTPS, по одной ссылке на строку, до 8)": {
    "en": "Event photos (HTTPS, one URL per line, max 8)",
    "cs": "Fotografie (HTTPS, jeden odkaz na řádek, max. 8)",
    "uk": "Фото події (HTTPS, по одному посиланню в рядку, до 8)"
  },
  "Видео (YouTube/Vimeo)": {
    "en": "Video (YouTube/Vimeo)",
    "cs": "Video (YouTube/Vimeo)",
    "uk": "Відео (YouTube/Vimeo)"
  },
  "Языки": {
    "en": "Languages",
    "cs": "Jazyky",
    "uk": "Мови"
  },
  "Количество мест": {
    "en": "Capacity",
    "cs": "Kapacita",
    "uk": "Кількість місць"
  },
  "Новый постер (необязательно)": {
    "en": "New poster (optional)",
    "cs": "Nový plakát (volitelně)",
    "uk": "Нова афіша (необов'язково)"
  },
  "Сохранить изменения": {
    "en": "Save changes",
    "cs": "Uložit změny",
    "uk": "Зберегти зміни"
  },
  "Фотогалерея мероприятия": {
    "en": "Event photo gallery",
    "cs": "Fotogalerie akce",
    "uk": "Фотогалерея події"
  },
  "Добавить фотографии": {
    "en": "Add photos",
    "cs": "Přidat fotografie",
    "uk": "Додати фотографії"
  },
  "Сделать обложкой": {
    "en": "Set as cover",
    "cs": "Nastavit jako titulní",
    "uk": "Зробити обкладинкою"
  },
  "✓ Обложка": {
    "en": "✓ Cover",
    "cs": "✓ Titulní",
    "uk": "✓ Обкладинка"
  },
  "Удалить": {
    "en": "Delete",
    "cs": "Smazat",
    "uk": "Видалити"
  },
  "Отмена ивента": {
    "en": "Cancel event",
    "cs": "Zrušení akce",
    "uk": "Скасування події"
  },
  "Причина отмены": {
    "en": "Cancellation reason",
    "cs": "Důvod zrušení",
    "uk": "Причина скасування"
  },
  "Подтвердить отмену": {
    "en": "Confirm cancellation",
    "cs": "Potvrdit zrušení",
    "uk": "Підтвердити скасування"
  },
  "Аналитика посещаемости": {
    "en": "Attendance analytics",
    "cs": "Statistiky účasti",
    "uk": "Аналітика відвідуваності"
  },
  "Регистрации всего": {
    "en": "Total registrations",
    "cs": "Celkem registrací",
    "uk": "Усього реєстрацій"
  },
  "Заполненность": {
    "en": "Occupancy",
    "cs": "Obsazenost",
    "uk": "Заповненість"
  },
  "Пришли по QR": {
    "en": "QR check-ins",
    "cs": "QR odbavení",
    "uk": "Прийшли за QR"
  },
  "Итоговый no-show": {
    "en": "Final no-shows",
    "cs": "Konečný počet nepřítomných",
    "uk": "Підсумкова неявка"
  },
  "Ожидают места": {
    "en": "Waiting list",
    "cs": "Čekací listina",
    "uk": "Очікують місця"
  },
  "Отмены": {
    "en": "Cancellations",
    "cs": "Zrušené rezervace",
    "uk": "Скасування"
  },
  "Источники регистраций": {
    "en": "Registration sources",
    "cs": "Zdroje registrací",
    "uk": "Джерела реєстрацій"
  },
  "Регистрации по дням (до 90 дат)": {
    "en": "Daily registrations (up to 90 days)",
    "cs": "Registrace podle dnů (až 90 dní)",
    "uk": "Реєстрації за днями (до 90 днів)"
  },
  "Правила бесплатной регистрации": {
    "en": "Free booking rules",
    "cs": "Pravidla bezplatné registrace",
    "uk": "Правила безкоштовної реєстрації"
  },
  "Письма-напоминания": {
    "en": "Email reminders",
    "cs": "E-mailové připomínky",
    "uk": "Нагадування email"
  },
  "За 7 дней": {
    "en": "7 days before",
    "cs": "7 dní předem",
    "uk": "За 7 днів"
  },
  "За 24 часа": {
    "en": "24 hours before",
    "cs": "24 hodin předem",
    "uk": "За 24 години"
  },
  "За 3 часа": {
    "en": "3 hours before",
    "cs": "3 hodiny předem",
    "uk": "За 3 години"
  },
  "Предложение места из waitlist": {
    "en": "Waitlist offer mode",
    "cs": "Nabídky z čekací listiny",
    "uk": "Пропозиція місця з черги"
  },
  "Сохранить правила": {
    "en": "Save rules",
    "cs": "Uložit pravidla",
    "uk": "Зберегти правила"
  },
  "Персонал для проверки билетов": {
    "en": "Ticket check-in staff",
    "cs": "Personál pro kontrolu vstupenek",
    "uk": "Персонал для перевірки квитків"
  },
  "Email сотрудника": {
    "en": "Staff email",
    "cs": "E-mail pracovníka",
    "uk": "Email працівника"
  },
  "Выдать доступ": {
    "en": "Grant access",
    "cs": "Udělit přístup",
    "uk": "Надати доступ"
  },
  "Отозвать": {
    "en": "Revoke",
    "cs": "Odebrat",
    "uk": "Відкликати"
  },
  "Уведомления участникам": {
    "en": "Attendee notifications",
    "cs": "Oznámení účastníkům",
    "uk": "Сповіщення учасникам"
  },
  "Служебное сообщение по мероприятию": {
    "en": "Operational event notice",
    "cs": "Organizační sdělení k akci",
    "uk": "Службове повідомлення про подію"
  },
  "Тип уведомления": {
    "en": "Notice category",
    "cs": "Kategorie sdělení",
    "uk": "Тип сповіщення"
  },
  "Инструкция по входу": {
    "en": "Entry instructions",
    "cs": "Pokyny ke vstupu",
    "uk": "Інструкція щодо входу"
  },
  "Уточнение программы": {
    "en": "Schedule details",
    "cs": "Upřesnění programu",
    "uk": "Уточнення програми"
  },
  "Отправить служебное сообщение": {
    "en": "Send operational notice",
    "cs": "Odeslat organizační sdělení",
    "uk": "Надіслати службове повідомлення"
  },
  "Нет регистраций.": {
    "en": "No registrations yet.",
    "cs": "Zatím žádné registrace.",
    "uk": "Поки немає реєстрацій."
  },
  "Сохранить": {
    "en": "Save",
    "cs": "Uložit",
    "uk": "Зберегти"
  },
  "Поиск мероприятий": {
    "en": "Search events",
    "cs": "Hledat akce",
    "uk": "Пошук подій"
  },
  "Статус": {
    "en": "Status",
    "cs": "Stav",
    "uk": "Статус"
  },
  "Сортировка": {
    "en": "Sort by",
    "cs": "Řazení",
    "uk": "Сортування"
  },
  "Черновик": {
    "en": "Draft",
    "cs": "Koncept",
    "uk": "Чернетка"
  },
  "Запланировано": {
    "en": "Scheduled",
    "cs": "Naplánováno",
    "uk": "Заплановано"
  },
  "Опубликовано": {
    "en": "Published",
    "cs": "Zveřejněno",
    "uk": "Опубліковано"
  },
  "Отменено": {
    "en": "Cancelled",
    "cs": "Zrušeno",
    "uk": "Скасовано"
  },
  "Ближайшие по дате": {
    "en": "Soonest first",
    "cs": "Nejbližší první",
    "uk": "Найближчі за датою"
  },
  "По названию": {
    "en": "By title",
    "cs": "Podle názvu",
    "uk": "За назвою"
  },
  "Все": {
    "en": "All",
    "cs": "Všechny",
    "uk": "Усі"
  },
  "Новые первыми": {
    "en": "Newest first",
    "cs": "Nejnovější první",
    "uk": "Найновіші першими"
  },
  "Главные администраторы": {
    "en": "Global administrators",
    "cs": "Hlavní administrátoři",
    "uk": "Головні адміністратори"
  },
  "Назначить главного администратора": {
    "en": "Assign global administrator",
    "cs": "Přidělit hlavního administrátora",
    "uk": "Призначити головного адміністратора"
  },
  "Загрузка…": {
    "en": "Loading…",
    "cs": "Načítání…",
    "uk": "Завантаження…"
  },
  "Контент главной страницы": {
    "en": "Homepage content",
    "cs": "Obsah úvodní stránky",
    "uk": "Контент головної сторінки"
  },
  "Заголовок": {
    "en": "Heading",
    "cs": "Nadpis",
    "uk": "Заголовок"
  },
  "Новое изображение (JPG/PNG/WebP до 4 МБ)": {
    "en": "New image (JPG/PNG/WebP up to 4 MB)",
    "cs": "Nový obrázek (JPG/PNG/WebP do 4 MB)",
    "uk": "Нове зображення (JPG/PNG/WebP до 4 МБ)"
  },
  "Удалить изображение баннера": {
    "en": "Remove banner image",
    "cs": "Odebrat obrázek banneru",
    "uk": "Видалити банер"
  },
  "← Админ-панель": {
    "en": "← Admin dashboard",
    "cs": "← Správa",
    "uk": "← Адмін-панель"
  },
  "Изменения появятся на сайте и в Telegram Mini App. Доступ — только глобальному администратору.": {
    "en": "Changes appear on the website and Telegram Mini App. Only global admins may edit.",
    "cs": "Změny se zobrazí na webu i v Telegram Mini App. Upravovat mohou pouze hlavní administrátoři.",
    "uk": "Зміни з'являться на сайті та в Telegram Mini App. Доступ — лише головному адміністратору."
  },
  "Organizer applications": {
    "en": "Organizer applications",
    "cs": "Žádosti pořadatelů",
    "uk": "Заявки організаторів"
  },
  "Applicants must verify their email. Global admin MFA is required to approve new event organizers.": {
    "en": "Applicants must verify their email. Global admin MFA is required.",
    "cs": "Uchazeči musí ověřit e-mail. Schválení vyžaduje dvoufaktorové ověření správce.",
    "uk": "Заявники повинні підтвердити email. Для схвалення потрібна MFA адміністратора."
  },
  "No pending applications.": {
    "en": "No pending applications.",
    "cs": "Žádné nevyřízené žádosti.",
    "uk": "Немає заявок в очікуванні."
  },
  "Approve": {
    "en": "Approve",
    "cs": "Schválit",
    "uk": "Схвалити"
  },
  "Reject": {
    "en": "Reject",
    "cs": "Zamítnout",
    "uk": "Відхилити"
  },
  "← Admin": {
    "en": "← Admin",
    "cs": "← Administrace",
    "uk": "← Адмін"
  },
  "← Admin dashboard": {
    "en": "← Admin dashboard",
    "cs": "← Správa",
    "uk": "← Адмін-панель"
  },
  "Data erasure requests": {
    "en": "Data erasure requests",
    "cs": "Žádosti o výmaz údajů",
    "uk": "Запити на видалення даних"
  },
  "No pending requests.": {
    "en": "No pending requests.",
    "cs": "Žádné čekající žádosti.",
    "uk": "Немає запитів в очікуванні."
  },
  "Fulfill eligible erasure": {
    "en": "Process eligible erasure",
    "cs": "Provést oprávněný výmaz",
    "uk": "Виконати підтверджене видалення"
  },
  "Scan TicketTreat ticket": {
    "en": "Scan TicketTreat ticket",
    "cs": "Skenování vstupenky TicketTreat",
    "uk": "Сканування квитка TicketTreat"
  },
  "Camera scanner + manual fallback.": {
    "en": "Camera scanning and manual entry.",
    "cs": "Skenování kamerou i ruční zadání.",
    "uk": "Сканування камерою та ручне введення."
  },
  "Check in": {
    "en": "Check in",
    "cs": "Odbavit",
    "uk": "Відмітити вхід"
  },
  "← Organizer dashboard": {
    "en": "← Organizer dashboard",
    "cs": "← Správa akcí",
    "uk": "← Панель організатора"
  },
  "← Back to profile": {
    "en": "← Back to profile",
    "cs": "← Zpět na profil",
    "uk": "← Назад до профілю"
  },
  "Two-factor authentication": {
    "en": "Two-factor authentication",
    "cs": "Dvoufaktorové ověření",
    "uk": "Двофакторна автентифікація"
  },
  "Connect authenticator app": {
    "en": "Connect authenticator app",
    "cs": "Připojit ověřovací aplikaci",
    "uk": "Підключити застосунок автентифікації"
  },
  "Start MFA enrollment": {
    "en": "Start MFA enrollment",
    "cs": "Nastavit MFA",
    "uk": "Налаштувати MFA"
  },
  "Add TicketTreat to your authenticator": {
    "en": "Add TicketTreat to your authenticator",
    "cs": "Přidat TicketTreat do autentizační aplikace",
    "uk": "Додати TicketTreat до застосунку"
  },
  "Enter this setup key manually in your authenticator app. Keep this secret private.": {
    "en": "Enter this setup key manually. Keep it private.",
    "cs": "Zadejte tento nastavovací klíč ručně. Uchovejte jej v tajnosti.",
    "uk": "Введіть цей ключ вручну. Зберігайте його в таємниці."
  },
  "Open authenticator app": {
    "en": "Open authenticator app",
    "cs": "Otevřít ověřovací aplikaci",
    "uk": "Відкрити застосунок автентифікації"
  },
  "Six-digit code": {
    "en": "Six-digit code",
    "cs": "Šestimístný kód",
    "uk": "Шестизначний код"
  },
  "Enable two-factor authentication": {
    "en": "Enable two-factor authentication",
    "cs": "Zapnout dvoufaktorové ověření",
    "uk": "Увімкнути двофакторну автентифікацію"
  },
  "MFA enabled.": {
    "en": "MFA enabled.",
    "cs": "MFA zapnuto.",
    "uk": "MFA увімкнено."
  },
  "Authenticator code": {
    "en": "Authenticator code",
    "cs": "Ověřovací kód",
    "uk": "Код автентифікатора"
  },
  "Verify session": {
    "en": "Verify session",
    "cs": "Ověřit relaci",
    "uk": "Підтвердити сесію"
  },
  "Open organizer dashboard": {
    "en": "Open organizer dashboard",
    "cs": "Otevřít správu akcí",
    "uk": "Відкрити панель організатора"
  },
  "← Profile": {
    "en": "← Profile",
    "cs": "← Profil",
    "uk": "← Профіль"
  },
  "Become an organizer": {
    "en": "Become an organizer",
    "cs": "Stát se pořadatelem",
    "uk": "Стати організатором"
  },
  "Account role:": {
    "en": "Account role:",
    "cs": "Role účtu:",
    "uk": "Роль акаунта:"
  },
  "Application status:": {
    "en": "Application status:",
    "cs": "Stav žádosti:",
    "uk": "Статус заявки:"
  },
  "Submit application": {
    "en": "Submit application",
    "cs": "Odeslat žádost",
    "uk": "Подати заявку"
  },
  "Configure MFA": {
    "en": "Configure MFA",
    "cs": "Nastavit MFA",
    "uk": "Налаштувати MFA"
  },
  "Participant": {
    "en": "Participant",
    "cs": "Účastník",
    "uk": "Учасник"
  },
  "Organizer": {
    "en": "Organizer",
    "cs": "Pořadatel",
    "uk": "Організатор"
  }
};

export function adminTranslate(language:LanguageCode, text:string):string {
  if(language==="ru")return text;
  return translations[text]?.[language] || text;
}
