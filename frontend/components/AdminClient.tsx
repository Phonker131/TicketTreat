"use client";
import Link from "next/link";
import {OrganizerRules} from "@/components/OrganizerRules";
import { FormEvent, useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import {useLanguage} from "@/components/LanguageProvider";
import {eventAdminText} from "@/lib/event-admin-i18n";
import {userFacingError} from "@/lib/user-facing-errors";
import { ReminderEditor } from "@/components/ReminderEditor";
import { uploadManageGalleryPhoto, addManageEvent, getManageEvents, getManageMe, getSupportSummary } from "@/lib/api";
import {PhotoViewer, PosterViewer} from "./PhotoViewer";
import {prepareGalleryPhoto} from "@/lib/gallery-photo";
import { getWebToken } from "@/lib/session";
import {localeForLanguage} from "@/lib/i18n";
import {TagIcon} from "@/lib/event-tags";
import {useEventCategories,categoryLabel} from "@/lib/event-categories";
import type { LanguageCode, ManageEvent, ManageIdentity } from "@/lib/types";

class LocalValidationError extends Error {}
function errorText(e: unknown,language:LanguageCode): string {
  return e instanceof LocalValidationError?e.message:userFacingError(e,language);
}
const ADMIN_UI = {"en":{"all":"All TicketTreat events","mine":"My events","full":"Full access, organizer assignments and moderation.","mineHelp":"Only your own events are available.","broadcast":"Global broadcast","support":"Support desk","newCount":"new","scan":"Scan ticket","profile":"Open profile","loading":"Loading…","events":"events","close":"Close","create":"+ Create event","draftHelp":"A new event starts as a private draft. Edit it before publishing or scheduling.","photo":"Photo links (HTTPS, max. 8, one per line)","video":"Event video (YouTube or Vimeo)","tooBig":"Image exceeds 25 MB.","payment":"Direct payment instructions for organizer (required for paid events)","paymentHint":"Payment details, reference and organizer contact. TicketTreat does not receive payments.","saving":"Saving…","createDraft":"Create draft","searchHint":"Event title or organizer","cancelled":"Cancelled","draft":"Draft","scheduled":"Scheduled","published":"Published","guests":"guests","unassigned":"Unassigned","owner":"Owner","mineTag":"Mine","empty":"No events yet. Create the first one.","created":"Draft created. Edit the event and publish it from its page.","login":"Sign in as an organizer to manage events."},"cs":{"all":"Všechny akce TicketTreat","mine":"Moje akce","full":"Plný přístup, přiřazování pořadatelů a moderování.","mineHelp":"K dispozici jsou pouze vaše akce.","broadcast":"Hromadné oznámení","support":"Zákaznická podpora","newCount":"nových","scan":"Skenovat vstupenku","profile":"Otevřít profil","loading":"Načítání…","events":"akcí","close":"Zavřít","create":"+ Vytvořit akci","draftHelp":"Nová akce vzniká jako soukromý koncept. Před zveřejněním nebo naplánováním ji upravte.","photo":"Odkazy na fotografie (HTTPS, max. 8, každý na nový řádek)","video":"Video akce (YouTube nebo Vimeo)","tooBig":"Obrázek přesahuje 25 MB.","payment":"Pokyny k přímé platbě pořadateli (povinné pro placené akce)","paymentHint":"Platební údaje, variabilní symbol a kontakt pořadatele. TicketTreat peníze nepřijímá.","saving":"Ukládání…","createDraft":"Vytvořit koncept","searchHint":"Název akce nebo pořadatel","cancelled":"Zrušeno","draft":"Koncept","scheduled":"Naplánováno","published":"Zveřejněno","guests":"hostů","unassigned":"Nepřiřazeno","owner":"Vlastník","mineTag":"Moje","empty":"Zatím žádné akce. Vytvořte první.","created":"Koncept byl vytvořen. Upravte údaje a zveřejněte ho na stránce akce.","login":"Pro správu akcí se přihlaste jako pořadatel."},"ru":{"all":"Все события TicketTreat","mine":"Мои ивенты","full":"Полный доступ, назначение владельцев и модерация.","mineHelp":"Доступ только к собственным событиям.","broadcast":"Глобальная рассылка","support":"Служба поддержки","newCount":"новых","scan":"Сканировать билет","profile":"Открыть профиль","loading":"Загрузка…","events":"ивентов","close":"Закрыть","create":"+ Создать ивент","draftHelp":"Новый ивент создаётся как приватный черновик. После редактирования его можно опубликовать или запланировать.","photo":"Ссылки на фото (HTTPS, не более 8, каждая с новой строки)","video":"Видео мероприятия (YouTube или Vimeo)","tooBig":"Изображение больше 25 МБ.","payment":"Инструкция по оплате напрямую организатору (обязательно для платного ивента)","paymentHint":"Реквизиты, назначение платежа, контакт организатора. TicketTreat деньги не принимает.","saving":"Сохраняем…","createDraft":"Создать черновик","searchHint":"Название или организатор","cancelled":"Отменён","draft":"Черновик","scheduled":"Запланирован","published":"Опубликован","guests":"гостей","unassigned":"Не назначен","owner":"Владелец","mineTag":"Мой","empty":"Пока нет ивентов. Создай первый.","created":"Черновик создан. Заполни детали и опубликуй его из карточки мероприятия.","login":"Войди в аккаунт организатора, чтобы управлять событиями."},"uk":{"all":"Усі події TicketTreat","mine":"Мої події","full":"Повний доступ, призначення власників і модерація.","mineHelp":"Доступ лише до власних подій.","broadcast":"Загальна розсилка","support":"Служба підтримки","newCount":"нових","scan":"Сканувати квиток","profile":"Відкрити профіль","loading":"Завантаження…","events":"подій","close":"Закрити","create":"+ Створити подію","draftHelp":"Нова подія створюється як приватна чернетка. Потім її можна редагувати, публікувати або запланувати.","photo":"Посилання на фото (HTTPS, до 8, кожне з нового рядка)","video":"Відео події (YouTube або Vimeo)","tooBig":"Зображення більше 25 МБ.","payment":"Інструкція з оплати безпосередньо організатору (обов’язкова для платної події)","paymentHint":"Реквізити, призначення платежу й контакт організатора. TicketTreat не приймає коштів.","saving":"Зберігаємо…","createDraft":"Створити чернетку","searchHint":"Назва події або організатор","cancelled":"Скасовано","draft":"Чернетка","scheduled":"Заплановано","published":"Опубліковано","guests":"гостей","unassigned":"Не призначено","owner":"Власник","mineTag":"Мій","empty":"Подій ще немає. Створи першу.","created":"Чернетку створено. Відредагуй деталі й опублікуй її зі сторінки події.","login":"Увійди як організатор, щоб керувати подіями."}};
/* Labels added with the 2026-11 dashboard clean-up: navigation, summary strip and grouped create form. */
const EXTRA_UI={
  ru:{nav:"Разделы кабинета",analytics:"Аналитика",rewards:"Награды",profile:"Профиль организатора",accounts:"Аккаунты",content:"Контент сайта",privacy:"Запросы на удаление",applications:"Заявки организаторов",published:"Опубликовано",drafts:"Черновики и в плане",next:"Ближайший ивент",none:"пока нет",guestsTotal:"Гостей на будущих",basics:"Основное",basicsHint:"Что, где и кто проводит.",when:"Когда и сколько",themes:"Категории и языки",media:"Постер и медиа",access:"Доступ и напоминания",title:"Название",organizer:"Организатор",location:"Адрес или место проведения",locationHint:"Площадка и улица с номером дома, например: Nerd Alert, Bulharská 924/26. По адресу Google покажет ивент на карте.",city:"Город",venue:"Ссылка на площадку",venueHint:"Сайт, Instagram или карта. Гости увидят кнопку «Сайт площадки».",description:"Описание",tags:"Категории",tagsHint:"По ним гости фильтруют афишу на главной.",languages:"Языки ивента",start:"Начало",capacity:"Мест",price:"Цена",currency:"Валюта",poster:"Загрузить постер с устройства (до 25 МБ)",visibility:"Доступ к мероприятию",publicOpt:"Публичное, в каталоге",privateOpt:"Закрытое, только по ссылке",privateHint:"Случайная ссылка появится после создания. Мероприятие не будет видно в каталоге.",search:"Поиск",status:"Статус",all:"Все",sort:"Сортировка",newest:"Новые первыми",soonest:"Ближайшие по дате",byTitle:"По названию",guestsOf:"гостей из",noDate:"Дата не задана",shown:"показано"},
  en:{nav:"Dashboard sections",analytics:"Analytics",rewards:"Rewards",profile:"Organizer profile",accounts:"Accounts",content:"Site content",privacy:"Erasure requests",applications:"Organizer applications",published:"Published",drafts:"Drafts and scheduled",next:"Next event",none:"none yet",guestsTotal:"Guests at upcoming",basics:"Basics",basicsHint:"What, where and who hosts it.",when:"When and how many",themes:"Categories and languages",media:"Poster and media",access:"Access and reminders",title:"Title",organizer:"Organizer",location:"Address or venue",locationHint:"Venue and street with number, for example: Nerd Alert, Bulharská 924/26. Google uses the address to show the event on the map.",city:"City",venue:"Venue link",venueHint:"Website, Instagram or a map page. Guests see a “Venue website” button.",description:"Description",tags:"Categories",tagsHint:"Guests filter the home page by these.",languages:"Event languages",start:"Starts",capacity:"Capacity",price:"Price",currency:"Currency",poster:"Upload poster from device (up to 25 MB)",visibility:"Event visibility",publicOpt:"Public, listed in the catalog",privateOpt:"Private, invitation link only",privateHint:"A private invitation link will be generated. The event is not discoverable in the catalog.",search:"Search",status:"Status",all:"All",sort:"Sort",newest:"Newest first",soonest:"Soonest first",byTitle:"By title",guestsOf:"guests of",noDate:"No date yet",shown:"shown"},
  cs:{nav:"Části administrace",analytics:"Analytika",rewards:"Odměny",profile:"Profil pořadatele",accounts:"Účty",content:"Obsah webu",privacy:"Žádosti o výmaz",applications:"Žádosti pořadatelů",published:"Zveřejněno",drafts:"Koncepty a naplánované",next:"Nejbližší akce",none:"zatím žádná",guestsTotal:"Hostů na budoucích",basics:"Základ",basicsHint:"Co, kde a kdo pořádá.",when:"Kdy a kolik",themes:"Kategorie a jazyky",media:"Plakát a média",access:"Přístup a připomínky",title:"Název",organizer:"Pořadatel",location:"Adresa nebo místo konání",locationHint:"Místo a ulice s číslem, například: Nerd Alert, Bulharská 924/26. Podle adresy Google ukáže akci na mapě.",city:"Město",venue:"Odkaz na místo konání",venueHint:"Web, Instagram nebo mapa. Hosté uvidí tlačítko „Web místa konání“.",description:"Popis",tags:"Kategorie",tagsHint:"Podle nich hosté filtrují akce na úvodní stránce.",languages:"Jazyky akce",start:"Začátek",capacity:"Kapacita",price:"Cena",currency:"Měna",poster:"Nahrát plakát ze zařízení (do 25 MB)",visibility:"Přístup k události",publicOpt:"Veřejné, v katalogu",privateOpt:"Soukromé, pouze přes odkaz",privateHint:"Po vytvoření vznikne soukromý odkaz; událost se nezobrazí v katalogu.",search:"Hledat",status:"Stav",all:"Vše",sort:"Řazení",newest:"Nejnovější první",soonest:"Nejbližší první",byTitle:"Podle názvu",guestsOf:"hostů z",noDate:"Bez data",shown:"zobrazeno"},
  uk:{nav:"Розділи кабінету",analytics:"Аналітика",rewards:"Нагороди",profile:"Профіль організатора",accounts:"Акаунти",content:"Контент сайту",privacy:"Запити на видалення",applications:"Заявки організаторів",published:"Опубліковано",drafts:"Чернетки та заплановані",next:"Найближча подія",none:"поки немає",guestsTotal:"Гостей на майбутніх",basics:"Основне",basicsHint:"Що, де і хто проводить.",when:"Коли і скільки",themes:"Категорії та мови",media:"Афіша та медіа",access:"Доступ і нагадування",title:"Назва",organizer:"Організатор",location:"Адреса або місце проведення",locationHint:"Майданчик і вулиця з номером, наприклад: Nerd Alert, Bulharská 924/26. За адресою Google покаже подію на мапі.",city:"Місто",venue:"Посилання на майданчик",venueHint:"Сайт, Instagram або мапа. Гості побачать кнопку «Сайт майданчика».",description:"Опис",tags:"Категорії",tagsHint:"За ними гості фільтрують афішу на головній.",languages:"Мови події",start:"Початок",capacity:"Місць",price:"Ціна",currency:"Валюта",poster:"Завантажити афішу з пристрою (до 25 МБ)",visibility:"Доступ до події",publicOpt:"Публічна, у каталозі",privateOpt:"Закрита, лише за посиланням",privateHint:"Після створення з'явиться приватне посилання; подія не буде у каталозі.",search:"Пошук",status:"Статус",all:"Усі",sort:"Сортування",newest:"Нові першими",soonest:"Найближчі за датою",byTitle:"За назвою",guestsOf:"гостей із",noDate:"Дата не задана",shown:"показано"},
} as const;

function DateTile({value,locale,empty}:{value:string|null;locale:string;empty:string}){
  const date=value?new Date(value.replace(/(?:Z|[+-]\d{2}:\d{2})$/i,"")):null;
  if(!date||Number.isNaN(date.getTime()))return <span className="tp-ecard-date is-empty" aria-label={empty}><strong>-</strong><span>-</span></span>;
  return <span className="tp-ecard-date"><strong>{new Intl.DateTimeFormat(locale,{day:"2-digit"}).format(date)}</strong><span>{new Intl.DateTimeFormat(locale,{month:"short"}).format(date).replace(".","").toUpperCase()}</span></span>;
}

const DASH_ICONS:Record<string,React.ReactNode>={
  events:<><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></>,
  scan:<><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M8 12h8"/></>,
  analytics:<><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
  rewards:<><circle cx="12" cy="9" r="5"/><path d="m8.5 13.5-1.5 7 5-2.5 5 2.5-1.5-7"/></>,
  messages:<><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.7A8 8 0 1 1 21 12Z"/></>,
  campaigns:<><path d="M3 11v2a2 2 0 0 0 2 2h2l5 4V5L7 9H5a2 2 0 0 0-2 2Z"/><path d="M16 9a4 4 0 0 1 0 6"/></>,
  profile:<><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  accounts:<><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/></>,
  broadcast:<><path d="M5 12a7 7 0 0 1 14 0M8.5 12a3.5 3.5 0 0 1 7 0"/><circle cx="12" cy="12" r="1"/><path d="M12 13v8"/></>,
  support:<><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="m5.6 5.6 3.6 3.6M14.8 14.8l3.6 3.6M18.4 5.6l-3.6 3.6M9.2 14.8l-3.6 3.6"/></>,
  privacy:<><path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z"/></>,
  applications:<><rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M9 8h6M9 12h6M9 16h3"/></>,
  published:<><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></>,
  drafts:<><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z"/></>,
  guests:<><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/></>,
  next:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
};
function DashIcon({name}:{name:string}){
  return <svg className="tt-dash-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{DASH_ICONS[name]}</svg>;
}

export function AdminClient() {
  const {language}=useLanguage();
  const tr=(phrase:string)=>eventAdminText(language,phrase);
  const ui=ADMIN_UI[language];
  const x=EXTRA_UI[language];
  const locale=localeForLanguage(language);
  const show=(value:string)=>value.startsWith("msg:")?ui[value.slice(4) as keyof typeof ui]||value:tr(value);
  const mfaCopy = {
    ru: {
      setupTitle: "Для доступа к админ-панели включи двухфакторную аутентификацию.",
      challengeTitle: "Для доступа к админ-панели подтверди вход.",
      setupDescription: "Это обязательная защита аккаунта организатора. Подключи приложение-аутентификатор и введи шестизначный код.",
      challengeDescription: "Введи свежий код из приложения-аутентификатора. Подтверждение действует 12 часов.",
      setupAction: "Настроить двухфакторную защиту",
      challengeAction: "Подтвердить вход",
    },
    en: {
      setupTitle: "Enable two-factor authentication to access the dashboard.",
      challengeTitle: "Verify your session to access the dashboard.",
      setupDescription: "This protects organizer accounts. Connect an authenticator app and confirm a six-digit code.",
      challengeDescription: "Enter a fresh code from your authenticator app. Verification lasts 12 hours.",
      setupAction: "Set up two-factor authentication",
      challengeAction: "Verify session",
    },
    cs: {
      setupTitle: "Pro přístup do administrace zapněte dvoufaktorové ověření.",
      challengeTitle: "Pro přístup do administrace ověřte přihlášení.",
      setupDescription: "Jde o povinné zabezpečení účtu pořadatele. Připojte ověřovací aplikaci a zadejte šestimístný kód.",
      challengeDescription: "Zadejte nový kód z ověřovací aplikace. Ověření platí 12 hodin.",
      setupAction: "Nastavit dvoufaktorové ověření",
      challengeAction: "Ověřit přihlášení",
    },
    uk: {
      setupTitle: "Для доступу до адмін-панелі увімкни двофакторну автентифікацію.",
      challengeTitle: "Для доступу до адмін-панелі підтвердь вхід.",
      setupDescription: "Це обов'язковий захист акаунта організатора. Підключи застосунок-автентифікатор і введи шестизначний код.",
      challengeDescription: "Введи новий код із застосунку-автентифікатора. Підтвердження діє 12 годин.",
      setupAction: "Налаштувати двофакторний захист",
      challengeAction: "Підтвердити вхід",
    },
  }[language];
  const [identity,setIdentity]=useState<ManageIdentity|null>(null);
  const categories=useEventCategories();
  const [events,setEvents]=useState<ManageEvent[]>([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [showForm,setShowForm]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [photos,setPhotos]=useState<File[]>([]);
  const [draftPhotos,setDraftPhotos]=useState<{file:File;url:string}[]>([]);
  useEffect(()=>{
    const items=photos.map(file=>({file,url:URL.createObjectURL(file)}));
    setDraftPhotos(items);
    return ()=>items.forEach(item=>URL.revokeObjectURL(item.url));
  },[photos]);
  const [preview,setPreview]=useState("");
  useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview);},[preview]);
  const [reminderMinutes,setReminderMinutes]=useState<number[]>([10080,1440,180]);
  const [reminderMessage,setReminderMessage]=useState(() => tr("Your TicketTreat event starts soon."));
  const [eventSearch,setEventSearch]=useState("");
  const [eventStatus,setEventStatus]=useState("all");
  const [sortMode,setSortMode]=useState("newest");
  const [supportUnread,setSupportUnread]=useState<number|null>(null);
  useEffect(()=>{
    if(identity?.role!=="global_admin")return;
    let active=true;
    function load(){getSupportSummary().then(data=>{if(active)setSupportUnread(data.unread)}).catch(()=>{});}
    load();
    const interval=window.setInterval(()=>{if(document.visibilityState==="visible")load()},30000);
    return()=>{active=false;window.clearInterval(interval)};
  },[identity?.role]);
  useEffect(()=>{
    let live=true;
    const token=getWebToken();
    if(!token){setLoading(false);setError("msg:login");return;}
    Promise.all([getManageMe(token),getManageEvents(token)])
      .then(([me,data])=>{if(live){setIdentity(me);setEvents(data);}})
      .catch(e=>{if(live)setError(errorText(e,language));})
      .finally(()=>{if(live)setLoading(false);});
    return ()=>{live=false};
  },[]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if(saving)return;
    const token=getWebToken();
    if(!token)return;
    const form=e.currentTarget,data=new FormData(form);
    setSaving(true);setError("");setNotice("");
    try{
      const file=data.get("poster");
      let poster_data_url: string|null=null;
      if(file instanceof File && file.size>0){
        if(file.size>25*1024*1024)throw new LocalValidationError(language==="cs"?"Obrázek musí mít maximálně 25 MB.":"Choose an image smaller than 25 MB.");
        if(file.type&&!file.type.startsWith("image/"))throw new LocalValidationError(language==="cs"?"Vyberte obrázek z telefonu nebo počítače.":"Choose an image from your phone or computer.");
        try{poster_data_url=await prepareGalleryPhoto(file);}
        catch{throw new LocalValidationError(language==="cs"?"Obrázek se nepodařilo zpracovat. Zkuste fotografii JPG, PNG nebo WebP.":"Could not process this image. Please try a JPG, PNG or WebP photo.");}
      }
      const langs=data.getAll("languages").map(String).filter((v):v is LanguageCode=>["en","cs","ru","uk"].includes(v));
      if(!langs.length)throw new Error("invalid_event_languages");
      const starts=String(data.get("starts_at")||"");
      if(!starts)throw new Error("event_start_required");
      if(!reminderMinutes.length||!reminderMessage.trim())throw new Error("reminder_settings_required");
      if(photos.some(f=>f.size>25*1024*1024))
        throw new LocalValidationError(language==="cs"?"Každá fotografie musí mít maximálně 25 MB.":"Each photo must be smaller than 25 MB.");
      if(photos.some(f=>f.type&&!f.type.startsWith("image/")))
        throw new LocalValidationError(language==="cs"?"Vyberte pouze fotografie.":"Choose image files only.");
      if(photos.length>8)throw new LocalValidationError(language==="cs"?"Maximálně 8 fotografií.":"Choose at most 8 photos.");
      const event=await addManageEvent(token,{
        title:String(data.get("title")||"").trim(),
        visibility:data.get("visibility")==="link_only"?"link_only":"public",
        organizer:String(data.get("organizer")||"TicketTreat").trim(),
        description:String(data.get("description")||"").trim(),
        gallery_urls:[],
        video_url:String(data.get("video_url")||"").trim(),
        venue_url:String(data.get("venue_url")||"").trim(),
        tags:data.getAll("tags").map(String).filter(tag=>categories.some(category=>category.key===tag&&category.active)),
        location:String(data.get("location")||"").trim(),
        country_code:"CZ",city:String(data.get("city")||"").trim(),
        max_participants:Number(data.get("max_participants")||30),
        price:String(data.get("price")||"0"),
        currency:String(data.get("currency")||"CZK"),
        starts_at:starts+":00",languages:langs,poster_data_url,
        reminder_minutes:reminderMinutes,reminder_text:reminderMessage.trim(),
      });
      setEvents(current=>[event,...current]);
      // The draft already exists: never leave a create form that can duplicate it on retry.
      let failedPhotos=0;
      for(const photo of photos){
        try{await uploadManageGalleryPhoto(token,event.id,await prepareGalleryPhoto(photo));}
        catch{failedPhotos++;}
      }
      if(failedPhotos){
        window.location.assign(`/admin/events/${event.id}?photo_upload_failed=${failedPhotos}`);
        return;
      }
      form.reset();setPreview("");setPhotos([]);setShowForm(false);
      setReminderMinutes([10080,1440,180]);setReminderMessage(tr("Your TicketTreat event starts soon."));setNotice("msg:created");
    }catch(e){setError(errorText(e,language));}
    finally{setSaving(false);}
  }

  const statusOf=(ev:ManageEvent)=>ev.is_cancelled?"cancelled":ev.publication?.status||"published";
  const statusLabel=(ev:ManageEvent)=>{const s=statusOf(ev);return s==="cancelled"?ui.cancelled:s==="draft"?ui.draft:s==="scheduled"?ui.scheduled:ui.published};
  const startMs=(ev:ManageEvent)=>Date.parse(ev.starts_at||"")||NaN;
  const upcoming=events.filter(ev=>!ev.is_cancelled&&startMs(ev)>Date.now());
  const summary={
    published:events.filter(ev=>statusOf(ev)==="published").length,
    drafts:events.filter(ev=>statusOf(ev)==="draft"||statusOf(ev)==="scheduled").length,
    next:upcoming.filter(ev=>ev.publication?.visible).sort((a,b)=>startMs(a)-startMs(b))[0]||null,
    guests:upcoming.reduce((sum,ev)=>sum+(ev.registered_count??0),0),
  };
  const visible=events.filter(ev=>{
    const term=eventSearch.trim().toLocaleLowerCase();
    return (eventStatus==="all"||statusOf(ev)===eventStatus)&&(!term||
      [ev.title,ev.city,ev.organizer,ev.location].some(v=>String(v||"").toLocaleLowerCase().includes(term)));
  }).sort((a,b)=>sortMode==="title"?a.title.localeCompare(b.title):sortMode==="soonest"?
    (startMs(a)||Infinity)-(startMs(b)||Infinity):b.id-a.id);
  const whenText=(ev:ManageEvent)=>{
    const date=ev.starts_at?new Date(ev.starts_at.replace(/(?:Z|[+-]\d{2}:\d{2})$/i,"")):null;
    return date&&!Number.isNaN(date.getTime())?new Intl.DateTimeFormat(locale,{weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(date):x.noDate;
  };

  return <div className="app-shell"><AppHeader/><main className="page tt-dash-page"><div className="tt-dash">
    {identity&&<aside className="tt-dash-side"><ul className="tp-admin-nav" aria-label={x.nav}>
      <li><Link href="/admin" aria-current="page"><DashIcon name="events"/>{language==="cs"?"Akce":language==="ru"?"Ивенты":language==="uk"?"Події":"Events"}</Link></li>
      <li><Link href="/admin/check-in"><DashIcon name="scan"/>{ui.scan}</Link></li>
      <li><Link href="/admin/analytics"><DashIcon name="analytics"/>{x.analytics}</Link></li>
      <li><Link href="/admin/rewards"><DashIcon name="rewards"/>{x.rewards}</Link></li>
      <li><Link href="/admin/messages"><DashIcon name="messages"/>{language==="cs"?"Zprávy účastníků":"Attendee messages"}</Link></li>
      <li><Link href="/admin/promotions"><DashIcon name="campaigns"/>{language==="cs"?"Kampaně":"Campaigns"}</Link></li>
      <li><Link href="/admin/organizer-profile"><DashIcon name="profile"/>{x.profile}</Link></li>
      {identity.role==="global_admin"&&<>
        <li><Link href="/admin/accounts"><DashIcon name="accounts"/>{x.accounts}</Link></li>
        <li><Link href="/admin/categories"><DashIcon name="events"/>{language==="cs"?"Kategorie akcí":"Event categories"}</Link></li>
        <li><Link href="/admin/broadcasts"><DashIcon name="broadcast"/>{ui.broadcast}</Link></li>
        <li><Link href="/admin/support"><DashIcon name="support"/>{ui.support}{supportUnread!==null&&supportUnread>0&&<b className="tp-badge">{supportUnread}</b>}</Link></li>
        <li><Link href="/admin/privacy"><DashIcon name="privacy"/>{x.privacy}</Link></li>
        <li><Link href="/admin/organizers"><DashIcon name="applications"/>{x.applications}</Link></li>
      </>}
    </ul></aside>}
    <div className="tt-dash-main">
    <div className="admin-heading tp-admin-top">
      <div><span className="status status-demo">{identity?.role==="global_admin"?tr("Главный администратор"):tr("Организатор")}</span>
        <h1>{identity?.role==="global_admin"?ui.all:ui.mine}</h1>
        <p>{identity?.role==="global_admin"?ui.full:ui.mineHelp}</p>
        <Link href="/" className="tt-organizer-back-to-guests">{language==="ru"?"Сайт для гостей":language==="cs"?"Web pro návštěvníky":language==="uk"?"Сайт для гостей":"Guest website"}</Link>
      </div>
      {identity&&identity.role!=="participant"&&<div className="admin-event-actions tp-admin-primary">
        <button type="button" className="button button-primary" disabled={saving} onClick={()=>{setPhotos([]);setPreview("");setShowForm(v=>!v)}} aria-expanded={showForm}>{showForm?ui.close:ui.create}</button>
        <Link className="button button-sun" href="/admin/check-in">{ui.scan}</Link>
      </div>}
    </div>
    {error&&<div className="state-card state-error" role="alert">
      {error==="mfa_enrollment_required" || error==="mfa_challenge_required" ? <>
        <strong>{error==="mfa_enrollment_required" ? mfaCopy.setupTitle : mfaCopy.challengeTitle}</strong>
        <p>{error==="mfa_enrollment_required" ? mfaCopy.setupDescription : mfaCopy.challengeDescription}</p>
        <Link href="/security/mfa" className="button button-primary">
          {error==="mfa_enrollment_required" ? mfaCopy.setupAction : mfaCopy.challengeAction}
        </Link>
      </> : <>{show(error)} {!identity&&<Link href="/profile" className="button button-outline">{ui.profile}</Link>}</>}
    </div>}
    {notice&&<div className="success-banner" role="status">{show(notice)}</div>}
    {loading?<div className="state-card">{ui.loading}</div>:identity&&identity.role!=="participant"&&<>
      {events.length>0&&<div className="tp-admin-summary" aria-label={ui.events}>
        <div><DashIcon name="published"/><strong>{summary.published}</strong><span>{x.published}</span></div>
        <div><DashIcon name="drafts"/><strong>{summary.drafts}</strong><span>{x.drafts}</span></div>
        <div><DashIcon name="guests"/><strong>{summary.guests}</strong><span>{x.guestsTotal}</span></div>
        <div className="is-next"><DashIcon name="next"/><strong>{summary.next?summary.next.title:"-"}</strong><span>{x.next}: {summary.next?whenText(summary.next):x.none}</span></div>
      </div>}
      {showForm&&<form className="panel form-stack" onSubmit={submit}>
        <h2>{tr("Новый ивент")}</h2><p className="form-note">{ui.draftHelp}</p>
        <div className="tp-form-sections">
          <section className="tp-form-section">
            <h3>{x.basics}</h3><p>{x.basicsHint}</p>
            <label>{x.title}<input required name="title" maxLength={255}/></label>
            <label>{x.organizer}<input name="organizer" defaultValue="TicketTreat" /></label>
            <label>{x.location}<input name="location" required />
              <small className="tp-field-hint">{x.locationHint}</small></label>
            <label>{x.city}<input name="city" defaultValue="Praha" maxLength={100}/></label>
            <label>{x.venue}<input type="url" inputMode="url" name="venue_url" placeholder="https://…"/>
              <small className="tp-field-hint">{x.venueHint}</small></label>
            <label>{x.description}<textarea name="description" rows={5}/></label>
          </section>
          <section className="tp-form-section">
            <h3>{x.when}</h3>
            <div className="two-col"><label>{x.start}<input name="starts_at" type="datetime-local" required/></label>
            <label>{x.capacity}<input name="max_participants" type="number" min="1" defaultValue="30" required/></label></div>
            <div className="two-col"><label>{x.price}<input name="price" type="number" min="0" step="0.01" defaultValue="0" required/></label>
            <label>{x.currency}<select name="currency" defaultValue="CZK"><option value="CZK">CZK</option><option value="EUR">EUR</option><option value="USD">USD</option></select></label></div>
            <p className="form-note">{language==="cs"?"Registrace a QR vstupenka fungují stejně jako u bezplatné akce. TicketTreat nevybírá ani neověřuje platby; případnou platbu řeší pořadatel mimo platformu.":language==="en"?"Registration and QR tickets work like a free event. TicketTreat does not collect or verify payments; the organizer handles any payment outside the platform.":language==="uk"?"Запис та QR-квитки працюють як для безкоштовної події. TicketTreat не приймає та не перевіряє оплату; її організатор узгоджує окремо.":"Запись и QR-билет работают как для бесплатного мероприятия. TicketTreat не принимает и не проверяет оплату; её организатор согласовывает отдельно."}</p>
          </section>
          <section className="tp-form-section">
            <h3>{x.themes}</h3>
            <fieldset className="event-language-fieldset"><legend>{x.tags}</legend>
              <p className="tp-field-hint">{x.tagsHint}</p>
              <div className="event-language-options">
                {categories.filter(category=>category.active).map(category=><label className="event-language-option" key={category.key}>
                  <input type="checkbox" name="tags" value={category.key}/>
                  <span className="event-language-flag" aria-hidden="true"><TagIcon tag={category.key}/></span>
                  <span className="event-language-name">{categoryLabel(category,language)}</span>
                </label>)}
              </div></fieldset>
            <fieldset className="event-language-fieldset"><legend>{x.languages}</legend><div className="event-language-options">
              {([["en","🇬🇧","English"],["cs","🇨🇿","Čeština"],["ru","🇷🇺","Русский"],["uk","🇺🇦","Українська"]] as const).map(([id,flag,name])=>
                <label className="event-language-option" key={id}>
                  <input type="checkbox" name="languages" value={id} defaultChecked={id==="en"||id==="ru"}/>
                  <span className="event-language-flag" aria-hidden="true">{flag}</span>
                  <span className="event-language-name">{name}</span>
                </label>)}
            </div></fieldset>
          </section>
          <section className="tp-form-section">
            <h3>{x.media}</h3>
            <label>{x.poster}<input name="poster" type="file" accept="image/*"
              disabled={saving} onChange={e=>{
                const f=e.target.files?.[0];setPreview("");setError("");
                if(!f)return;
                if(f.size>25*1024*1024||(f.type&&!f.type.startsWith("image/"))){
                  setError(f.size>25*1024*1024?"msg:tooBig":userFacingError(new Error("invalid_poster_type"),language));
                  e.currentTarget.value="";return;
                }
                setPreview(URL.createObjectURL(f));
              }}/>
              <small className="tp-field-hint">{tr("Размер постера: 1080×1350 px (вертикальный 4:5), минимум 800×1000 px. Важное держите в центре, в ленте края могут обрезаться. Цвета остаются как в файле.")}</small></label>
            {preview&&<PosterViewer src={preview}><img className="event-poster-preview" src={preview} alt="Poster preview" style={{objectFit:"contain",height:"auto",maxHeight:520}}/></PosterViewer>}
            {preview&&<button type="button" className="button button-outline" disabled={saving} onClick={e=>{
              const input=e.currentTarget.form?.elements.namedItem("poster");
              if(input instanceof HTMLInputElement)input.value="";
              setPreview("");
            }}>{language==="cs"?"Zrušit výběr plakátu":"Discard selected poster"}</button>}
            <label>{language==="cs"?"Nahrát fotografie z zařízení":"Upload photos from your device"}<input name="gallery_files" type="file" multiple accept="image/*" disabled={saving}
              onChange={e=>{const selected=Array.from(e.target.files||[]);setPhotos(previous=>[...previous,...selected]);e.target.value="";}}/>
              <small className="tp-field-hint">{language==="cs"?"Jakékoli fotky z telefonu nebo fotoaparátu, velikost zmenšíme sami. Celkem nejvýše 8 fotografií.":"Any photos from your phone or camera, we resize them for you. 8 photos in total."}</small></label>
            
            {draftPhotos.length>0&&<PhotoViewer sources={draftPhotos.map(item=>item.url)}>{thumbnail=>
              <div className="event-media-gallery tt-gal-grid">{draftPhotos.map(({file,url},index)=><div key={url}>
              {thumbnail(index,<img src={url} alt="" loading="lazy"/>)}
              <span style={{overflowWrap:"anywhere"}}>{file.name}</span>
              <button type="button" className="button button-outline" disabled={saving}
                aria-label={`${language==="cs"?"Odebrat fotografii":"Remove photo"}: ${file.name}`}
                onClick={()=>setPhotos(previous=>previous.filter((_,i)=>i!==index))}>{language==="cs"?"Odebrat fotografii":"Remove photo"}</button>
            </div>)}</div>}
            </PhotoViewer>}
            <label>{ui.video}<input type="url" name="video_url" placeholder="https://www.youtube.com/watch?v=…"/></label>
          </section>
          <section className="tp-form-section is-wide">
            <h3>{x.access}</h3><OrganizerRules/>
            <label>{x.visibility}
              <select name="visibility" defaultValue="public">
                <option value="public">{x.publicOpt}</option>
                <option value="link_only">{x.privateOpt}</option>
              </select>
              <small className="form-note">{x.privateHint}</small>
            </label>
            <ReminderEditor minutes={reminderMinutes} onChange={setReminderMinutes}
              message={reminderMessage} onMessageChange={setReminderMessage} language={language}/>
          </section>
          <div className="tp-form-actions">
            {error&&<p role="alert" className="state-card state-error">{show(error)}</p>}
            <button className="button button-primary" disabled={saving}>{saving?ui.saving:ui.createDraft}</button>
            <button type="button" className="button button-outline" disabled={saving} onClick={()=>{setPhotos([]);setPreview("");setShowForm(false)}}>{ui.close}</button>
          </div>
        </div>
      </form>}
      {upcoming.length>0&&<section className="tt-dash-chart" aria-label={language==="cs"?"Registrace na nadcházející akce":"Registrations for upcoming events"}>
        <h2>{language==="cs"?"Registrace na nadcházející akce":language==="ru"?"Записи на ближайшие ивенты":language==="uk"?"Записи на найближчі події":"Registrations for upcoming events"}</h2>
        <div className="tt-dash-bars">{[...upcoming].sort((a,b)=>startMs(a)-startMs(b)).slice(0,8).map(ev=>{
          const reg=ev.registered_count??0,cap=ev.max_participants||0,pct=cap?Math.min(100,Math.round(100*reg/cap)):Math.min(100,reg*10);
          return <Link key={ev.id} href={`/admin/events/${ev.id}`} className="tt-dash-bar" title={ev.title}>
            <b>{reg}{cap?` / ${cap}`:""}</b>
            <span className="tt-dash-bar-track"><i style={{height:`${Math.max(pct,3)}%`}}/></span>
            <small>{ev.title}</small>
          </Link>;})}</div>
      </section>}
      {events.length>0&&<div className="tp-admin-toolbar" role="search" aria-label={tr("Фильтрация мероприятий")}>
        <label className="is-search">{x.search}<input type="search" placeholder={ui.searchHint}
          value={eventSearch} onChange={e=>setEventSearch(e.target.value)}/></label>
        <label>{x.status}<select value={eventStatus} onChange={e=>setEventStatus(e.target.value)}>
          <option value="all">{x.all}</option><option value="draft">{ui.draft}</option>
          <option value="scheduled">{ui.scheduled}</option><option value="published">{ui.published}</option>
          <option value="cancelled">{ui.cancelled}</option>
        </select></label>
        <label>{x.sort}<select value={sortMode} onChange={e=>setSortMode(e.target.value)}>
          <option value="newest">{x.newest}</option><option value="soonest">{x.soonest}</option>
          <option value="title">{x.byTitle}</option>
        </select></label>
        <span className="form-note">{visible.length} / {events.length} {x.shown}</span>
      </div>}
      <div className="admin-event-grid tp-admin-grid">
        {visible.map(ev=>{
          const status=statusOf(ev);
          const registered=ev.registered_count??0,cap=ev.max_participants;
          const fill=cap?Math.min(100,Math.round(100*registered/cap)):0;
          return <Link key={ev.id} href={`/admin/events/${ev.id}`} className="admin-event-card tp-admin-card">
            <DateTile value={ev.starts_at} locale={locale} empty={x.noDate}/>
            <span className="tt-dash-thumb">{ev.image_url?<img src={ev.image_url} alt="" loading="lazy"/>:null}</span>
            <span className={`tp-status is-${status}`}>
              <span className="tp-status-name">{ev.visibility==="link_only"&&<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{marginRight:4,verticalAlign:"-1px"}}><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>}{statusLabel(ev)}</span>
              {" "}
              <span className="tp-status-number">#{ev.id}</span>
            </span>
            <h3>{ev.title}</h3>
            <p>{whenText(ev)}{ev.location?`, ${ev.location}`:""}</p>
            <div className="tp-admin-guests">
              <span><b>{registered}{cap?` / ${cap}`:""}</b> {ui.guests}{identity.role==="global_admin"&&<small>{ev.owner_account_id==null?ui.unassigned:`${ui.owner} #${ev.owner_account_id}`}</small>}</span>
              {cap&&<div className={`tp-admin-bar${fill>=100?" is-full":""}`}><i style={{width:`${fill}%`}}/></div>}
            </div>
          </Link>;
        })}
      </div>
      {!events.length&&<div className="state-card">{ui.empty}</div>}
    </>}
    </div></div></main></div>;
}
