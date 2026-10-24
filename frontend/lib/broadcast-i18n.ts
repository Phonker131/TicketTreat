import type {LanguageCode} from "@/lib/types";

/** Localized broadcast workflow copy. Campaign subject/message are user-authored
 * and are never translated automatically.
 */
const translations: Array<[string,string,string,string]> = [
  [
    "Общая рассылка доступна только главным администраторам.",
    "Only global administrators can send a platform-wide broadcast.",
    "Hromadné zprávy celé platformě mohou posílat jen hlavní administrátoři.",
    "Загальну розсилку можуть надсилати лише головні адміністратори."
  ],
  [
    "У тебя нет прав на рассылку по этому событию.",
    "You cannot send announcements for this event.",
    "Nemáš oprávnění posílat oznámení pro tuto akci.",
    "Ти не маєш прав надсилати повідомлення для цієї події."
  ],
  [
    "Число получателей изменилось. Проверь аудиторию повторно.",
    "The audience changed. Check the recipient count again.",
    "Počet příjemců se změnil. Zkontroluj publikum znovu.",
    "Кількість отримувачів змінилася. Перевір аудиторію повторно."
  ],
  [
    "Глобальная рассылка разрешена один раз в 24 часа.",
    "Platform-wide broadcasts are limited to once per 24 hours.",
    "Celoplatformní rozesílka je povolena jednou za 24 hodin.",
    "Загальну розсилку дозволено раз на 24 години."
  ],
  [
    "На один ивент разрешены две рассылки в сутки.",
    "An event can have up to two broadcasts per day.",
    "Na jednu akci jsou povoleny dvě rozesílky denně.",
    "Для однієї події дозволено дві розсилки на добу."
  ],
  [
    "Подходящих получателей пока нет.",
    "There are no eligible recipients yet.",
    "Zatím nejsou žádní vhodní příjemci.",
    "Відповідних отримувачів поки немає."
  ],
  [
    "Не настроены каналы доставки. Проверь Resend и Telegram.",
    "Delivery providers are not configured. Check Resend and Telegram.",
    "Kanály doručení nejsou nastaveny. Zkontroluj Resend a Telegram.",
    "Канали доставки не налаштовано. Перевір Resend і Telegram."
  ],
  [
    "Аудитория превышает допустимый размер рассылки.",
    "The audience exceeds the allowed broadcast size.",
    "Publikum překračuje povolenou velikost rozesílky.",
    "Аудиторія перевищує дозволений розмір розсилки."
  ],
  [
    "Войди в профиль TicketTreat.",
    "Sign in to your TicketTreat profile.",
    "Přihlas se ke svému profilu TicketTreat.",
    "Увійди до профілю TicketTreat."
  ],
  [
    "Выбери ивент.",
    "Select an event.",
    "Vyber akci.",
    "Обери подію."
  ],
  [
    "Рассылка добавлена в очередь. Статусы доставки будут обновляться.",
    "Broadcast queued. Delivery statuses will update.",
    "Rozesílka zařazena do fronty. Stavy doručení se budou aktualizovat.",
    "Розсилку додано до черги. Статуси доставки оновлюватимуться."
  ],
  [
    "Нет подтверждённых получателей. Выбери другую аудиторию.",
    "No verified recipients. Choose another audience.",
    "Žádní ověření příjemci. Vyber jiné publikum.",
    "Немає підтверджених отримувачів. Обери іншу аудиторію."
  ],
  [
    "Сейчас недоступны оба канала рассылки.",
    "Both delivery channels are currently unavailable.",
    "Oba doručovací kanály jsou momentálně nedostupné.",
    "Обидва канали розсилки зараз недоступні."
  ],
  [
    "Подтверди, что это служебное сообщение.",
    "Confirm this is an operational announcement.",
    "Potvrď, že jde o provozní oznámení.",
    "Підтвердь, що це службове повідомлення."
  ],
  [
    "Введи SEND в поле подтверждения.",
    "Enter SEND in the confirmation field.",
    "Do potvrzovacího pole zadej SEND.",
    "Введи SEND у полі підтвердження."
  ],
  [
    "← Панель организатора",
    "← Organizer dashboard",
    "← Panel pořadatele",
    "← Панель організатора"
  ],
  [
    "📢 Рассылки",
    "📢 Broadcasts",
    "📢 Rozesílky",
    "📢 Розсилки"
  ],
  [
    "Служебные объявления по платформе или отдельному ивенту.",
    "Operational announcements for the whole platform or a single event.",
    "Provozní oznámení celé platformě nebo účastníkům konkrétní akce.",
    "Службові оголошення для всієї платформи або окремої події."
  ],
  [
    "Загрузка…",
    "Loading…",
    "Načítání…",
    "Завантаження…"
  ],
  [
    "1. Кому отправить",
    "1. Recipients",
    "1. Příjemci",
    "1. Отримувачі"
  ],
  [
    "Аудитория рассылки",
    "Broadcast audience",
    "Publikum rozesílky",
    "Аудиторія розсилки"
  ],
  [
    "🌍 Всем пользователям",
    "🌍 All users",
    "🌍 Všem uživatelům",
    "🌍 Усім користувачам"
  ],
  [
    "🎟 Участникам ивента",
    "🎟 Event attendees",
    "🎟 Účastníkům akce",
    "🎟 Учасникам події"
  ],
  [
    "Выбери мероприятие",
    "Select event",
    "Vyber akci",
    "Обери подію"
  ],
  [
    "Нет доступных мероприятий",
    "No available events",
    "Žádné dostupné akce",
    "Немає доступних подій"
  ],
  [
    "Уведомления получат участники именно этого события с подтверждёнными контактами.",
    "Only attendees of this event with verified contact details will be notified.",
    "Zprávy dostanou jen účastníci této akce s ověřenými kontakty.",
    "Повідомлення отримають лише учасники цієї події з підтвердженими контактами."
  ],
  [
    "Только главный администратор может отправлять сообщения всем пользователям платформы. Лимит: одна глобальная рассылка за 24 часа.",
    "Only global admins can notify all platform users. Limit: one broadcast per 24 hours.",
    "Všem uživatelům platformy může psát jen hlavní administrátor. Limit: jedna rozesílka za 24 hodin.",
    "Лише головний адміністратор може писати всім користувачам. Ліміт: одна розсилка за 24 години."
  ],
  [
    "Владелец может отправлять сообщения только по собственным событиям. Лимит: две рассылки на событие в сутки.",
    "Organizers can send announcements only for their own events. Limit: two per event per day.",
    "Pořadatelé mohou posílat zprávy jen pro vlastní akce. Limit: dvě na akci za den.",
    "Організатори можуть надсилати повідомлення лише для власних подій. Ліміт: дві на подію за добу."
  ],
  [
    "2. Сообщение",
    "2. Message",
    "2. Zpráva",
    "2. Повідомлення"
  ],
  [
    "Заголовок",
    "Subject",
    "Předmět",
    "Тема"
  ],
  [
    "Важные изменения по мероприятию",
    "Important event update",
    "Důležitá změna akce",
    "Важливе оновлення події"
  ],
  [
    "Текст рассылки",
    "Message",
    "Text zprávy",
    "Текст розсилки"
  ],
  [
    "Напиши важную информацию для участников…",
    "Write an important update for attendees…",
    "Napiš důležité informace pro účastníky…",
    "Напиши важливу інформацію для учасників…"
  ],
  [
    "Ссылка на изображение (необязательно)",
    "Image URL (optional)",
    "Odkaz na obrázek (volitelné)",
    "Посилання на зображення (необов’язково)"
  ],
  [
    "Публичный HTTPS-адрес картинки для Telegram и email. Необязательно.",
    "Public HTTPS image URL for Telegram and email. Optional.",
    "Veřejná HTTPS adresa obrázku pro Telegram a e-mail. Volitelné.",
    "Публічна HTTPS-адреса зображення для Telegram та email. Необов’язково."
  ],
  [
    "Текст сообщения появится здесь.",
    "Your message preview appears here.",
    "Zde se zobrazí náhled zprávy.",
    "Тут з’явиться попередній перегляд повідомлення."
  ],
  [
    "🖼 Изображение прикреплено",
    "🖼 Image attached",
    "🖼 Obrázek přiložen",
    "🖼 Зображення додано"
  ],
  [
    "3. Проверка и отправка",
    "3. Review and send",
    "3. Kontrola a odeslání",
    "3. Перевірка й надсилання"
  ],
  [
    "Сначала нажми «Посчитать получателей». После изменения заголовка или текста проверку аудитории нужно повторить. Для отправки требуется заголовок от 5 и текст от 20 символов.",
    "First calculate recipients. Repeat after editing the subject or message. Subject must have 5+ characters and message 20+.",
    "Nejprve spočítej příjemce. Po změně předmětu nebo textu kontrolu opakuj. Předmět musí mít alespoň 5 a zpráva 20 znaků.",
    "Спочатку підрахуй отримувачів. Після зміни теми чи тексту перевірку повтори. Тема має містити від 5, текст — від 20 символів."
  ],
  [
    "Проверяем…",
    "Checking…",
    "Kontroluji…",
    "Перевіряємо…"
  ],
  [
    "👥 Посчитать получателей",
    "👥 Calculate recipients",
    "👥 Spočítat příjemce",
    "👥 Підрахувати отримувачів"
  ],
  [
    "Подключён",
    "Connected",
    "Připojeno",
    "Підключено"
  ],
  [
    "Провайдер отключён",
    "Provider offline",
    "Poskytovatel je vypnutý",
    "Провайдер вимкнено"
  ],
  [
    "Бот недоступен",
    "Bot unavailable",
    "Bot není dostupný",
    "Бот недоступний"
  ],
  [
    "Сейчас нет адресатов для рассылки.",
    "No recipients available.",
    "Nejsou dostupní příjemci.",
    "Немає отримувачів для розсилки."
  ],
  [
    "Подтверждаю, что это служебное сообщение, связанное с TicketTreat или участием в событии, а не рекламная рассылка без согласия получателей.",
    "I confirm this is an operational message related to TicketTreat or event attendance, not unsolicited marketing.",
    "Potvrzuji, že jde o provozní zprávu související s TicketTreat nebo účastí na akci, nikoli o nevyžádaný marketing.",
    "Підтверджую, що це службове повідомлення, пов’язане з TicketTreat або участю в події, а не рекламна розсилка без згоди."
  ],
  [
    "Для подтверждения введи",
    "To confirm, enter",
    "Pro potvrzení zadej",
    "Для підтвердження введи"
  ],
  [
    "Что ещё нужно для отправки:",
    "Still needed before sending:",
    "Co je ještě potřeba před odesláním:",
    "Що ще потрібно для надсилання:"
  ],
  [
    "✓ Все проверки пройдены. Рассылка готова к подтверждению.",
    "✓ All checks passed. Broadcast ready for confirmation.",
    "✓ Všechny kontroly prošly. Rozesílka je připravena k potvrzení.",
    "✓ Усі перевірки пройдено. Розсилка готова до підтвердження."
  ],
  [
    "Отправляем…",
    "Sending…",
    "Odesílání…",
    "Надсилаємо…"
  ],
  [
    "📢 Подтвердить рассылку",
    "📢 Confirm broadcast",
    "📢 Potvrdit rozesílku",
    "📢 Підтвердити розсилку"
  ],
  [
    "Рассылка запускается только после подтверждения. Количество сообщений по каналам может отличаться, а один человек может получить их в обоих каналах.",
    "The broadcast starts only after confirmation. Channel counts may differ and a user may receive both email and Telegram.",
    "Rozesílka začne až po potvrzení. Počty se mohou mezi kanály lišit a příjemce může dostat e-mail i Telegram.",
    "Розсилка починається лише після підтвердження. Кількість повідомлень каналами може різнитися, а людина може отримати і email, і Telegram."
  ],
  [
    "История отправок",
    "Broadcast history",
    "Historie rozesílek",
    "Історія розсилок"
  ],
  [
    "↻ Обновить",
    "↻ Refresh",
    "↻ Obnovit",
    "↻ Оновити"
  ],
  [
    "История рассылок пока пустая.",
    "No broadcasts yet.",
    "Zatím žádné rozesílky.",
    "Історія розсилок поки порожня."
  ],
  [
    "Все пользователи",
    "All users",
    "Všichni uživatelé",
    "Усі користувачі"
  ],
  [
    "Ивент #",
    "Event #",
    "Akce č. ",
    "Подія №"
  ],
  [
    "отправлено",
    "sent",
    "odesláno",
    "надіслано"
  ],
  [
    "ошибок",
    "failed",
    "chybných",
    "помилок"
  ],
  [
    "недоступно",
    "unavailable",
    "nedostupných",
    "недоступно"
  ],
  [
    "Минимум",
    "Minimum",
    "Minimálně",
    "Мінімум"
  ],
  [
    "символов",
    "characters",
    "znaků",
    "символів"
  ],
  [
    "Сейчас",
    "Now",
    "Teď",
    "Зараз"
  ],
  [
    "добавь ещё",
    "add",
    "přidej ještě",
    "додай ще"
  ],
  [
    "Заголовок: добавь ещё",
    "Subject: add",
    "Předmět: přidej ještě",
    "Тема: додай ще"
  ],
  [
    "Текст рассылки: добавь ещё",
    "Message: add",
    "Text zprávy: přidej ještě",
    "Текст розсилки: додай ще"
  ],
  [
    "симв. (минимум",
    "chars (minimum",
    "znaků (minimum",
    "симв. (мінімум"
  ],
  [
    "✓ Текст готов к отправке:",
    "✓ Message ready to send:",
    "✓ Text připraven k odeslání:",
    "✓ Текст готовий до надсилання:"
  ],
  [
    "Не удалось выполнить действие. Попробуй ещё раз.",
    "Could not complete the action. Try again.",
    "Akci se nepodařilo dokončit. Zkus to znovu.",
    "Не вдалося виконати дію. Спробуй ще раз."
  ]
];
const dictionary = new Map(translations.map(([ru,en,cs,uk])=>[ru,{ru,en,cs,uk}]));
export function broadcastText(language: LanguageCode, source: string): string {
  return dictionary.get(source)?.[language] ?? source;
}
