import type {LanguageCode} from "@/lib/types";
import {adminTranslate} from "@/lib/admin-i18n";

/** UI-only translations for the event management workflow.
 * Event titles, user messages and organizer-authored content are never translated.
 * First column is the canonical legacy Russian label used at call sites.
 */
const messages: Array<[string,string,string,string]> = [
  [
    "Сначала войди в профиль.",
    "Sign in to your profile first.",
    "Nejprve se přihlas ke svému profilu.",
    "Спочатку увійди у свій профіль."
  ],
  [
    "Постер больше 4 МБ",
    "Poster exceeds 4 MB.",
    "Plakát přesahuje 4 MB.",
    "Афіша перевищує 4 МБ."
  ],
  [
    "Формат постера — JPG, PNG или WebP.",
    "Poster format must be JPG, PNG or WebP.",
    "Plakát musí být ve formátu JPG, PNG nebo WebP.",
    "Формат афіші має бути JPG, PNG або WebP."
  ],
  [
    "Выбери язык.",
    "Select at least one language.",
    "Vyber alespoň jeden jazyk.",
    "Обери принаймні одну мову."
  ],
  [
    "Изменения сохранены.",
    "Changes saved.",
    "Změny uloženy.",
    "Зміни збережено."
  ],
  [
    "Сессия завершилась. Войди в профиль и повтори попытку.",
    "Session expired. Sign in again.",
    "Relace vypršela. Přihlas se znovu.",
    "Сеанс завершився. Увійди знову."
  ],
  [
    "Причина отмены должна содержать не менее 8 символов.",
    "Cancellation reason must have at least 8 characters.",
    "Důvod zrušení musí mít alespoň 8 znaků.",
    "Причина скасування має містити щонайменше 8 символів."
  ],
  [
    "Окончательно отменить мероприятие? Регистрация закроется, активные билеты будут аннулированы. Уведомления подтверждённым участникам будут поставлены в очередь.",
    "Cancel this event permanently? Registration will close, active tickets will be invalidated, and confirmed attendees will be notified.",
    "Opravdu zrušit tuto akci? Registrace se uzavře, platné vstupenky budou zneplatněny a potvrzeným účastníkům odejde oznámení.",
    "Остаточно скасувати подію? Реєстрацію буде закрито, активні квитки анульовано, а підтверджені учасники отримають сповіщення."
  ],
  [
    "Мероприятие отменено. Регистрация закрыта, причина сохранена.",
    "Event cancelled. Registration closed and reason saved.",
    "Akce byla zrušena. Registrace je uzavřena a důvod uložen.",
    "Подію скасовано. Реєстрацію закрито, причину збережено."
  ],
  [
    "Мероприятие отменено, но не удалось обновить страницу: ",
    "Event cancelled, but the page could not refresh: ",
    "Akce byla zrušena, ale stránku nelze obnovit: ",
    "Подію скасовано, але не вдалося оновити сторінку: "
  ],
  [
    "Владелец ивента обновлён.",
    "Event owner updated.",
    "Pořadatel akce byl změněn.",
    "Власника події змінено."
  ],
  [
    "Подтверди только после фактического получения денег организатором. Выдать билет?",
    "Confirm only after the organizer has received the payment. Issue the ticket?",
    "Potvrď až po skutečném přijetí platby pořadatelem. Vystavit vstupenku?",
    "Підтверджуй лише після фактичного отримання оплати організатором. Видати квиток?"
  ],
  [
    "Отклонить заявку? Резерв места будет освобождён.",
    "Decline the request? The reserved spot will be released.",
    "Zamítnout žádost? Rezervované místo se uvolní.",
    "Відхилити заявку? Заброньоване місце звільниться."
  ],
  [
    "Оплата подтверждена, QR-билет выдан.",
    "Payment confirmed; QR ticket issued.",
    "Platba potvrzena; QR vstupenka vystavena.",
    "Оплату підтверджено, QR-квиток видано."
  ],
  [
    "Заявка отклонена, место освобождено.",
    "Request declined; spot released.",
    "Žádost zamítnuta; místo uvolněno.",
    "Заявку відхилено, місце звільнено."
  ],
  [
    "Не более 8 фотографий на мероприятие.",
    "Maximum 8 photos per event.",
    "Na akci lze přidat nejvýše 8 fotografií.",
    "Не більше ніж 8 фотографій на подію."
  ],
  [
    "Фотография должна быть меньше 2 МБ.",
    "Photo must be under 2 MB.",
    "Fotografie musí být menší než 2 MB.",
    "Фото має бути меншим за 2 МБ."
  ],
  [
    "Нужны JPG, PNG или WebP.",
    "Use JPG, PNG or WebP.",
    "Použij JPG, PNG nebo WebP.",
    "Потрібен формат JPG, PNG або WebP."
  ],
  [
    "Фотографии добавлены.",
    "Photos added.",
    "Fotografie byly přidány.",
    "Фотографії додано."
  ],
  [
    "Удалить фотографию из галереи?",
    "Remove this photo from the gallery?",
    "Odebrat tuto fotografii z galerie?",
    "Видалити фотографію з галереї?"
  ],
  [
    "Фотография удалена.",
    "Photo removed.",
    "Fotografie byla odebrána.",
    "Фотографію видалено."
  ],
  [
    "Отметить участника как прошедшего без сканирования QR? Действие попадёт в журнал.",
    "Check in this attendee without scanning the QR? This action will be logged.",
    "Odbavit účastníka bez skenování QR? Akce se zaznamená do protokolu.",
    "Відмітити учасника без сканування QR? Дію буде записано в журнал."
  ],
  [
    "Этот билет уже отмечен.",
    "This ticket is already checked in.",
    "Tato vstupenka již byla odbavena.",
    "Цей квиток уже відмічено."
  ],
  [
    "Участник отмечен на входе.",
    "Attendee checked in.",
    "Účastník byl odbaven.",
    "Учасника відмічено на вході."
  ],
  [
    "Отправить важное сообщение всем подтверждённым владельцам действующих билетов?",
    "Send an important update to all confirmed holders of valid tickets?",
    "Poslat důležité oznámení všem potvrzeným držitelům platných vstupenek?",
    "Надіслати важливе повідомлення всім підтвердженим власникам дійсних квитків?"
  ],
  [
    "Укажи расписание и текст напоминания.",
    "Set the reminder schedule and message.",
    "Zadej rozvrh a text připomínky.",
    "Укажи розклад і текст нагадування."
  ],
  [
    "Расписание напоминаний и текст организатора сохранены.",
    "Reminder schedule and organizer message saved.",
    "Rozvrh připomínek a zpráva pořadatele byly uloženy.",
    "Розклад нагадувань і повідомлення організатора збережено."
  ],
  [
    "Доступ к сканированию билетов предоставлен.",
    "Ticket scanning access granted.",
    "Přístup ke skenování vstupenek byl udělen.",
    "Доступ до сканування квитків надано."
  ],
  [
    "Отозвать доступ к сканированию?",
    "Revoke ticket scanning access?",
    "Odebrat přístup ke skenování vstupenek?",
    "Відкликати доступ до сканування квитків?"
  ],
  [
    "Доступ отозван.",
    "Access revoked.",
    "Přístup byl odebrán.",
    "Доступ відкликано."
  ],
  [
    "Галерея обновлена.",
    "Gallery updated.",
    "Galerie byla aktualizována.",
    "Галерею оновлено."
  ],
  [
    "Открыть мероприятие для всех и разрешить бесплатную регистрацию?",
    "Publish this event and allow free registration?",
    "Zveřejnit akci a povolit bezplatnou registraci?",
    "Опублікувати подію та дозволити безкоштовну реєстрацію?"
  ],
  [
    "Снять мероприятие с публикации? Это возможно только без участников.",
    "Unpublish this event? It must have no attendees.",
    "Zrušit zveřejnění akce? Akce nesmí mít žádné účastníky.",
    "Зняти подію з публікації? Це можливо лише без учасників."
  ],
  [
    "Мероприятие опубликовано.",
    "Event published.",
    "Akce byla zveřejněna.",
    "Подію опубліковано."
  ],
  [
    "Публикация запланирована.",
    "Publication scheduled.",
    "Zveřejnění bylo naplánováno.",
    "Публікацію заплановано."
  ],
  [
    "Мероприятие сохранено как черновик.",
    "Event saved as draft.",
    "Akce byla uložena jako koncept.",
    "Подію збережено як чернетку."
  ],
  [
    "Создать закрытую копию этого ивента без участников и билетов?",
    "Create a private copy of this event without attendees or tickets?",
    "Vytvořit neveřejnou kopii akce bez účastníků a vstupenek?",
    "Створити приватну копію цієї події без учасників і квитків?"
  ],
  [
    "Публичная ссылка скопирована.",
    "Public link copied.",
    "Veřejný odkaz zkopírován.",
    "Публічне посилання скопійовано."
  ],
  [
    "Не удалось скопировать ссылку. Открой публичную страницу.",
    "Could not copy the link. Open the public page.",
    "Odkaz nelze zkopírovat. Otevři veřejnou stránku.",
    "Не вдалося скопіювати посилання. Відкрий публічну сторінку."
  ],
  [
    "Check-in выполнен.",
    "Check-in complete.",
    "Odbavení proběhlo.",
    "Відмітку про вхід зроблено."
  ],
  [
    "Загрузка…",
    "Loading…",
    "Načítání…",
    "Завантаження…"
  ],
  [
    "Причина отмены:",
    "Cancellation reason:",
    "Důvod zrušení:",
    "Причина скасування:"
  ],
  [
    "Статус:",
    "Status:",
    "Stav:",
    "Статус:"
  ],
  [
    "Новые ивенты скрыты до публикации. Для платных ивентов укажи инструкцию прямой оплаты организатору; подтверждение оплаченных заявок доступно ниже.",
    "New events remain hidden until published. For paid events, provide direct payment instructions; confirm payments below.",
    "Nové akce jsou skryté až do zveřejnění. U placených akcí zadej pokyny k přímé platbě; platby potvrď níže.",
    "Нові події приховані до публікації. Для платних подій вкажи інструкції прямої оплати; підтвердити оплату можна нижче."
  ],
  [
    "Автопубликация:",
    "Automatic publication:",
    "Automatické zveřejnění:",
    "Автопублікація:"
  ],
  [
    "Дата и время",
    "Date and time",
    "Datum a čas",
    "Дата й час"
  ],
  [
    "Инструкция по оплате организатору (обязательно для платных мероприятий)",
    "Organizer payment instructions (required for paid events)",
    "Pokyny k platbě pořadateli (povinné u placených akcí)",
    "Інструкція з оплати організатору (обов’язково для платних подій)"
  ],
  [
    "Способ и реквизиты прямого платежа, контакт организатора; TicketTreat платежи не принимает.",
    "Direct payment details and organizer contact; TicketTreat does not process payments.",
    "Údaje k přímé platbě a kontakt na pořadatele; TicketTreat platby nezpracovává.",
    "Дані для прямої оплати та контакт організатора; TicketTreat не приймає платежів."
  ],
  [
    "Сохраняем…",
    "Saving…",
    "Ukládání…",
    "Зберігаємо…"
  ],
  [
    "Загружай фотографии с прошлых мероприятий (JPG, PNG, WebP; до 2 МБ каждая, максимум 8 включая HTTPS-ссылки). Файлы сохраняются на сервере TicketTreat.",
    "Upload photos from previous events (JPG, PNG or WebP; max. 2 MB each and 8 including HTTPS links). Files are stored on TicketTreat.",
    "Nahraj fotografie z minulých akcí (JPG, PNG či WebP; do 2 MB, maximálně 8 včetně odkazů HTTPS). Soubory se ukládají na TicketTreat.",
    "Завантажуй фото з минулих подій (JPG, PNG або WebP; до 2 МБ, максимум 8 разом із HTTPS-посиланнями). Файли зберігаються на TicketTreat."
  ],
  [
    "Добавить фотографии",
    "Add photos",
    "Přidat fotografie",
    "Додати фотографії"
  ],
  [
    "Фотография мероприятия",
    "Event photo",
    "Fotografie akce",
    "Фотографія події"
  ],
  [
    "Переместить фото назад",
    "Move photo backward",
    "Posunout fotografii zpět",
    "Перемістити фото назад"
  ],
  [
    "Переместить фото вперёд",
    "Move photo forward",
    "Posunout fotografii vpřed",
    "Перемістити фото вперед"
  ],
  [
    "✓ Обложка",
    "✓ Cover",
    "✓ Titulní",
    "✓ Обкладинка"
  ],
  [
    "Сделать обложкой",
    "Set as cover",
    "Nastavit jako titulní",
    "Зробити обкладинкою"
  ],
  [
    "Ты собираешься отменить",
    "You are about to cancel",
    "Chystáš se zrušit",
    "Ти збираєшся скасувати"
  ],
  [
    "Новые регистрации закроются, действующие билеты будут аннулированы, а уведомления подтверждённым владельцам билетов будут поставлены в очередь.",
    "New registrations will close, valid tickets will be cancelled, and confirmed ticket holders will be notified.",
    "Nové registrace se uzavřou, vstupenky se zneplatní a potvrzení držitelé budou informováni.",
    "Нові реєстрації закриються, дійсні квитки буде анульовано, а підтверджені власники отримають сповіщення."
  ],
  [
    "Это действие нельзя отменить через панель организатора.",
    "You cannot undo this action in the organizer dashboard.",
    "Tuto akci nelze ve správě pořadatele vrátit zpět.",
    "Цю дію не можна скасувати в панелі організатора."
  ],
  [
    "(обязательно, минимум 8 символов)",
    "(required, at least 8 characters)",
    "(povinné, alespoň 8 znaků)",
    "(обов’язково, щонайменше 8 символів)"
  ],
  [
    "Например: Организатор вынужден отменить мероприятие из-за…",
    "For example: The organizer must cancel the event because…",
    "Například: Pořadatel musí akci zrušit kvůli…",
    "Наприклад: Організатор змушений скасувати подію через…"
  ],
  [
    "символов",
    "characters",
    "znaků",
    "символів"
  ],
  [
    "Отменяем мероприятие…",
    "Cancelling event…",
    "Rušení akce…",
    "Скасовуємо подію…"
  ],
  [
    "Итоговый no-show",
    "Final no-show count",
    "Konečný počet nepříchozích",
    "Підсумкова кількість неявок"
  ],
  [
    "No-show после окончания",
    "No-shows after event ends",
    "Nepříchozí po skončení akce",
    "Неявки після завершення події"
  ],
  [
    "Пока нет данных по источникам.",
    "No source data yet.",
    "Zatím nejsou údaje o zdrojích.",
    "Поки немає даних про джерела."
  ],
  [
    "Старые записи Telegram учитываются во вместимости, но не во всех QR-метриках.",
    "Legacy Telegram registrations count toward occupancy, but not every QR metric.",
    "Starší registrace z Telegramu se počítají do obsazenosti, ale ne do všech QR metrik.",
    "Старі реєстрації Telegram враховуються в заповненості, але не в усіх QR-показниках."
  ],
  [
    "Закрыть регистрацию за N минут до начала (0 — до старта)",
    "Close registration N minutes before start (0 = until start)",
    "Uzavřít registraci N minut před začátkem (0 = až do začátku)",
    "Закрити реєстрацію за N хвилин до початку (0 = до старту)"
  ],
  [
    "Продолжительность ивента (минуты для окончательной статистики no-show)",
    "Event duration (minutes, for final no-show metrics)",
    "Délka akce (minuty, pro konečné statistiky nepříchozích)",
    "Тривалість події (хвилини, для підсумкової статистики неявок)"
  ],
  [
    "Предложение места из waitlist",
    "Waitlist spot offers",
    "Nabídky míst z čekací listiny",
    "Пропозиції місць зі списку очікування"
  ],
  [
    "Автоматически выдавать билет (совместимый режим)",
    "Issue ticket automatically (compatibility mode)",
    "Automaticky vystavit vstupenku (režim kompatibility)",
    "Автоматично видавати квиток (режим сумісності)"
  ],
  [
    "Предложение на 15 минут",
    "15-minute offer",
    "Nabídka na 15 minut",
    "Пропозиція на 15 хвилин"
  ],
  [
    "Предложение на 30 минут",
    "30-minute offer",
    "Nabídka na 30 minut",
    "Пропозиція на 30 хвилин"
  ],
  [
    "Предложение на 1 час",
    "1-hour offer",
    "Nabídka na 1 hodinu",
    "Пропозиція на 1 годину"
  ],
  [
    "Предложение на 2 часа",
    "2-hour offer",
    "Nabídka na 2 hodiny",
    "Пропозиція на 2 години"
  ],
  [
    "Предложение на сутки",
    "24-hour offer",
    "Nabídka na 24 hodin",
    "Пропозиція на добу"
  ],
  [
    "В режиме предложения место удерживается для следующего участника до принятия или истечения срока. Требуется включённый воркер истечения сроков в Railway.",
    "An offered spot is reserved until accepted or expired. The Railway expiry worker must be running.",
    "Nabídnuté místo se drží do přijetí nebo vypršení nabídky. Na Railway musí běžet úloha pro vypršení.",
    "Запропоноване місце утримується до прийняття або завершення терміну. У Railway має працювати фоновий процес завершення резервувань."
  ],
  [
    "Письма отправляются только подтверждённым владельцам билетов, после включения Resend. Пропущенные интервалы не рассылаются задним числом.",
    "Emails go only to confirmed ticket holders after Resend is enabled. Missed reminders are not sent retroactively.",
    "Po zapnutí Resend se e-maily posílají jen potvrzeným držitelům vstupenek. Zmeškané připomínky se zpětně neposílají.",
    "Листи надсилаються лише підтвердженим власникам квитків після ввімкнення Resend. Пропущені нагадування не надсилаються заднім числом."
  ],
  [
    "Можно назначить подтверждённый TicketTreat-аккаунт только на QR check-in этого мероприятия. Управление ивентом и экспорт участников остаются закрыты.",
    "Grant a verified TicketTreat account QR check-in access only for this event. Event management and attendee exports stay restricted.",
    "Ověřenému účtu TicketTreat lze dát přístup pouze k odbavení QR na této akci. Správa akce i export účastníků zůstávají omezené.",
    "Можна надати підтвердженому акаунту TicketTreat доступ лише до QR-перевірки цієї події. Керування подією та експорт учасників залишаються обмеженими."
  ],
  [
    "Аккаунт #",
    "Account #",
    "Účet č. ",
    "Акаунт №"
  ],
  [
    "📢 Рассылка участникам этого ивента →",
    "📢 Message event attendees →",
    "📢 Zprávy účastníkům této akce →",
    "📢 Повідомлення учасникам цієї події →"
  ],
  [
    "С подтверждённым email и действующим билетом:",
    "With verified email and valid ticket:",
    "S ověřeným e-mailem a platnou vstupenkou:",
    "З підтвердженою поштою та дійсним квитком:"
  ],
  [
    "Отправка подключена. Зарегистрированные пользователи получают письма с билетами, напоминаниями и важными изменениями.",
    "Email delivery is enabled. Registered guests receive ticket, reminder and important update emails.",
    "Odesílání e-mailů je zapnuté. Registrovaní dostávají vstupenky, připomínky a důležité změny.",
    "Надсилання пошти ввімкнено. Зареєстровані користувачі отримують квитки, нагадування й важливі зміни."
  ],
  [
    "Отправка отключена до подтверждения домена и настройки Resend. Новые письма пока не отправляются.",
    "Email delivery is disabled until the domain and Resend are configured.",
    "Odesílání e-mailů je vypnuté, dokud nebude ověřena doména a nastaven Resend.",
    "Надсилання пошти вимкнено до підтвердження домену та налаштування Resend."
  ],
  [
    "Статус служебных уведомлений",
    "Notification delivery status",
    "Stav doručování oznámení",
    "Стан доставки сповіщень"
  ],
  [
    "Доставлено провайдеру:",
    "Accepted by provider:",
    "Přijato poskytovatelem:",
    "Прийнято провайдером:"
  ],
  [
    "В очереди:",
    "Queued:",
    "Ve frontě:",
    "У черзі:"
  ],
  [
    "Ошибок:",
    "Errors:",
    "Chyb:",
    "Помилок:"
  ],
  [
    "Зарегистрированных получателей:",
    "Registered recipients:",
    "Registrovaných příjemců:",
    "Зареєстрованих отримувачів:"
  ],
  [
    "Отправлено:",
    "Sent:",
    "Odesláno:",
    "Надіслано:"
  ],
  [
    "Канал подключён. Напоминания отправляются по расписанию.",
    "Channel connected. Reminders follow the schedule.",
    "Kanál je připojen. Připomínky se odesílají podle rozvrhu.",
    "Канал підключено. Нагадування надсилаються за розкладом."
  ],
  [
    "Канал сейчас не настроен.",
    "The channel is not configured.",
    "Kanál není nastaven.",
    "Канал наразі не налаштовано."
  ],
  [
    "В Telegram бот может написать только тем, кто ранее открыл чат с TicketTreat. Подтверждения входа и пароли по этому каналу не отправляются.",
    "The Telegram bot can only message people who already started it. Login codes and passwords are never sent here.",
    "Bot na Telegramu může psát jen lidem, kteří s ním již začali chat. Přihlašovací kódy ani hesla se takto neposílají.",
    "Telegram-бот може писати лише користувачам, які раніше відкрили чат. Коди входу та паролі тут не надсилаються."
  ],
  [
    "Как добраться / организационная информация",
    "Directions / logistics information",
    "Doprava / organizační informace",
    "Як дістатися / організаційна інформація"
  ],
  [
    "Текст для подтверждённых участников",
    "Message for confirmed attendees",
    "Zpráva pro potvrzené účastníky",
    "Повідомлення для підтверджених учасників"
  ],
  [
    "Например: Вход с боковой стороны здания. Покажите QR-билет на входе.",
    "For example: Use the side entrance. Show your QR ticket at the door.",
    "Například: Použijte boční vchod. U vstupu ukažte QR vstupenku.",
    "Наприклад: Скористайтеся бічним входом. Покажіть QR-квиток на вході."
  ],
  [
    "Не более двух сообщений в сутки на ивент. Только действующие подтверждённые билеты, не маркетинговая рассылка.",
    "Maximum two updates per event per day. Valid confirmed tickets only; no marketing.",
    "Nejvýše dvě zprávy na akci za den. Jen držitelům platných potvrzených vstupenek, bez marketingu.",
    "Не більше двох повідомлень на подію за добу. Лише власникам дійсних підтверджених квитків, без реклами."
  ],
  [
    "Список адресов участников доступен через Export CSV. Рекламные массовые письма не отправляются без отдельного согласия.",
    "Attendee email addresses are available in Export CSV. Marketing emails require separate consent.",
    "E-mailové adresy účastníků lze exportovat do CSV. Marketingové zprávy vyžadují samostatný souhlas.",
    "Адреси учасників доступні через експорт CSV. Рекламні листи потребують окремої згоди."
  ],
  [
    "Глобальная модерация",
    "Global moderation",
    "Globální moderace",
    "Глобальна модерація"
  ],
  [
    "Владелец ивента:",
    "Event owner:",
    "Vlastník akce:",
    "Власник події:"
  ],
  [
    "не назначен",
    "unassigned",
    "nepřiřazeno",
    "не призначено"
  ],
  [
    "Выбери организатора",
    "Select organizer",
    "Vyber pořadatele",
    "Обери організатора"
  ],
  [
    "Назначить организатора",
    "Assign organizer",
    "Přiřadit pořadatele",
    "Призначити організатора"
  ],
  [
    "Сохранить владельца",
    "Save owner",
    "Uložit vlastníka",
    "Зберегти власника"
  ],
  [
    "История модерации",
    "Moderation history",
    "Historie moderace",
    "Історія модерації"
  ],
  [
    "Нет действий",
    "No actions yet",
    "Zatím žádné akce",
    "Дій ще немає"
  ],
  [
    "Заявки на платное мероприятие — подтверждение в течение 24 часов",
    "Paid event requests — confirm within 24 hours",
    "Žádosti o placenou akci — potvrdit do 24 hodin",
    "Заявки на платну подію — підтвердження протягом 24 годин"
  ],
  [
    "Деньги поступают напрямую организатору. Подтверждай заявку только после проверки фактического поступления. До подтверждения QR-билет не выдаётся. Не подтверждённые заявки автоматически истекают через 24 часа.",
    "Payments go directly to the organizer. Confirm only once received. QR tickets are issued only after confirmation. Unconfirmed requests expire after 24 hours.",
    "Platby jdou přímo pořadateli. Potvrď je až po přijetí. QR vstupenka se vydá až po potvrzení. Nepotvrzené žádosti vyprší po 24 hodinách.",
    "Кошти надходять безпосередньо організатору. Підтверджуй лише після отримання. QR-квиток видається після підтвердження. Непідтверджені заявки спливають через 24 години."
  ],
  [
    "Заявок пока нет.",
    "No requests yet.",
    "Zatím žádné žádosti.",
    "Заявок ще немає."
  ],
  [
    "Участник",
    "Attendee",
    "Účastník",
    "Учасник"
  ],
  [
    "Заявка #",
    "Request #",
    "Žádost č. ",
    "Заявка №"
  ],
  [
    "Ожидает оплаты",
    "Awaiting payment",
    "Čeká na platbu",
    "Очікує оплати"
  ],
  [
    "Подтверждено",
    "Confirmed",
    "Potvrzeno",
    "Підтверджено"
  ],
  [
    "Истекло",
    "Expired",
    "Vypršelo",
    "Спливло"
  ],
  [
    "Отклонено",
    "Declined",
    "Zamítnuto",
    "Відхилено"
  ],
  [
    "Крайний срок: ",
    "Deadline: ",
    "Termín: ",
    "Кінцевий термін: "
  ],
  [
    "Дата истечения: ",
    "Expired on: ",
    "Datum vypršení: ",
    "Дата завершення: "
  ],
  [
    "Подтвердить оплату",
    "Confirm payment",
    "Potvrdit platbu",
    "Підтвердити оплату"
  ],
  [
    "Отклонить",
    "Decline",
    "Zamítnout",
    "Відхилити"
  ],
  [
    "Билеты",
    "Tickets",
    "Vstupenky",
    "Квитки"
  ],
  [
    "Участники",
    "Attendees",
    "Účastníci",
    "Учасники"
  ],
  [
    "Пока нет билетов.",
    "No tickets yet.",
    "Zatím žádné vstupenky.",
    "Квитків ще немає."
  ],
  [
    "Отметить вручную",
    "Check in manually",
    "Ručně odbavit",
    "Відмітити вручну"
  ],
  [
    "Лист ожидания",
    "Waitlist",
    "Čekací listina",
    "Список очікування"
  ],
  [
    "Пока пусто.",
    "Nothing here yet.",
    "Zatím prázdné.",
    "Поки порожньо."
  ],
  [
    "Checked in",
    "Checked in",
    "Odbaveno",
    "Відмічено"
  ],
  [
    "Waitlist",
    "Waitlist",
    "Čekací listina",
    "Список очікування"
  ],
  [
    "Cancelled",
    "Cancelled",
    "Zrušeno",
    "Скасовано"
  ],
  [
    "Paid",
    "Paid",
    "Zaplaceno",
    "Оплачено"
  ],
  [
    "Waiting",
    "Waiting",
    "Čeká",
    "Очікує"
  ],
  [
    "Awaiting QR scan",
    "Awaiting QR scan",
    "Čeká na skenování QR",
    "Очікується QR-сканування"
  ],
  [
    "Scan QR",
    "Scan QR",
    "Skenovat QR",
    "Сканувати QR"
  ],
  [
    "↓ Export CSV",
    "↓ Export CSV",
    "↓ Export CSV",
    "↓ Експорт CSV"
  ],
  [
    "Черновик",
    "Draft",
    "Koncept",
    "Чернетка"
  ],
  [
    "Запланировано",
    "Scheduled",
    "Naplánováno",
    "Заплановано"
  ],
  [
    "Опубликовано",
    "Published",
    "Zveřejněno",
    "Опубліковано"
  ],
  [
    "Сохранить правила и напоминания",
    "Save rules and reminders",
    "Uložit pravidla a připomínky",
    "Зберегти правила й нагадування"
  ],
  [
    "Закрыть",
    "Close",
    "Zavřít",
    "Закрити"
  ],
  [
    "Редактировать ивент",
    "Edit event",
    "Upravit akci",
    "Редагувати подію"
  ],
  [
    "Отмена ивента",
    "Cancel event",
    "Zrušení akce",
    "Скасування події"
  ],
  [
    "В очереди: ",
    "Queued: ",
    "Ve frontě: ",
    "У черзі: "
  ],
  [
    "доставок через email и/или Telegram.",
    "deliveries via email and/or Telegram.",
    "doručení e-mailem a/nebo Telegramem.",
    "доставок через email і/або Telegram."
  ],
  [
    "Войдите в аккаунт администратора.",
    "Sign in to your administrator account.",
    "Přihlas se ke svému účtu správce.",
    "Увійди до акаунта адміністратора."
  ],
  [
    "Доступ только для глобального администратора.",
    "Global administrator access required.",
    "Přístup pouze pro hlavního administrátora.",
    "Доступ лише для головного адміністратора."
  ],
  [
    "Максимум 4 МБ.",
    "Maximum file size is 4 MB.",
    "Maximální velikost je 4 MB.",
    "Максимальний розмір — 4 МБ."
  ],
  [
    "Выберите JPG, PNG или WebP.",
    "Select a JPG, PNG or WebP file.",
    "Vyber soubor JPG, PNG nebo WebP.",
    "Обери файл JPG, PNG або WebP."
  ],
  [
    "Ошибка чтения файла",
    "Could not read the file.",
    "Soubor se nepodařilo načíst.",
    "Не вдалося прочитати файл."
  ],
  [
    "Содержимое сайта обновлено.",
    "Website content updated.",
    "Obsah webu byl aktualizován.",
    "Контент сайту оновлено."
  ],
  [
    "Баннер сайта",
    "Website banner",
    "Banner webu",
    "Банер сайту"
  ],
  [
    "Удалить изображение баннера",
    "Remove banner image",
    "Odstranit obrázek banneru",
    "Видалити зображення банера"
  ],
  [
    "Сохранение…",
    "Saving…",
    "Ukládání…",
    "Збереження…"
  ],
  [
    "Войдите в подтверждённый аккаунт с доступом к check-in.",
    "Sign in with a verified account authorized to check in tickets.",
    "Přihlas se ověřeným účtem s právem odbavovat vstupenky.",
    "Увійди до підтвердженого акаунта з доступом до перевірки квитків."
  ],
  [
    "Билет уже использован! Повторный проход запрещён.",
    "Ticket already used! Re-entry is not allowed.",
    "Vstupenka už byla použita! Opakovaný vstup není povolen.",
    "Квиток уже використано! Повторний вхід заборонено."
  ],
  [
    "Check-in successful",
    "Check-in successful.",
    "Vstup úspěšně potvrzen.",
    "Вхід успішно підтверджено."
  ],
  [
    "Check-in failed",
    "Check-in failed.",
    "Ověření vstupenky selhalo.",
    "Не вдалося підтвердити вхід."
  ],
  [
    "Camera unavailable. You can paste the QR token manually.",
    "Camera unavailable. Enter the QR token manually.",
    "Kamera není dostupná. Zadej QR kód ručně.",
    "Камера недоступна. Введи QR-токен вручну."
  ],
  [
    "Сканер билетов",
    "Ticket scanner",
    "Skener vstupenek",
    "Сканер квитків"
  ],
  [
    "📷 Камера сканирует QR-код",
    "📷 Camera scanning QR code",
    "📷 Kamera skenuje QR kód",
    "📷 Камера сканує QR-код"
  ],
  [
    "Камера недоступна — используй ручной ввод",
    "Camera unavailable — enter code manually",
    "Kamera není dostupná — použij ruční zadání",
    "Камера недоступна — введи код вручну"
  ],
  [
    "Подключение камеры…",
    "Connecting camera…",
    "Připojování kamery…",
    "Підключення камери…"
  ],
  [
    "QR-код билета — ручной ввод",
    "Ticket QR code — manual entry",
    "QR kód vstupenky — ruční zadání",
    "QR-код квитка — ручне введення"
  ],
  [
    "Вставь токен из QR-кода",
    "Paste QR token",
    "Vlož token z QR kódu",
    "Встав токен із QR-коду"
  ],
  [
    "Камера активна",
    "Camera active",
    "Kamera je aktivní",
    "Камера активна"
  ],
  [
    "↻ Перезапустить камеру",
    "↻ Restart camera",
    "↻ Restartovat kameru",
    "↻ Перезапустити камеру"
  ],
  [
    "Free",
    "Free",
    "Zdarma",
    "Безкоштовно"
  ],
  [
    "Оплата не требуется",
    "Payment not required",
    "Platba není vyžadována",
    "Оплата не потрібна"
  ],
  [
    "Этот аккаунт зарегистрирован как участник. Для создания ивентов нужен аккаунт организатора.",
    "This is a participant account. An organizer account is required to create events.",
    "Toto je účet účastníka. Pro vytváření akcí potřebuješ účet pořadatele.",
    "Це акаунт учасника. Для створення подій потрібен акаунт організатора."
  ],
  [
    "Не удалось прочитать постер.",
    "Could not read the poster.",
    "Plakát se nepodařilo načíst.",
    "Не вдалося прочитати афішу."
  ],
  [
    "Максимальный размер постера — 4 МБ.",
    "Maximum poster size is 4 MB.",
    "Maximální velikost plakátu je 4 MB.",
    "Максимальний розмір афіші — 4 МБ."
  ],
  [
    "Только PNG, JPEG или WebP.",
    "Only PNG, JPEG or WebP files are supported.",
    "Podporovány jsou pouze soubory PNG, JPEG nebo WebP.",
    "Підтримуються лише PNG, JPEG або WebP."
  ],
  [
    "Выбери хотя бы один язык.",
    "Select at least one language.",
    "Vyber alespoň jeden jazyk.",
    "Обери хоча б одну мову."
  ],
  [
    "Введи дату и время.",
    "Enter a date and time.",
    "Zadej datum a čas.",
    "Укажи дату й час."
  ],
  [
    "Укажи время и текст напоминания.",
    "Set the reminder time and message.",
    "Zadej čas a text připomínky.",
    "Укажи час і текст нагадування."
  ],
  [
    "Главный администратор",
    "Global administrator",
    "Hlavní administrátor",
    "Головний адміністратор"
  ],
  [
    "Фильтрация мероприятий",
    "Event filters",
    "Filtry akcí",
    "Фільтри подій"
  ],
  [
    "Your TicketTreat event starts soon.",
    "Your TicketTreat event starts soon.",
    "Akce TicketTreat brzy začíná.",
    "Подія TicketTreat незабаром почнеться."
  ],
  [
    "Sign in first.",
    "Sign in first.",
    "Nejprve se přihlas.",
    "Спочатку увійди."
  ],
  [
    "Eligible account data has been erased and the action audited.",
    "Eligible account data has been erased and the action audited.",
    "Údaje účtu byly vymazány a operace byla zaznamenána.",
    "Дані відповідного акаунта видалено, дію зареєстровано."
  ],
  [
    "Global-admin MFA is required. Never fulfill a request without checking legal obligations, user ownership and backup retention. Conflicting records will block automatic fulfillment.",
    "Global administrator MFA is required. Verify legal obligations, account ownership and backup retention before erasure. Conflicts prevent automatic deletion.",
    "Je vyžadováno MFA hlavního administrátora. Před výmazem ověř právní povinnosti, vlastnictví účtu a uchovávání záloh. Konflikty automatický výmaz zablokují.",
    "Потрібна MFA головного адміністратора. Перед видаленням перевір юридичні вимоги, власника акаунта та зберігання резервних копій. Конфлікти заблокують автоматичне видалення."
  ],
  [
    "Request #",
    "Request #",
    "Žádost č. ",
    "Запит №"
  ],
  [
    "Account #",
    "Account #",
    "Účet č. ",
    "Акаунт №"
  ],
  [
    "Review this request",
    "Review request",
    "Zkontrolovat žádost",
    "Переглянути запит"
  ],
  [
    "Review request #",
    "Review request #",
    "Kontrola žádosti č. ",
    "Перегляд запиту №"
  ],
  [
    "Permanent operation. If linked Telegram registrations, future events or retained financial records exist, the API refuses deletion for manual review.",
    "Permanent operation. Linked Telegram registrations, upcoming events or retained financial records will block automatic erasure for manual review.",
    "Nevratná operace. Propojené registrace Telegramu, budoucí akce nebo uchovávané finanční údaje mohou automatický výmaz zablokovat a vyžadovat ruční kontrolu.",
    "Незворотна дія. Пов’язані реєстрації Telegram, майбутні події або фінансові записи можуть заблокувати автоматичне видалення для ручної перевірки."
  ],
  [
    "Reason and internal case reference",
    "Reason and internal case reference",
    "Důvod a interní číslo případu",
    "Причина та внутрішній номер справи"
  ],
  [
    "Type ERASE to authorize",
    "Type ERASE to authorize",
    "Pro potvrzení zadej ERASE",
    "Для підтвердження введи ERASE"
  ]
];
const dictionary = new Map(messages.map(([ru,en,cs,uk]) => [ru,{ru,en,cs,uk}] as const));
export function eventAdminText(language: LanguageCode, source: string): string {
  return dictionary.get(source)?.[language] ?? adminTranslate(language,source);
}
