"use client";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { CountryCityFields } from "@/components/CountryCityFields";
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
  const [identity,setIdentity]=useState<ManageIdentity|null>(null);
  const [events,setEvents]=useState<ManageEvent[]>([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [showForm,setShowForm]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [preview,setPreview]=useState("");
  const [countryCode,setCountryCode]=useState("");
  const [city,setCity]=useState("");
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
      const event=await addManageEvent(token,{
        title:String(data.get("title")||"").trim(),
        organizer:String(data.get("organizer")||"TicketTreat").trim(),
        description:String(data.get("description")||"").trim(),
        gallery_urls:String(data.get("gallery_urls")||"").split(/\r?\n/).map(s=>s.trim()).filter(Boolean),
        video_url:String(data.get("video_url")||"").trim(),
        location:String(data.get("location")||"").trim(),
        country_code:countryCode,city:city.trim(),
        max_participants:Number(data.get("max_participants")||30),
        price:String(data.get("price")||"0"),
        currency:String(data.get("currency")||"CZK"),
        starts_at:starts+":00",languages:langs,poster_data_url,
      });
      setEvents(current=>[event,...current]);
      form.reset();setPreview("");setCountryCode("");setCity("");setShowForm(false);setNotice("Черновик создан. Заполни детали и опубликуй его из карточки мероприятия.");
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
        {identity.role==="global_admin"&&<><Link className="button button-outline" href="/admin/accounts">Управление аккаунтами</Link><Link className="button button-outline" href="/admin/content">Контент сайта</Link><Link className="button button-outline" href="/admin/privacy">Запросы на удаление</Link><Link className="button button-outline" href="/admin/organizers">Заявки организаторов</Link></>}
        <Link className="button button-sun" href="/admin/check-in">Scan ticket</Link>
      </div>}
    </div>
    {error&&<div className="state-card state-error" role="alert">{error} {!identity&&<Link href="/profile" className="button button-outline">Открыть профиль</Link>}</div>}
    {notice&&<div className="success-banner" role="status">{notice}</div>}
    {loading?<div className="state-card">Загрузка…</div>:identity&&identity.role!=="participant"&&<>
      <div className="section-heading"><div><h2>{identity.role==="global_admin"?"Все события":"Мои события"}</h2>
      <p>{events.length} events</p></div>
        <button type="button" className="button button-primary" onClick={()=>setShowForm(v=>!v)}>
        {showForm?"Закрыть":"+ Create event"}</button>
      </div>
      {showForm&&<form className="panel form-stack" onSubmit={submit}>
        <h2>Новый ивент</h2><p className="form-note">Новый ивент создаётся как приватный черновик. После редактирования его можно опубликовать или запланировать.</p>
        <label>Название<input required name="title" maxLength={255}/></label>
        <label>Организатор<input name="organizer" defaultValue="TicketTreat" /></label>
        <CountryCityFields countryCode={countryCode} city={city} onCountryChange={setCountryCode}
          onCityChange={setCity} language="ru" />
        <label>Адрес или место проведения<input name="location" required /></label>
        <label>Описание<textarea name="description" rows={4}/></label>
        <label>Ссылки на фото (HTTPS, не более 8, каждая с новой строки)<textarea name="gallery_urls" rows={4} placeholder="https://example.com/event-photo.jpg"/></label>
        <label>Видео мероприятия (YouTube или Vimeo)<input type="url" name="video_url" placeholder="https://www.youtube.com/watch?v=…"/></label>
        <label>Постер JPG/PNG/WebP до 4 МБ<input name="poster" type="file" accept="image/jpeg,image/png,image/webp"
          onChange={e=>{const f=e.target.files?.[0];if(!f){setPreview("");return;}if(f.size>4*1024*1024){setError("Постер больше 4 МБ");return;}const url=URL.createObjectURL(f);setPreview(url);}}/></label>
        {preview&&<><img className="event-poster-preview" src={preview} alt="Poster preview"/></>}
        <fieldset className="event-language-fieldset"><legend>Языки ивента</legend><div className="event-language-options">
          <label><input type="checkbox" name="languages" value="en" defaultChecked/>🇬🇧 English</label>
          <label><input type="checkbox" name="languages" value="cs"/>🇨🇿 Čeština</label>
          <label><input type="checkbox" name="languages" value="ru" defaultChecked/>🇷🇺 Русский</label>
          <label><input type="checkbox" name="languages" value="uk"/>🇺🇦 Українська</label>
        </div></fieldset>
        <div className="two-col"><label>Начало<input name="starts_at" type="datetime-local" required/></label>
        <label>Мест<input name="max_participants" type="number" min="1" defaultValue="30" required/></label></div>
        <div className="two-col"><label>Цена<input name="price" type="number" min="0" step="0.01" defaultValue="0"/></label>
        <label>Валюта<select name="currency" defaultValue="CZK"><option value="CZK">CZK</option><option value="EUR">EUR</option><option value="USD">USD</option></select></label></div>
        <button className="button button-primary" disabled={saving}>{saving?"Сохраняем…":"Создать черновик"}</button>
      </form>}
      <section className="panel pilot-event-filters" aria-label="Фильтрация мероприятий">
        <label>Поиск мероприятий<input type="search" placeholder="Название, город или организатор"
          value={eventSearch} onChange={e=>setEventSearch(e.target.value)}/></label>
        <label>Статус<select value={eventStatus} onChange={e=>setEventStatus(e.target.value)}>
          <option value="all">Все</option><option value="draft">Черновик</option>
          <option value="scheduled">Запланировано</option><option value="published">Опубликовано</option>
          <option value="cancelled">Отменено</option>
        </select></label>
        <label>Сортировка<select value={sortMode} onChange={e=>setSortMode(e.target.value)}>
          <option value="newest">Новые первыми</option><option value="soonest">Ближайшие по дате</option>
          <option value="title">По названию</option>
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
