import type {LanguageCode} from "@/lib/types";

/** User-facing text only: never expose raw backend error codes or internal details.
 * Keep operational errors separate from mistakes the visitor can correct.
 */
const MESSAGES: Record<string,Record<LanguageCode,string>> = {
  "login_required": {
    "en": "Please sign in from Profile and try again.",
    "cs": "Přihlaste se v Profilu a akci zopakujte.",
    "ru": "Войди в аккаунт через «Профиль» и повтори действие.",
    "uk": "Увійди в акаунт через «Профіль» і повтори дію."
  },
  "invalid_session": {
    "en": "Your session has expired. Sign in again in Profile.",
    "cs": "Platnost přihlášení vypršela. Přihlaste se znovu v Profilu.",
    "ru": "Сессия закончилась. Войди повторно в разделе «Профиль».",
    "uk": "Сеанс завершився. Увійди повторно в розділі «Профіль»."
  },
  "invalid_credentials": {
    "en": "The email or password is incorrect. Check both fields or use Forgot password.",
    "cs": "E-mail nebo heslo není správné. Zkontrolujte údaje nebo použijte Zapomenuté heslo.",
    "ru": "Неверный email или пароль. Проверь данные или нажми «Забыли пароль?».",
    "uk": "Неправильний email або пароль. Перевір дані або натисни «Забули пароль?»."
  },
  "email_already_registered": {
    "en": "This email is already registered. Sign in or reset your password.",
    "cs": "Tento e-mail je již registrovaný. Přihlaste se nebo obnovte heslo.",
    "ru": "Аккаунт с таким email уже существует. Войди или восстанови пароль.",
    "uk": "Акаунт із цією поштою вже існує. Увійди або віднови пароль."
  },
  "email_verification_required": {
    "en": "Verify your email in Profile first. Check your inbox and spam folder for the code.",
    "cs": "Nejprve ověřte e-mail v Profilu. Kód hledejte i ve spamu.",
    "ru": "Сначала подтверди email в профиле. Проверь входящие и папку «Спам».",
    "uk": "Спочатку підтвердь email у профілі. Перевір вхідні та «Спам»."
  },
  "password_confirmation_failed": {
    "en": "The current password is incorrect. Try again or reset it from Profile.",
    "cs": "Současné heslo není správné. Zkuste to znovu nebo ho obnovte v Profilu.",
    "ru": "Текущий пароль неверный. Попробуй снова или восстанови его в профиле.",
    "uk": "Поточний пароль неправильний. Спробуй знову або віднови його в профілі."
  },
  "mfa_enrollment_required": {
    "en": "Set up two-factor authentication in Profile → Account security, then return here.",
    "cs": "Nastavte dvoufaktorové ověření v Profil → Zabezpečení účtu a vraťte se sem.",
    "ru": "Настрой двухфакторную защиту в «Профиль → Безопасность аккаунта» и вернись сюда.",
    "uk": "Налаштуй двофакторний захист у «Профіль → Безпека акаунта» та повернися сюди."
  },
  "mfa_challenge_required": {
    "en": "Verify the six-digit code from your authenticator in Account security, then retry.",
    "cs": "V Zabezpečení účtu zadejte šestimístný kód z ověřovací aplikace a zkuste to znovu.",
    "ru": "Подтверди шестизначный код из приложения-аутентификатора в настройках безопасности.",
    "uk": "Підтвердь шестизначний код із застосунку-автентифікатора в налаштуваннях безпеки."
  },
  "invalid_mfa_code": {
    "en": "The authenticator code is invalid or already used. Wait for a new code and retry.",
    "cs": "Kód z ověřovací aplikace je neplatný nebo již použitý. Počkejte na nový kód.",
    "ru": "Код из аутентификатора неверный или уже использован. Дождись нового кода.",
    "uk": "Код з автентифікатора неправильний або вже використаний. Дочекайся нового коду."
  },
  "privileged_account_required": {
    "en": "Only organizers and administrators can use this feature. Ask an administrator for access.",
    "cs": "Tuto funkci mohou používat jen pořadatelé a správci. Požádejte správce o přístup.",
    "ru": "Функция доступна организаторам и администраторам. Обратись к главному администратору.",
    "uk": "Функція доступна організаторам і адміністраторам. Звернися до головного адміністратора."
  },
  "invalid_or_expired_code": {
    "en": "The verification code is invalid or expired. Request a new code and try again.",
    "cs": "Ověřovací kód je neplatný nebo vypršel. Vyžádejte si nový.",
    "ru": "Код неверный или истёк. Запроси новый код и повтори попытку.",
    "uk": "Код неправильний або протермінований. Запроси новий код."
  },
  "event_full": {
    "en": "All spots are taken. Join the waitlist if it is available.",
    "cs": "Kapacita je naplněna. Pokud je to možné, zapište se na čekací listinu.",
    "ru": "Все места заняты. Если доступен лист ожидания, запишись в него.",
    "uk": "Усі місця зайняті. Якщо доступний список очікування, запишися."
  },
  "event_not_found": {
    "en": "This event is unavailable. Return to the event list and choose another.",
    "cs": "Tato akce není dostupná. Vraťte se na seznam akcí.",
    "ru": "Мероприятие недоступно. Вернись к списку событий.",
    "uk": "Подія недоступна. Повернися до списку подій."
  },
  "event_cancelled": {
    "en": "This event was cancelled. Check the event list for other options.",
    "cs": "Tato akce byla zrušena. Prohlédněte si ostatní akce.",
    "ru": "Мероприятие отменено. Выбери другое в каталоге.",
    "uk": "Подію скасовано. Обери іншу в каталозі."
  },
  "event_already_started": {
    "en": "Registration is closed because the event has already started.",
    "cs": "Registrace již není možná, protože akce začala.",
    "ru": "Регистрация закрыта: мероприятие уже началось.",
    "uk": "Реєстрацію закрито: подія вже розпочалася."
  },
  "already_registered_via_bot": {
    "en": "You already joined through Telegram. Open My tickets to view your registration.",
    "cs": "Již jste se přihlásili přes Telegram. Registraci najdete v Moje vstupenky.",
    "ru": "Ты уже зарегистрирован через Telegram. Открой «Мои билеты».",
    "uk": "Ти вже зареєстрований через Telegram. Відкрий «Мої квитки»."
  },
  "already_registered": {
    "en": "You're already registered. Check My tickets instead of booking again.",
    "cs": "Již jste zaregistrováni. Podívejte se do Moje vstupenky.",
    "ru": "Ты уже зарегистрирован. Проверь «Мои билеты».",
    "uk": "Ти вже зареєстрований. Перевір «Мої квитки»."
  },
  "payment_deadline_expired": {
    "en": "The payment confirmation deadline passed. Return to the event and apply again if spots remain.",
    "cs": "Lhůta pro potvrzení platby vypršela. Pokud jsou místa, podejte novou žádost.",
    "ru": "Срок подтверждения оплаты истёк. Если есть места, подай новую заявку.",
    "uk": "Термін підтвердження оплати минув. Якщо є місця, подай нову заявку."
  },
  "organizer_payment_instructions_missing": {
    "en": "The organizer hasn't added payment details yet. Contact the organizer or try later.",
    "cs": "Pořadatel zatím neuvedl platební údaje. Kontaktujte jej nebo to zkuste později.",
    "ru": "Организатор пока не добавил реквизиты. Свяжись с ним или попробуй позже.",
    "uk": "Організатор ще не додав реквізити. Зв’яжися з ним або спробуй пізніше."
  },
  "support_ticket_closed": {
    "en": "This support request is closed. Create a new request if you still need help.",
    "cs": "Tento požadavek podpory je uzavřen. Pokud potřebujete pomoc, vytvořte nový.",
    "ru": "Обращение закрыто. Если нужна помощь, создай новое.",
    "uk": "Звернення закрито. Якщо потрібна допомога, створи нове."
  },
  "google_link_required": {
    "en": "This email is linked to an existing account. Sign in there and connect Google from Profile.",
    "cs": "Tento e-mail již patří účtu. Přihlaste se a propojte Google v Profilu.",
    "ru": "Этот email уже используется. Войди в существующий аккаунт и привяжи Google в профиле.",
    "uk": "Ця пошта вже використовується. Увійди в наявний акаунт і прив’яжи Google у профілі."
  },
  "telegram_auth_expired": {
    "en": "The Telegram login has expired. Reopen TicketTreat from the Telegram bot.",
    "cs": "Přihlášení přes Telegram vypršelo. Otevřete TicketTreat znovu z bota.",
    "ru": "Вход через Telegram истёк. Открой TicketTreat заново из бота.",
    "uk": "Вхід через Telegram протермінований. Відкрий TicketTreat знову з бота."
  },
  "telegram_link_expired": {
    "en": "The Telegram link expired. Start linking again from your Profile.",
    "cs": "Propojovací odkaz Telegramu vypršel. Začněte znovu v Profilu.",
    "ru": "Ссылка для привязки Telegram истекла. Начни привязку заново в профиле.",
    "uk": "Посилання для прив’язки Telegram протерміноване. Почни знову в профілі."
  },
  "active_waitlist": {
    "en": "You are on an active waitlist. Check its status before trying to register again.",
    "cs": "Jste na aktivní čekací listině. Zkontrolujte stav před dalším pokusem.",
    "ru": "Ты уже в листе ожидания. Проверь его статус перед повторной регистрацией.",
    "uk": "Ти вже у списку очікування. Перевір його стан перед повторною реєстрацією."
  },
  "invalid_event_languages": {
    "en": "Select at least one event language and save again.",
    "cs": "Vyberte alespoň jeden jazyk akce a uložte znovu.",
    "ru": "Выбери хотя бы один язык мероприятия и сохрани снова.",
    "uk": "Обери хоча б одну мову події та збережи знову."
  },
  "event_has_no_start_time": {
    "en": "The organizer hasn't set a start time. Contact them before booking.",
    "cs": "Pořadatel neuvedl začátek akce. Před rezervací jej kontaktujte.",
    "ru": "Организатор не указал время начала. Уточни его перед записью.",
    "uk": "Організатор не вказав час початку. Уточни його перед реєстрацією."
  }
};
const FALLBACK: Record<string,Record<LanguageCode,string>> = {
  "unknown": {
    "en": "Something went wrong. Refresh the page and try again. If it repeats, contact TicketTreat Support.",
    "cs": "Něco se nepovedlo. Obnovte stránku a zkuste to znovu. Pokud se problém opakuje, kontaktujte podporu TicketTreat.",
    "ru": "Не удалось выполнить действие. Обнови страницу и попробуй снова. Если ошибка повторится, обратись в поддержку TicketTreat.",
    "uk": "Не вдалося виконати дію. Онови сторінку та спробуй знову. Якщо помилка повториться, звернися до підтримки TicketTreat."
  },
  "outage": {
    "en": "TicketTreat is temporarily unavailable. This is a technical issue, not a mistake in your details. Please try again later.",
    "cs": "TicketTreat je dočasně nedostupný. Jde o technický problém, nikoli chybu ve vašich údajích. Zkuste to později.",
    "ru": "Сервис TicketTreat временно недоступен. Это технический сбой, дело не в твоих данных. Попробуй позже.",
    "uk": "Сервіс TicketTreat тимчасово недоступний. Це технічний збій, не помилка у твоїх даних. Спробуй пізніше."
  },
  "network": {
    "en": "Couldn't connect. Check your internet connection and retry. If other sites work, TicketTreat may be temporarily unavailable.",
    "cs": "Nelze se připojit. Zkontrolujte internet a zkuste to znovu. Pokud jiné weby fungují, může být TicketTreat dočasně nedostupný.",
    "ru": "Нет соединения. Проверь интернет и попробуй снова. Если другие сайты работают, возможно, недоступен TicketTreat.",
    "uk": "Немає з’єднання. Перевір інтернет і спробуй знову. Якщо інші сайти працюють, можливо, недоступний TicketTreat."
  },
  "rate": {
    "en": "Too many requests. Wait a few minutes before retrying.",
    "cs": "Příliš mnoho požadavků. Před dalším pokusem několik minut počkejte.",
    "ru": "Слишком много попыток. Подожди несколько минут и попробуй снова.",
    "uk": "Забагато спроб. Зачекай кілька хвилин і спробуй знову."
  },
  "validation": {
    "en": "Check the form fields and correct missing or invalid information.",
    "cs": "Zkontrolujte formulář a opravte chybějící nebo neplatné údaje.",
    "ru": "Проверь поля формы и исправь пропущенные или неверные данные.",
    "uk": "Перевір поля форми та виправ пропущені або неправильні дані."
  },
  "forbidden": {
    "en": "You don't have access to this action. Sign in with the correct account or contact an administrator.",
    "cs": "K této akci nemáte přístup. Přihlaste se ke správnému účtu nebo kontaktujte správce.",
    "ru": "У тебя нет доступа к этому действию. Войди в нужный аккаунт или обратись к администратору.",
    "uk": "У тебе немає доступу до цієї дії. Увійди в потрібний акаунт або звернися до адміністратора."
  },
  "conflict": {
    "en": "The information changed while you were working. Refresh the page and try again.",
    "cs": "Údaje se mezitím změnily. Obnovte stránku a zkuste to znovu.",
    "ru": "Данные изменились. Обнови страницу и попробуй снова.",
    "uk": "Дані змінилися. Онови сторінку та спробуй знову."
  },
  "notFound": {
    "en": "This item is no longer available. Return to the previous page and refresh the list.",
    "cs": "Tato položka již není dostupná. Vraťte se a obnovte seznam.",
    "ru": "Элемент больше недоступен. Вернись назад и обнови список.",
    "uk": "Цей елемент більше недоступний. Повернися назад і онови список."
  }
};

