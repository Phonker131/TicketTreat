"use client";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import {useLanguage} from "@/components/LanguageProvider";
import {eventAdminText} from "@/lib/event-admin-i18n";
import {userFacingError} from "@/lib/user-facing-errors";
import { ReminderEditor } from "@/components/ReminderEditor";
import { addManageEvent, getManageEvents, getManageMe, getSupportSummary } from "@/lib/api";
import { getWebToken } from "@/lib/session";
import type { LanguageCode, ManageEvent, ManageIdentity } from "@/lib/types";

function errorText(e: unknown,language:LanguageCode): string {
  return userFacingError(e,language);
}
function readPoster(file: File): Promise<string> {
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result));
    reader.onerror=()=>reject(new Error("poster_read_failed"));
    reader.readAsDataURL(file);
  });
}
const ADMIN_UI = {"en":{"all":"All TicketTreat events","mine":"My events","full":"Full access, organizer assignments and moderation.","mineHelp":"Only your own events are available.","broadcast":"Global broadcast","support":"Support desk","newCount":"new","scan":"Scan ticket","profile":"Open profile","loading":"Loading…","events":"events","close":"Close","create":"+ Create event","draftHelp":"A new event starts as a private draft. Edit it before publishing or scheduling.","photo":"Photo links (HTTPS, max. 8, one per line)","video":"Event video (YouTube or Vimeo)","tooBig":"Poster exceeds 4 MB.","payment":"Direct payment instructions for organizer (required for paid events)","paymentHint":"Payment details, reference and organizer contact. TicketTreat does not receive payments.","saving":"Saving…","createDraft":"Create draft","searchHint":"Event title or organizer","cancelled":"Cancelled","draft":"Draft","scheduled":"Scheduled","published":"Published","guests":"guests","unassigned":"Unassigned","owner":"Owner","mineTag":"Mine","empty":"No events yet. Create the first one.","created":"Draft created. Edit the event and publish it from its page.","login":"Sign in as an organizer to manage events."},"cs":{"all":"Všechny akce TicketTreat","mine":"Moje akce","full":"Plný přístup, přiřazování pořadatelů a moderování.","mineHelp":"K dispozici jsou pouze vaše akce.","broadcast":"Hromadné oznámení","support":"Zákaznická podpora","newCount":"nových","scan":"Skenovat vstupenku","profile":"Otevřít profil","loading":"Načítání…","events":"akcí","close":"Zavřít","create":"+ Vytvořit akci","draftHelp":"Nová akce vzniká jako soukromý koncept. Před zveřejněním nebo naplánováním ji upravte.","photo":"Odkazy na fotografie (HTTPS, max. 8, každý na nový řádek)","video":"Video akce (YouTube nebo Vimeo)","tooBig":"Plakát přesahuje 4 MB.","payment":"Pokyny k přímé platbě pořadateli (povinné pro placené akce)","paymentHint":"Platební údaje, variabilní symbol a kontakt pořadatele. TicketTreat peníze nepřijímá.","saving":"Ukládání…","createDraft":"Vytvořit koncept","searchHint":"Název akce nebo pořadatel","cancelled":"Zrušeno","draft":"Koncept","scheduled":"Naplánováno","published":"Zveřejněno","guests":"hostů","unassigned":"Nepřiřazeno","owner":"Vlastník","mineTag":"Moje","empty":"Zatím žádné akce. Vytvořte první.","created":"Koncept byl vytvořen. Upravte údaje a zveřejněte ho na stránce akce.","login":"Pro správu akcí se přihlaste jako pořadatel."},"ru":{"all":"Все события TicketTreat","mine":"Мои ивенты","full":"Полный доступ, назначение владельцев и модерация.","mineHelp":"Доступ только к собственным событиям.","broadcast":"Глобальная рассылка","support":"Служба поддержки","newCount":"новых","scan":"Сканировать билет","profile":"Открыть профиль","loading":"Загрузка…","events":"ивентов","close":"Закрыть","create":"+ Создать ивент","draftHelp":"Новый ивент создаётся как приватный черновик. После редактирования его можно опубликовать или запланировать.","photo":"Ссылки на фото (HTTPS, не более 8, каждая с новой строки)","video":"Видео мероприятия (YouTube или Vimeo)","tooBig":"Постер больше 4 МБ.","payment":"Инструкция по оплате напрямую организатору (обязательно для платного ивента)","paymentHint":"Реквизиты, назначение платежа, контакт организатора. TicketTreat деньги не принимает.","saving":"Сохраняем…","createDraft":"Создать черновик","searchHint":"Название или организатор","cancelled":"Отменён","draft":"Черновик","scheduled":"Запланирован","published":"Опубликован","guests":"гостей","unassigned":"Не назначен","owner":"Владелец","mineTag":"Мой","empty":"Пока нет ивентов. Создай первый.","created":"Черновик создан. Заполни детали и опубликуй его из карточки мероприятия.","login":"Войди в аккаунт организатора, чтобы управлять событиями."},"uk":{"all":"Усі події TicketTreat","mine":"Мої події","full":"Повний доступ, призначення власників і модерація.","mineHelp":"Доступ лише до власних подій.","broadcast":"Загальна розсилка","support":"Служба підтримки","newCount":"нових","scan":"Сканувати квиток","profile":"Відкрити профіль","loading":"Завантаження…","events":"подій","close":"Закрити","create":"+ Створити подію","draftHelp":"Нова подія створюється як приватна чернетка. Потім її можна редагувати, публікувати або запланувати.","photo":"Посилання на фото (HTTPS, до 8, кожне з нового рядка)","video":"Відео події (YouTube або Vimeo)","tooBig":"Афіша більша за 4 МБ.","payment":"Інструкція з оплати безпосередньо організатору (обов’язкова для платної події)","paymentHint":"Реквізити, призначення платежу й контакт організатора. TicketTreat не приймає коштів.","saving":"Зберігаємо…","createDraft":"Створити чернетку","searchHint":"Назва події або організатор","cancelled":"Скасовано","draft":"Чернетка","scheduled":"Заплановано","published":"Опубліковано","guests":"гостей","unassigned":"Не призначено","owner":"Власник","mineTag":"Мій","empty":"Подій ще немає. Створи першу.","created":"Чернетку створено. Відредагуй деталі й опублікуй її зі сторінки події.","login":"Увійди як організатор, щоб керувати подіями."}};
export function AdminClient() {
  const {language}=useLanguage();
  const tr=(phrase:string)=>eventAdminText(language,phrase);
  const ui=ADMIN_UI[language];
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
  const [events,setEvents]=useState<ManageEvent[]>([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [showForm,setShowForm]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [preview,setPreview]=useState("");
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
    const token=getWebToken();
    if(!token)return;
    const form=e.currentTarget,data=new FormData(form);
    setSaving(true);setError("");setNotice("");
    try{
      const file=data.get("poster");
      let poster_data_url: string|null=null;
      if(file instanceof File && file.size>0){
        if(file.size>4*1024*1024)throw new Error("poster_too_large");
        if(!["image/png","image/jpeg","image/webp"].includes(file.type))throw new Error("invalid_poster_type");
        poster_data_url=await readPoster(file);
      }
      const langs=data.getAll("languages").map(String).filter((v):v is LanguageCode=>["en","cs","ru","uk"].includes(v));
      if(!langs.length)throw new Error("invalid_event_languages");
      const starts=String(data.get("starts_at")||"");
      if(!starts)throw new Error("event_start_required");
      if(!reminderMinutes.length||!reminderMessage.trim())throw new Error("reminder_settings_required");
      const event=await addManageEvent(token,{
        title:String(data.get("title")||"").trim(),
        organizer:String(data.get("organizer")||"TicketTreat").trim(),
        description:String(data.get("description")||"").trim(),
        gallery_urls:String(data.get("gallery_urls")||"").split(/\r?\n/).map(s=>s.trim()).filter(Boolean),
        video_url:String(data.get("video_url")||"").trim(),
        location:String(data.get("location")||"").trim(),
        country_code:"CZ",city:"",
        max_participants:Number(data.get("max_participants")||30),
        price:String(data.get("price")||"0"),
        currency:String(data.get("currency")||"CZK"),
        payment_instructions:String(data.get("payment_instructions")||"").trim(),
        starts_at:starts+":00",languages:langs,poster_data_url,
        reminder_minutes:reminderMinutes,reminder_text:reminderMessage.trim(),
      });
      setEvents(current=>[event,...current]);
      form.reset();setPreview("");setShowForm(false);
      setReminderMinutes([10080,1440,180]);setReminderMessage(tr("Your TicketTreat event starts soon."));setNotice("msg:created");
    }catch(e){setError(errorText(e,language));}
    finally{setSaving(false);}
  }
  return <div className="app-shell"><AppHeader/><main className="page">
    <div className="admin-heading">
      <div><span className="status status-demo">{identity?.role==="global_admin"?tr("Главный администратор"):tr("Организатор")}</span>
        <h1>{identity?.role==="global_admin"?ui.all:ui.mine}</h1>
        <p>{identity?.role==="global_admin"?ui.full:ui.mineHelp}</p>
        <Link href="/" className="tt-organizer-back-to-guests">{language==="ru"?"Сайт для гостей":language==="cs"?"Web pro návštěvníky":language==="uk"?"Сайт для гостей":"Guest website"} ↗</Link>
      </div>
      {identity&&<div className="admin-event-actions">
        <Link className="button button-primary" href="/admin/analytics">{language==="ru"?"📊 Аналитика":language==="cs"?"📊 Analytika":language==="uk"?"📊 Аналітика":"📊 Analytics"}</Link>
        <Link className="button button-outline" href="/admin/organizer-profile">{language==="ru"?"Профиль организатора":language==="cs"?"Profil pořadatele":language==="uk"?"Профіль організатора":"Organizer profile"}</Link>
        {identity.role==="global_admin"&&<><Link className="button button-outline" href="/admin/accounts">{tr("Управление аккаунтами")}</Link><Link className="button button-outline" href="/admin/content">{tr("Контент сайта")}</Link><Link className="button button-outline" href="/admin/broadcasts">📢 {ui.broadcast}</Link><Link className="button button-outline" href="/admin/support">{ui.support}{supportUnread!==null&&supportUnread>0?` · ${supportUnread} ${ui.newCount}`:""}</Link><Link className="button button-outline" href="/admin/privacy">{tr("Запросы на удаление")}</Link><Link className="button button-outline" href="/admin/organizers">{tr("Заявки организаторов")}</Link></>}
        <Link className="button button-sun" href="/admin/check-in">{ui.scan}</Link>
      </div>}
    </div>
    {error&&<div className="state-card state-error" role="alert">
      {error==="mfa_enrollment_required" || error==="mfa_challenge_required" ? <>
        <strong>{error==="mfa_enrollment_required" ? mfaCopy.setupTitle : mfaCopy.challengeTitle}</strong>
        <p>{error==="mfa_enrollment_required" ? mfaCopy.setupDescription : mfaCopy.challengeDescription}</p>
        <Link href="/security/mfa" className="button button-primary">
          {error==="mfa_enrollment_required" ? mfaCopy.setupAction : mfaCopy.challengeAction} →
        </Link>
      </> : <>{show(error)} {!identity&&<Link href="/profile" className="button button-outline">{ui.profile}</Link>}</>}
    </div>}
    {notice&&<div className="success-banner" role="status">{show(notice)}</div>}
    {loading?<div className="state-card">{ui.loading}</div>:identity&&identity.role!=="participant"&&<>
      <div className="section-heading"><div><h2>{identity.role==="global_admin"?ui.all:ui.mine}</h2>
      <p>{events.length} {ui.events}</p></div>
        <button type="button" className="button button-primary" onClick={()=>setShowForm(v=>!v)}>
        {showForm?ui.close:ui.create}</button>
      </div>
      {showForm&&<form className="panel form-stack" onSubmit={submit}>
        <h2>{tr("Новый ивент")}</h2><p className="form-note">{ui.draftHelp}</p>
        <label>{tr("Название")}<input required name="title" maxLength={255}/></label>
        <label>{tr("Организатор")}<input name="organizer" defaultValue="TicketTreat" /></label>
        <label>{tr("Адрес или место проведения")}<input name="location" required /></label>
        <label>{tr("Описание")}<textarea name="description" rows={4}/></label>
        <label>{ui.photo}<textarea name="gallery_urls" rows={4} placeholder="https://example.com/event-photo.jpg"/></label>
        <label>{ui.video}<input type="url" name="video_url" placeholder="https://www.youtube.com/watch?v=…"/></label>
        <label>{tr("Постер JPG/PNG/WebP до 4 МБ")}<input name="poster" type="file" accept="image/jpeg,image/png,image/webp"
          onChange={e=>{const f=e.target.files?.[0];if(!f){setPreview("");return;}if(f.size>4*1024*1024){setError("msg:tooBig");return;}const url=URL.createObjectURL(f);setPreview(url);}}/></label>
        {preview&&<><img className="event-poster-preview" src={preview} alt="Poster preview"/></>}
        <fieldset className="event-language-fieldset"><legend>{tr("Языки ивента")}</legend><div className="event-language-options">
          {([["en","🇬🇧","English"],["cs","🇨🇿","Čeština"],["ru","🇷🇺","Русский"],["uk","🇺🇦","Українська"]] as const).map(([id,flag,name])=>
            <label className="event-language-option" key={id}>
              <input type="checkbox" name="languages" value={id} defaultChecked={id==="en"||id==="ru"}/>
              <span className="event-language-flag" aria-hidden="true">{flag}</span>
              <span className="event-language-name">{name}</span>
            </label>)}
        </div></fieldset>
        <div className="two-col"><label>{tr("Начало")}<input name="starts_at" type="datetime-local" required/></label>
        <label>{tr("Мест")}<input name="max_participants" type="number" min="1" defaultValue="30" required/></label></div>
        <ReminderEditor minutes={reminderMinutes} onChange={setReminderMinutes}
          message={reminderMessage} onMessageChange={setReminderMessage} language={language}/>
        <div className="two-col"><label>{tr("Цена")}<input name="price" type="number" min="0" step="0.01" defaultValue="0"/></label>
        <label>{tr("Валюта")}<select name="currency" defaultValue="CZK"><option value="CZK">CZK</option><option value="EUR">EUR</option><option value="USD">USD</option></select></label></div>
        <label>{ui.payment}
          <textarea name="payment_instructions" rows={4} maxLength={2000}
            placeholder={ui.paymentHint}/>
        </label>
        <button className="button button-primary" disabled={saving}>{saving?ui.saving:ui.createDraft}</button>
      </form>}
      <section className="panel pilot-event-filters" aria-label={tr("Фильтрация мероприятий")}>
        <label>{tr("Поиск мероприятий")}<input type="search" placeholder={ui.searchHint}
          value={eventSearch} onChange={e=>setEventSearch(e.target.value)}/></label>
        <label>{tr("Статус")}<select value={eventStatus} onChange={e=>setEventStatus(e.target.value)}>
          <option value="all">{tr("Все")}</option><option value="draft">{tr("Черновик")}</option>
          <option value="scheduled">{tr("Запланировано")}</option><option value="published">{tr("Опубликовано")}</option>
          <option value="cancelled">{tr("Отменено")}</option>
        </select></label>
        <label>{tr("Сортировка")}<select value={sortMode} onChange={e=>setSortMode(e.target.value)}>
          <option value="newest">{tr("Новые первыми")}</option><option value="soonest">{tr("Ближайшие по дате")}</option>
          <option value="title">{tr("По названию")}</option>
        </select></label>
      </section>
      <div className="admin-event-grid">
        {events.filter(ev=>{
          const status=ev.is_cancelled?"cancelled":ev.publication?.status||"published";
          const term=eventSearch.trim().toLocaleLowerCase();
          return (eventStatus==="all"||status===eventStatus)&&(!term||
            [ev.title,ev.city,ev.organizer,ev.location].some(v=>String(v||"").toLocaleLowerCase().includes(term)));
        }).sort((a,b)=>sortMode==="title"?a.title.localeCompare(b.title):sortMode==="soonest"?
          (Date.parse(a.starts_at||"")||Infinity)-(Date.parse(b.starts_at||"")||Infinity):b.id-a.id).map(ev=><Link key={ev.id} href={`/admin/events/${ev.id}`} className="admin-event-card">
          <small>#{ev.id} · {ev.is_cancelled?ui.cancelled:ev.publication?.status==="draft"?ui.draft:ev.publication?.status==="scheduled"?ui.scheduled:ui.published}</small>
          <h3>{ev.title}</h3>
          <p>{ev.location||"—"}</p>
          <div><span>{ev.registered_count??0} {ui.guests}</span>
          <span>{ev.owner_account_id==null?ui.unassigned:identity.role==="global_admin"?`${ui.owner} #${ev.owner_account_id}`:ui.mineTag}</span></div>
        </Link>)}
      </div>
      {!events.length&&<div className="state-card">{ui.empty}</div>}
    </>}
    </main></div>;
}
