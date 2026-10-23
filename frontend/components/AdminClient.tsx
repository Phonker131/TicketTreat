"use client";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import {useLanguage} from "@/components/LanguageProvider";
import {adminTranslate} from "@/lib/admin-i18n";
import { ReminderEditor } from "@/components/ReminderEditor";
import { addManageEvent, getManageEvents, getManageMe } from "@/lib/api";
import { getWebToken } from "@/lib/session";
import type { LanguageCode, ManageEvent, ManageIdentity } from "@/lib/types";

function errorText(e: unknown): string {
  const raw=e instanceof Error?e.message:String(e);
  return raw==="organizer_role_required"?"Этот аккаунт зарегистрирован как участник. Для создания ивентов нужен аккаунт организатора.":raw;
}
function readPoster(file: File): Promise<string> {
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result));
    reader.onerror=()=>reject(new Error("Не удалось прочитать постер."));
    reader.readAsDataURL(file);
  });
}
export function AdminClient() {
  const {language}=useLanguage();
  const tr=(phrase:string)=>adminTranslate(language,phrase);
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
  const [reminderMessage,setReminderMessage]=useState("Your TicketTreat event starts soon.");
  const [eventSearch,setEventSearch]=useState("");
  const [eventStatus,setEventStatus]=useState("all");
  const [sortMode,setSortMode]=useState("newest");
  useEffect(()=>{
    let live=true;
    const token=getWebToken();
    if(!token){setLoading(false);setError("Войди в аккаунт организатора, чтобы управлять событиями.");return;}
    Promise.all([getManageMe(token),getManageEvents(token)])
      .then(([me,data])=>{if(live){setIdentity(me);setEvents(data);}})
      .catch(e=>{if(live)setError(errorText(e));})
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
        if(file.size>4*1024*1024)throw new Error("Максимальный размер постера — 4 МБ.");
        if(!["image/png","image/jpeg","image/webp"].includes(file.type))throw new Error("Только PNG, JPEG или WebP.");
        poster_data_url=await readPoster(file);
      }
      const langs=data.getAll("languages").map(String).filter((v):v is LanguageCode=>["en","cs","ru","uk"].includes(v));
      if(!langs.length)throw new Error("Выбери хотя бы один язык.");
      const starts=String(data.get("starts_at")||"");
      if(!starts)throw new Error("Введи дату и время.");
      if(!reminderMinutes.length||!reminderMessage.trim())throw new Error("Укажи время и текст напоминания.");
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
        starts_at:starts+":00",languages:langs,poster_data_url,
        reminder_minutes:reminderMinutes,reminder_text:reminderMessage.trim(),
      });
      setEvents(current=>[event,...current]);
      form.reset();setPreview("");setShowForm(false);
      setReminderMinutes([10080,1440,180]);setReminderMessage("Your TicketTreat event starts soon.");setNotice("Черновик создан. Заполни детали и опубликуй его из карточки мероприятия.");
    }catch(e){setError(errorText(e));}
    finally{setSaving(false);}
  }
  return <div className="app-shell"><AppHeader/><main className="page">
    <div className="admin-heading">
      <div><span className="status status-demo">{identity?.role==="global_admin"?"GLOBAL ADMIN":"ORGANIZER"}</span>
        <h1>{identity?.role==="global_admin"?"Все события TicketTreat":"Мои ивенты"}</h1>
        <p>{identity?.role==="global_admin"?"Полный доступ, назначение владельцев и модерация.":"Доступ только к собственным событиям."}</p>
      </div>
      {identity&&<div className="admin-event-actions">
        {identity.role==="global_admin"&&<><Link className="button button-outline" href="/admin/accounts">{tr("Управление аккаунтами")}</Link><Link className="button button-outline" href="/admin/content">{tr("Контент сайта")}</Link><Link className="button button-outline" href="/admin/broadcasts">📢 Глобальная рассылка</Link><Link className="button button-outline" href="/admin/privacy">{tr("Запросы на удаление")}</Link><Link className="button button-outline" href="/admin/organizers">{tr("Заявки организаторов")}</Link></>}
        <Link className="button button-sun" href="/admin/check-in">Scan ticket</Link>
      </div>}
    </div>
    {error&&<div className="state-card state-error" role="alert">
      {error==="mfa_enrollment_required" || error==="mfa_challenge_required" ? <>
        <strong>{error==="mfa_enrollment_required" ? mfaCopy.setupTitle : mfaCopy.challengeTitle}</strong>
        <p>{error==="mfa_enrollment_required" ? mfaCopy.setupDescription : mfaCopy.challengeDescription}</p>
        <Link href="/security/mfa" className="button button-primary">
          {error==="mfa_enrollment_required" ? mfaCopy.setupAction : mfaCopy.challengeAction} →
        </Link>
      </> : <>{error} {!identity&&<Link href="/profile" className="button button-outline">Открыть профиль</Link>}</>}
    </div>}
    {notice&&<div className="success-banner" role="status">{notice}</div>}
    {loading?<div className="state-card">Загрузка…</div>:identity&&identity.role!=="participant"&&<>
      <div className="section-heading"><div><h2>{identity.role==="global_admin"?"Все события":"Мои события"}</h2>
      <p>{events.length} events</p></div>
        <button type="button" className="button button-primary" onClick={()=>setShowForm(v=>!v)}>
        {showForm?"Закрыть":"+ Create event"}</button>
      </div>
      {showForm&&<form className="panel form-stack" onSubmit={submit}>
        <h2>{tr("Новый ивент")}</h2><p className="form-note">Новый ивент создаётся как приватный черновик. После редактирования его можно опубликовать или запланировать.</p>
        <label>{tr("Название")}<input required name="title" maxLength={255}/></label>
        <label>{tr("Организатор")}<input name="organizer" defaultValue="TicketTreat" /></label>
        <label>{tr("Адрес или место проведения")}<input name="location" required /></label>
        <label>{tr("Описание")}<textarea name="description" rows={4}/></label>
        <label>Ссылки на фото (HTTPS, не более 8, каждая с новой строки)<textarea name="gallery_urls" rows={4} placeholder="https://example.com/event-photo.jpg"/></label>
        <label>Видео мероприятия (YouTube или Vimeo)<input type="url" name="video_url" placeholder="https://www.youtube.com/watch?v=…"/></label>
        <label>{tr("Постер JPG/PNG/WebP до 4 МБ")}<input name="poster" type="file" accept="image/jpeg,image/png,image/webp"
          onChange={e=>{const f=e.target.files?.[0];if(!f){setPreview("");return;}if(f.size>4*1024*1024){setError("Постер больше 4 МБ");return;}const url=URL.createObjectURL(f);setPreview(url);}}/></label>
        {preview&&<><img className="event-poster-preview" src={preview} alt="Poster preview"/></>}
        <fieldset className="event-language-fieldset"><legend>{tr("Языки ивента")}</legend><div className="event-language-options">
          <label><input type="checkbox" name="languages" value="en" defaultChecked/>🇬🇧 English</label>
          <label><input type="checkbox" name="languages" value="cs"/>🇨🇿 Čeština</label>
          <label><input type="checkbox" name="languages" value="ru" defaultChecked/>🇷🇺 Русский</label>
          <label><input type="checkbox" name="languages" value="uk"/>🇺🇦 Українська</label>
        </div></fieldset>
        <div className="two-col"><label>{tr("Начало")}<input name="starts_at" type="datetime-local" required/></label>
        <label>{tr("Мест")}<input name="max_participants" type="number" min="1" defaultValue="30" required/></label></div>
        <ReminderEditor minutes={reminderMinutes} onChange={setReminderMinutes}
          message={reminderMessage} onMessageChange={setReminderMessage} language={language}/>
        <div className="two-col"><label>{tr("Цена")}<input name="price" type="number" min="0" step="0.01" defaultValue="0"/></label>
        <label>{tr("Валюта")}<select name="currency" defaultValue="CZK"><option value="CZK">CZK</option><option value="EUR">EUR</option><option value="USD">USD</option></select></label></div>
        <button className="button button-primary" disabled={saving}>{saving?"Сохраняем…":"Создать черновик"}</button>
      </form>}
      <section className="panel pilot-event-filters" aria-label="Фильтрация мероприятий">
        <label>{tr("Поиск мероприятий")}<input type="search" placeholder="Название, город или организатор"
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
          <small>#{ev.id} · {ev.is_cancelled?"Отменён":ev.publication?.status==="draft"?"Черновик":ev.publication?.status==="scheduled"?"Запланирован":"Опубликован"}</small>
          <h3>{ev.title}</h3>
          <p>{ev.location||"—"}</p>
          <div><span>{ev.registered_count??0} guests</span>
          <span>{ev.owner_account_id==null?"Unassigned":identity.role==="global_admin"?`Owner #${ev.owner_account_id}`:"Mine"}</span></div>
        </Link>)}
      </div>
      {!events.length&&<div className="state-card">Пока нет ивентов. Создай первый.</div>}
    </>}
    </main></div>;
}