/** Accept a code, a fetch Error, or an API Error carrying HTTP status. */
export function userFacingError(error:unknown,language:LanguageCode):string {
  const status=(typeof error==="object"&&error!==null&&"status" in error
    &&typeof error.status==="number")?error.status:undefined;
  const raw=(typeof error==="string"?error:
    error instanceof Error?error.message:"").replace(/^Error:\\s*/i,"").trim();
  const code=raw.split(":")[0].trim().toLowerCase();
  // Known, fixable problems take priority over generic HTTP responses.
  const aliases:Record<string,string>={
    "session_expired":"invalid_session",
    "invalid_current_password":"password_confirmation_failed",
    "payment_setup_missing":"organizer_payment_instructions_missing",
    "login required":"login_required",
    "authentication unavailable":"invalid_session",
  };
  const resolved=aliases[code]||code;
  if (MESSAGES[resolved])return MESSAGES[resolved][language];
  if (code==="email_provider_unavailable"||code==="google_not_configured"||
      code==="telegram_auth_not_configured"||code==="service_unavailable"||
      code==="backend_service_auth_not_configured") return FALLBACK.outage[language];
  if (/failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(raw))
    return FALLBACK.network[language];
  if (status===429)return FALLBACK.rate[language];
  if (status===401)return MESSAGES.invalid_session[language];
  if (status===403)return FALLBACK.forbidden[language];
  if (status===404)return FALLBACK.notFound[language];
  if (status===409)return FALLBACK.conflict[language];
  if (status===400||status===422)return FALLBACK.validation[language];
  if ((status!==undefined&&status>=500) || /^API 5\\d\\d$/i.test(raw))
    return FALLBACK.outage[language];
  return FALLBACK.unknown[language];
}
