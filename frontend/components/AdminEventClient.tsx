"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { CountryCityFields } from "@/components/CountryCityFields";
import {
  getManageMe,getManageEvent,getManageParticipants,
  editManageEvent,cancelManageEvent,exportManageParticipantsCsv,
  checkInManagedTicket,listManageOrganizers,assignManageOwner,getManageAudit,
} from "@/lib/api";
import { getWebToken } from "@/lib/session";
import type { AdminEventTickets,ManageEvent,ManageIdentity,OrganizerIdentity,LanguageCode } from "@/lib/types";

function asLocal(value: string|null): string {
  if(!value)return "";
  return value.slice(0,16);
}
function formattedError(e:unknown):string {return e instanceof Error?e.message:String(e);}
function posterData(file:File):Promise<string> {return new Promise((resolve,reject)=>{
  const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error("Poster read failed"));reader.readAsDataURL(file);
});}
export function AdminEventClient(){
  const params=useParams<{id:string}>(),eventId=Number(params?.id);
  const [identity,setIdentity]=useState<ManageIdentity|null>(null);
  const [event,setEvent]=useState<ManageEvent|null>(null);
  const [data,setData]=useState<AdminEventTickets|null>(null);
  const [organizers,setOrganizers]=useState<OrganizerIdentity[]>([]);
  const [audit,setAudit]=useState<{action:string;details:string;actor_account_id:number;at:string}[]>([]);
  const [error,setError]=useState(""),[notice,setNotice]=useState("");
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const [showEdit,setShowEdit]=useState(false),[showCancel,setShowCancel]=useState(false);
  const [reason,setReason]=useState(""),[owner,setOwner]=useState("");
  const [poster,setPoster]=useState<File|null>(null);
  const [title,setTitle]=useState(""),[location,setLocation]=useState("");
  const [countryCode,setCountryCode]=useState(""),[city,setCity]=useState("");
  const [organizer,setOrganizer]=useState(""),[description,setDescription]=useState("");
  const [gallery,setGallery]=useState(""),[video,setVideo]=useState("");
  const [startsAt,setStartsAt]=useState(""),[capacity,setCapacity]=useState("30");
  const [price,setPrice]=useState("0"),[currency,setCurrency]=useState("CZK");
  const [languages,setLanguages]=useState<LanguageCode[]>(["en","ru"]);
  async function reload(){
    const token=getWebToken();if(!token)throw new Error("Сначала войди в профиль.");
    const [me,ev,tickets]=await Promise.all([
      getManageMe(token),getManageEvent(eventId,token),getManageParticipants(token,eventId)
    ]);
    setIdentity(me);setEvent(ev);setData(tickets);
    setTitle(ev.title);setLocation(ev.location||"");setOrganizer(ev.organizer||"Crowdly");
    setCountryCode(ev.country_code||"");setCity(ev.city||"");
    setDescription(ev.description||"");setGallery((ev.gallery_urls||[]).join("\n"));setVideo(ev.video_url||"");setStartsAt(asLocal(ev.starts_at));
    setCapacity(String(ev.max_participants??30));setPrice(String(ev.price??0));
    setCurrency(ev.currency||"CZK");setLanguages(ev.languages||[]);
    setOwner(ev.owner_account_id==null?"":String(ev.owner_account_id));
    if(me.role==="global_admin"){
      const [list,history]=await Promise.all([
        listManageOrganizers(token),getManageAudit(token,eventId)
      ]);
      setOrganizers(list);setAudit(history);
    }
  }
  useEffect(()=>{if(!eventId)return;let active=true;
    reload().catch(e=>{if(active)setError(formattedError(e));}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false};
  },[eventId]);
  async function saveChanges(e:FormEvent){
    e.preventDefault();const token=getWebToken();if(!token||!event)return;
    setBusy(true);setError("");setNotice("");
    try{
      let image:string|undefined;
      if(poster && poster.size>0) {
        if(poster.size>4*1024*1024)throw new Error("Постер больше 4 МБ");
        if(!["image/jpeg","image/png","image/webp"].includes(poster.type))throw new Error("Формат постера — JPG, PNG или WebP.");
        image=await posterData(poster);
      }
      if(!languages.length)throw new Error("Выбери язык.");
      const payload:Record<string,unknown>={
        title:title.trim(),organizer:organizer.trim(),description,location,
        gallery_urls:gallery.split(/\r?\n/).map(s=>s.trim()).filter(Boolean),video_url:video.trim(),
        country_code:countryCode,city:city.trim(),
        max_participants:Number(capacity),price:String(price),
        currency,starts_at:startsAt+":00",languages,
      };
      if(image)payload.poster_data_url=image;
      await editManageEvent(token,eventId,payload);
      await reload();setShowEdit(false);setPoster(null);
      setNotice("Изменения сохранены.");
    }catch(e){setError(formattedError(e));}
    finally{setBusy(false);}
  }
  async function cancel(e:FormEvent) {
    e.preventDefault();
    const token=getWebToken();if(!token)return;
    if(reason.trim().length<8){setError("Причина отмены должна содержать не менее 8 символов.");return;}
    if(!window.confirm("Подтвердить отмену события? Новые записи будут заблокированы."))return;
    setBusy(true);setError("");setNotice("");
    try{await cancelManageEvent(token,eventId,reason.trim());await reload();setShowCancel(false);
      setNotice("Ивент отменён. Причина сохранена.");
    }catch(e){setError(formattedError(e));}finally{setBusy(false);}
  }
  async function assign(){
    const token=getWebToken();if(!token||!owner)return;
    setBusy(true);setError("");setNotice("");
    try{
      await assignManageOwner(token,eventId,Number(owner));
      await reload();setNotice("Владелец ивента обновлён.");
    }catch(e){setError(formattedError(e));}finally{setBusy(false);}
  }
  async function csv(){
    const token=getWebToken();if(!token)return;
    setBusy(true);try{await exportManageParticipantsCsv(token,eventId);}
    catch(e){setError(formattedError(e));}finally{setBusy(false);}
  }
  async function checkIn(qr:string){
    const token=getWebToken();if(!token)return;
    setBusy(true);setError("");
    try{await checkInManagedTicket(token,qr);await reload();setNotice("Check-in выполнен.");}
    catch(e){setError(formattedError(e));}finally{setBusy(false);}
  }
  return <div className="app-shell"><AppHeader/><main className="page">
    <Link href="/admin" className="back-link">← Organizer dashboard</Link>
    {loading&&<div className="state-card">Загрузка…</div>}
    {error&&<div className="state-card state-error" role="alert">{error}</div>}
    {notice&&<div className="success-banner" role="status">{notice}</div>}
    {event&&identity&&<>
      <div className="admin-heading">
        <div><span className={event.is_cancelled?"status status-danger":"status status-demo"}>{event.is_cancelled?"CANCELLED":`EVENT #${event.id}`}</span>
        <h1>{event.title}</h1><p>{event.location}</p></div>
        <div className="admin-event-actions">
          <button className="button button-outline" onClick={csv} disabled={busy}>↓ Export CSV</button>
          <Link className="button button-sun" href="/admin/check-in">Scan QR</Link>
        </div>
      </div>
      {event.is_cancelled&&<div className="state-card state-error"><strong>Причина отмены:</strong> {event.cancellation_reason||"—"}</div>}
      <div className="admin-event-actions" style={{marginBottom:18}}>
        {!event.is_cancelled&&<button className="button button-primary" onClick={()=>setShowEdit(v=>!v)}>
        {showEdit?"Закрыть":"Редактировать ивент"}</button>}
        {!event.is_cancelled&&<button className="button button-outline" onClick={()=>setShowCancel(v=>!v)}>Отменить ивент</button>}
        <Link className="button button-outline" href={`/events/${event.id}`}>Публичная страница ↗</Link>
      </div>
      {showEdit&&!event.is_cancelled&&<form className="panel form-stack" onSubmit={saveChanges}>
        <h2>Редактировать информацию</h2>
        <label>Название<input value={title} required onChange={e=>setTitle(e.target.value)}/></label>
        <label>Организатор<input value={organizer} onChange={e=>setOrganizer(e.target.value)}/></label>
        <CountryCityFields countryCode={countryCode} city={city} onCountryChange={setCountryCode}
          onCityChange={setCity} language="ru" />
        <label>Адрес или место проведения<input value={location} onChange={e=>setLocation(e.target.value)}/></label>
        <label>Описание<textarea rows={5} value={description} onChange={e=>setDescription(e.target.value)}/></label>
        <label>Фото мероприятия (HTTPS, по одной ссылке на строку, до 8)<textarea rows={4} value={gallery} onChange={e=>setGallery(e.target.value)}/></label>
        <label>Видео (YouTube/Vimeo)<input type="url" value={video} onChange={e=>setVideo(e.target.value)} placeholder="https://www.youtube.com/watch?v=…"/></label>
        <div className="two-col"><label>Дата и время<input type="datetime-local" required value={startsAt} onChange={e=>setStartsAt(e.target.value)}/></label>
          <label>Количество мест<input type="number" min="1" value={capacity} onChange={e=>setCapacity(e.target.value)}/></label></div>
        <div className="two-col"><label>Цена<input type="number" min="0" step="0.01" value={price} onChange={e=>setPrice(e.target.value)}/></label>
          <label>Валюта<select value={currency} onChange={e=>setCurrency(e.target.value)}>
          <option>CZK</option><option>EUR</option><option>USD</option></select></label></div>
        <fieldset className="event-language-fieldset"><legend>Языки</legend>
        <div className="event-language-options">
          {([["en","🇬🇧 English"],["cs","🇨🇿 Čeština"],["ru","🇷🇺 Русский"],["uk","🇺🇦 Українська"]] as const).map(([id,label])=>
            <label key={id}><input type="checkbox" checked={languages.includes(id)}
              onChange={e=>setLanguages(s=>e.target.checked?[...s,id]:s.filter(x=>x!==id))}/>{label}</label>)}
        </div></fieldset>
        <label>Новый постер (необязательно)<input type="file" accept="image/png,image/jpeg,image/webp"
          onChange={e=>setPoster(e.target.files?.[0]||null)}/></label>
        {event.image_url&&<img src={event.image_url} alt="Event poster" className="event-poster-preview"/>}
        <button className="button button-primary" disabled={busy}>{busy?"Сохраняем…":"Сохранить изменения"}</button>
      </form>}
      {showCancel&&!event.is_cancelled&&<form className="panel form-stack" onSubmit={cancel}>
        <h2>Отмена ивента</h2>
        <p>Укажи причину отмены (обязательно). После отмены регистрация на ивент будет закрыта.</p>
        <label>Причина отмены<textarea required minLength={8} maxLength={1000} rows={4}
          value={reason} onChange={e=>setReason(e.target.value)} placeholder="Например: Организатор вынужден перенести мероприятие из-за…"/></label>
        <button className="button button-outline" disabled={busy||reason.trim().length<8}>Подтвердить отмену</button>
      </form>}
      {identity.role==="global_admin"&&<section className="panel form-stack">
        <h2>Глобальная модерация</h2>
        <p>Владелец ивента: {event.owner_account_id==null?"не назначен":`Аккаунт #${event.owner_account_id}`}</p>
        <label>Назначить организатора
          <select value={owner} onChange={e=>setOwner(e.target.value)}>
          <option value="">Выбери организатора</option>
          {organizers.map(x=><option key={x.account_id} value={x.account_id}>{x.name} ({x.email})</option>)}
          </select>
        </label>
        <button type="button" className="button button-primary" disabled={busy||!owner} onClick={assign}>Сохранить владельца</button>
        <h3>История модерации</h3>
        {!audit.length&&<small>Нет действий</small>}
        {audit.map((a,i)=><div className="participant-row" key={i}>
          <div><strong>{a.action}</strong><small>Admin/Organizer #{a.actor_account_id}</small><small>{a.details}</small></div>
          <small>{new Date(a.at).toLocaleString()}</small>
        </div>)}
      </section>}
      {data&&<>
        <div className="stats-grid">
          <div className="stat-card"><strong>{data.tickets.filter(t=>t.ticket_status==="active").length}</strong><span>Билеты</span></div>
          <div className="stat-card"><strong>{data.tickets.filter(t=>t.checked_in_at).length}</strong><span>Checked in</span></div>
          <div className="stat-card"><strong>{data.waitlist.filter(w=>w.status==="waiting").length}</strong><span>Waitlist</span></div>
        </div>
        <section className="panel"><h2>Участники</h2><div className="participant-list">
          {!data.tickets.length&&<p>Пока нет билетов.</p>}
          {data.tickets.map(ticket=><div className="participant-row" key={ticket.id}>
            <div><strong>{ticket.guest?.first_name} {ticket.guest?.last_name}</strong>
              <small>{ticket.guest?.email}</small><small>{ticket.code} · {ticket.payment_status}</small></div>
            <div className="participant-actions">
              <span className={ticket.checked_in_at?"status status-success":"status status-demo"}>
                {ticket.ticket_status==="cancelled"?"Cancelled":ticket.checked_in_at?"Checked in":"Paid"}</span>
              {ticket.ticket_status==="active"&&!ticket.checked_in_at&&<button className="button button-outline"
                onClick={()=>checkIn(ticket.qr_token)} disabled={busy}>Check in</button>}
            </div>
          </div>)}
        </div></section>
        <section className="panel"><h2>Лист ожидания</h2>
          {!data.waitlist.length&&<p>Пока пусто.</p>}
          {data.waitlist.filter(w=>w.status==="waiting").map(w=><div key={w.id} className="participant-row">
            <strong>{w.guest.first_name} {w.guest.last_name}</strong><span className="status status-muted">Waiting</span>
          </div>)}
        </section>
      </>}
    </>}
  </main></div>;
}
