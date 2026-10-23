"use client";
import Link from "next/link";
import {useRouter} from "next/navigation";
import QRCode from "qrcode";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import {useLanguage} from "@/components/LanguageProvider";
import {adminTranslate} from "@/lib/admin-i18n";
import { CountryCityFields } from "@/components/CountryCityFields";
import { ReminderEditor } from "@/components/ReminderEditor";
import {
  getManageMe,getManageEvent,getManageParticipants,getEventEmailStatus,
  editManageEvent,cancelManageEvent,exportManageParticipantsCsv,uploadManageGalleryPhoto,deleteManageGalleryPhoto,orderManageGallery,
  setManagePublication,duplicateManageEvent,
  checkInManagedTicket,listManageOrganizers,assignManageOwner,getManageAudit,
  getPilotInsights,getPilotSettings,updatePilotSettings,getPilotStaff,grantPilotStaff,revokePilotStaff,sendEventAnnouncement,checkInByList,
} from "@/lib/api";
import { getWebToken } from "@/lib/session";
import type { AdminEventTickets,ManageEvent,ManageIdentity,OrganizerIdentity,LanguageCode } from "@/lib/types";
import type {EventEmailStatus,PilotInsights,PilotSettings,CheckinStaff} from "@/lib/api";

function asLocal(value: string|null): string {
  if(!value)return "";
  return value.slice(0,16);
}
function formattedError(e:unknown):string {return e instanceof Error?e.message:String(e);}
function posterData(file:File):Promise<string> {return new Promise((resolve,reject)=>{
  const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error("Poster read failed"));reader.readAsDataURL(file);
});}
export function AdminEventClient(){
  const {language}=useLanguage();
  const tr=(phrase:string)=>adminTranslate(language,phrase);
  const router=useRouter();
  const params=useParams<{id:string}>(),eventId=Number(params?.id);
  const [identity,setIdentity]=useState<ManageIdentity|null>(null);
  const [event,setEvent]=useState<ManageEvent|null>(null);
  const [data,setData]=useState<AdminEventTickets|null>(null);
  const [emailStatus,setEmailStatus]=useState<EventEmailStatus|null>(null);
  const [pilotInsights,setPilotInsights]=useState<PilotInsights|null>(null);
  const [pilotSettings,setPilotSettings]=useState<PilotSettings>({signup_cutoff_minutes:0,reminder_minutes:[10080,1440,180],waitlist_offer_minutes:0,event_duration_minutes:180});
  const [pilotStaff,setPilotStaff]=useState<CheckinStaff[]>([]);
  const [staffEmail,setStaffEmail]=useState("");
  const [reminderMessage,setReminderMessage]=useState("Your TicketTreat event starts soon.");
  const [announcementCategory,setAnnouncementCategory]=useState<"access"|"logistics"|"schedule">("logistics");
  const [announcementText,setAnnouncementText]=useState("");
  const [organizers,setOrganizers]=useState<OrganizerIdentity[]>([]);
  const [audit,setAudit]=useState<{action:string;details:string;actor_account_id:number;at:string}[]>([]);
  const [error,setError]=useState(""),[notice,setNotice]=useState("");
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const [showEdit,setShowEdit]=useState(false),[showCancel,setShowCancel]=useState(false);
  const [reason,setReason]=useState(""),[owner,setOwner]=useState("");
  const [scheduleAt,setScheduleAt]=useState("");
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
    setReminderMessage(ev.reminder_text||"Your TicketTreat event starts soon.");
    void getEventEmailStatus(token,eventId).then(setEmailStatus).catch(()=>setEmailStatus(null));
    void getPilotInsights(token,eventId).then(setPilotInsights).catch(()=>setPilotInsights(null));
    void getPilotSettings(token,eventId).then(setPilotSettings).catch(()=>{});
    void getPilotStaff(token,eventId).then(setPilotStaff).catch(()=>setPilotStaff([]));
    setTitle(ev.title);setLocation(ev.location||"");setOrganizer(ev.organizer||"TicketTreat");
    setCountryCode(ev.country_code||"");setCity(ev.city||"");
    setDescription(ev.description||"");setGallery((ev.external_gallery_urls||ev.gallery_urls||[]).filter(s=>!s.startsWith("/api/gateway/demo/events/")).join("\n"));setVideo(ev.video_url||"");setStartsAt(asLocal(ev.starts_at));
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
  useEffect(()=>{
    if(!Number.isInteger(eventId)||eventId<=0)return;
    // Read-only live counters for teams scanning on several devices.
    const timer=window.setInterval(()=>{
      if(document.visibilityState!=="visible")return;
      const token=getWebToken();if(!token)return;
      void getPilotInsights(token,eventId).then(setPilotInsights).catch(()=>{});
    },15000);
    return()=>window.clearInterval(timer);
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
  async function uploadPhotos(files: FileList|null) {
    const token=getWebToken();if(!token||!files?.length)return;
    setBusy(true);setError("");setNotice("");
    try {
      const current=event?.gallery_urls?.length||0;
      if(current+files.length>8)throw new Error("Не более 8 фотографий на мероприятие.");
      for(const file of Array.from(files)){
        if(file.size>2*1024*1024)throw new Error("Фотография должна быть меньше 2 МБ.");
        if(!["image/jpeg","image/png","image/webp"].includes(file.type))throw new Error("Нужны JPG, PNG или WebP.");
        const dataUrl=await posterData(file);
        await uploadManageGalleryPhoto(token,eventId,dataUrl);
      }
      await reload();
      setNotice("Фотографии добавлены.");
    }catch(e){setError(formattedError(e))}
    finally{setBusy(false)}
  }
  async function removePhoto(imageId:number){
    const token=getWebToken();if(!token)return;
    if(!window.confirm("Удалить фотографию из галереи?"))return;
    setBusy(true);setError("");setNotice("");
    try{
      await deleteManageGalleryPhoto(token,eventId,imageId);
      await reload();setNotice("Фотография удалена.");
    }catch(e){setError(formattedError(e))}
    finally{setBusy(false)}
  }
  async function manualCheckIn(ticketId:number){
    const token=getWebToken();if(!token)return;
    if(!window.confirm("Отметить участника как прошедшего без сканирования QR? Действие попадёт в журнал."))return;
    setBusy(true);setError("");setNotice("");
    try{const result=await checkInByList(token,eventId,ticketId);await reload();
      setNotice(result.status==="already_checked_in"?"Этот билет уже отмечен.":"Участник отмечен на входе.");}
    catch(e){setError(formattedError(e));}finally{setBusy(false);}
  }
  async function sendOperationalNotice(){
    const token=getWebToken();if(!token||!event||announcementText.trim().length<20)return;
    if(!window.confirm("Отправить важное сообщение всем подтверждённым владельцам действующих билетов?"))return;
    setBusy(true);setError("");setNotice("");
    try{const result=await sendEventAnnouncement(token,eventId,{
      category:announcementCategory,message:announcementText.trim()});
      setAnnouncementText("");await reload();
      setNotice(`Сообщение добавлено в очередь для ${result.eligible_verified_ticket_holders} участников.`);
    }catch(e){setError(formattedError(e));}
    finally{setBusy(false);}
  }
  async function savePilotPolicy(){
    const token=getWebToken();if(!token)return;
    setBusy(true);setError("");setNotice("");
    try{
      if(!pilotSettings.reminder_minutes.length||!reminderMessage.trim())throw new Error("Укажи расписание и текст напоминания.");
      await updatePilotSettings(token,eventId,{...pilotSettings,reminder_text:reminderMessage.trim()});
      await reload();setNotice("Расписание напоминаний и текст организатора сохранены.");
    }catch(e){setError(formattedError(e));}
    finally{setBusy(false);}
  }
  async function addCheckinStaff(){
    const token=getWebToken();if(!token||!staffEmail.trim())return;
    setBusy(true);setError("");
    try{await grantPilotStaff(token,eventId,staffEmail.trim());setStaffEmail("");await reload();
      setNotice("Доступ к сканированию билетов предоставлен.");}
    catch(e){setError(formattedError(e));}
    finally{setBusy(false);}
  }
  async function removeCheckinStaff(id:number){
    const token=getWebToken();if(!token||!window.confirm("Отозвать доступ к сканированию?"))return;
    setBusy(true);setError("");
    try{await revokePilotStaff(token,eventId,id);await reload();setNotice("Доступ отозван.");}
    catch(e){setError(formattedError(e));}
    finally{setBusy(false);}
  }
  async function updateMediaOrder(photoId:number,direction:-1|1|0){
    const token=getWebToken(),photos=[...(event?.uploaded_gallery||[])];
    if(!token||!photos.length)return;
    const index=photos.findIndex(p=>p.id===photoId);
    if(index<0)return;
    let cover=photos.find(p=>p.is_cover)?.id ?? photos[0].id;
    if(direction===0)cover=photoId;
    else{
      const other=index+direction;
      if(other<0||other>=photos.length)return;
      [photos[index],photos[other]]=[photos[other],photos[index]];
    }
    setBusy(true);setError("");
    try{await orderManageGallery(token,eventId,photos.map(p=>p.id),cover);
      await reload();setNotice("Галерея обновлена.");}
    catch(e){setError(formattedError(e));}
    finally{setBusy(false);}
  }
  async function publication(status:"draft"|"scheduled"|"published"){
    const token=getWebToken();if(!token||!event)return;
    if(status==="published"&&!window.confirm("Открыть мероприятие для всех и разрешить бесплатную регистрацию?"))return;
    if(status==="draft"&&!window.confirm("Снять мероприятие с публикации? Это возможно только без участников."))return;
    setBusy(true);setError("");setNotice("");
    try{
      const when=status==="scheduled" ? new Date(scheduleAt).toISOString() : undefined;
      await setManagePublication(token,eventId,{status,publish_at:when});
      await reload();
      setNotice(status==="published"?"Мероприятие опубликовано.":status==="scheduled"?"Публикация запланирована.":"Мероприятие сохранено как черновик.");
    }catch(e){setError(formattedError(e))}finally{setBusy(false)}
  }
  async function duplicate(){
    const token=getWebToken();if(!token||!event)return;
    if(!window.confirm("Создать закрытую копию этого ивента без участников и билетов?"))return;
    setBusy(true);setError("");setNotice("");
    try{
      const next=await duplicateManageEvent(token,eventId);
      router.push(`/admin/events/${next.id}`);
    }catch(e){setError(formattedError(e));setBusy(false)}
  }
  async function downloadPromotionQR(){
    if(!event||!event.publication?.visible)return;
    const url=window.location.origin+`/events/${eventId}`;
    const png=await QRCode.toDataURL(url,{width:960,margin:3,
      color:{dark:"#1E0A28",light:"#FFFFFF"}});
    const link=document.createElement("a");
    link.href=png;link.download=`tickettreat-event-${eventId}-qr.png`;
    link.click();
  }
  async function copyEventLink(){
    if(!event?.publication?.visible)return;
    try{await navigator.clipboard.writeText(window.location.origin+`/events/${eventId}`);setNotice("Публичная ссылка скопирована.");}
    catch{setError("Не удалось скопировать ссылку. Открой публичную страницу.")}
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
        <div><span className={event.is_cancelled?"status status-danger":"status status-demo"}>{event.is_cancelled?"CANCELLED":`${(event.publication?.status||"published").toUpperCase()} · #${event.id}`}</span>
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
        {!event.is_cancelled&&<button className="button button-outline" onClick={()=>setShowCancel(v=>!v)}>{tr("Отменить ивент")}</button>}
        <Link className="button button-outline" href={`/admin/events/${event.id}/preview`}>{tr("Предпросмотр ↗")}</Link>
        {event.publication?.visible&&<Link className="button button-outline" href={`/events/${event.id}`}>{tr("Публичная страница ↗")}</Link>}
        <button type="button" className="button button-outline" disabled={busy} onClick={duplicate}>{tr("Копировать ивент")}</button>
      </div>
      {!event.is_cancelled&&<section className="panel form-stack">
        <h2>{tr("Публикация мероприятия")}</h2>
        <p className="form-note">Статус: <strong>{event.publication?.status==="draft"?"Черновик":event.publication?.status==="scheduled"?"Запланировано":"Опубликовано"}</strong>. Новые ивенты скрыты до публикации. Публиковать можно только бесплатные будущие мероприятия с заполненными названием, описанием, адресом, городом и вместимостью.</p>
        {event.publication?.publish_at&&<p>Автопубликация: {new Date(event.publication.publish_at).toLocaleString("ru-RU")}</p>}
        <div className="admin-event-actions">
          {!event.publication?.visible&&<button type="button" className="button button-primary" disabled={busy} onClick={()=>publication("published")}>{tr("Опубликовать сейчас")}</button>}
          {event.publication?.visible&&<button type="button" className="button button-outline" disabled={busy} onClick={()=>publication("draft")}>{tr("Снять с публикации")}</button>}
        </div>
        {!event.publication?.visible&&<div className="tt-publication-schedule">
          <label>{tr("Опубликовать автоматически")}<input type="datetime-local" value={scheduleAt} onChange={e=>setScheduleAt(e.target.value)}/></label>
          <button type="button" className="button button-outline" disabled={busy||!scheduleAt} onClick={()=>publication("scheduled")}>{tr("Запланировать")}</button>
        </div>}
        {event.publication?.visible&&<div className="admin-event-actions">
          <button type="button" className="button button-outline" onClick={copyEventLink}>{tr("Копировать ссылку")}</button>
          <button type="button" className="button button-sun" onClick={()=>void downloadPromotionQR()}>{tr("Скачать QR для афиши")}</button>
        </div>}
      </section>}
      {showEdit&&!event.is_cancelled&&<form className="panel form-stack" onSubmit={saveChanges}>
        <h2>{tr("Редактировать информацию")}</h2>
        <label>{tr("Название")}<input value={title} required onChange={e=>setTitle(e.target.value)}/></label>
        <label>{tr("Организатор")}<input value={organizer} onChange={e=>setOrganizer(e.target.value)}/></label>
        <CountryCityFields countryCode={countryCode} city={city} onCountryChange={setCountryCode}
          onCityChange={setCity} language="ru" />
        <label>{tr("Адрес или место проведения")}<input value={location} onChange={e=>setLocation(e.target.value)}/></label>
        <label>{tr("Описание")}<textarea rows={5} value={description} onChange={e=>setDescription(e.target.value)}/></label>
        <label>{tr("Фото мероприятия (HTTPS, по одной ссылке на строку, до 8)")}<textarea rows={4} value={gallery} onChange={e=>setGallery(e.target.value)}/></label>
        <label>{tr("Видео (YouTube/Vimeo)")}<input type="url" value={video} onChange={e=>setVideo(e.target.value)} placeholder="https://www.youtube.com/watch?v=…"/></label>
        <div className="two-col"><label>Дата и время<input type="datetime-local" required value={startsAt} onChange={e=>setStartsAt(e.target.value)}/></label>
          <label>{tr("Количество мест")}<input type="number" min="1" value={capacity} onChange={e=>setCapacity(e.target.value)}/></label></div>
        <div className="two-col"><label>{tr("Цена")}<input type="number" min="0" step="0.01" value={price} onChange={e=>setPrice(e.target.value)}/></label>
          <label>{tr("Валюта")}<select value={currency} onChange={e=>setCurrency(e.target.value)}>
          <option>CZK</option><option>EUR</option><option>USD</option></select></label></div>
        <fieldset className="event-language-fieldset"><legend>{tr("Языки")}</legend>
        <div className="event-language-options">
          {([["en","🇬🇧 English"],["cs","🇨🇿 Čeština"],["ru","🇷🇺 Русский"],["uk","🇺🇦 Українська"]] as const).map(([id,label])=>
            <label key={id}><input type="checkbox" checked={languages.includes(id)}
              onChange={e=>setLanguages(s=>e.target.checked?[...s,id]:s.filter(x=>x!==id))}/>{label}</label>)}
        </div></fieldset>
        <label>{tr("Новый постер (необязательно)")}<input type="file" accept="image/png,image/jpeg,image/webp"
          onChange={e=>setPoster(e.target.files?.[0]||null)}/></label>
        {event.image_url&&<img src={event.image_url} alt="Event poster" className="event-poster-preview"/>}
        <button className="button button-primary" disabled={busy}>{busy?"Сохраняем…":"Сохранить изменения"}</button>
      </form>}
      {!event.is_cancelled&&<section className="panel form-stack">
        <h2>{tr("Фотогалерея мероприятия")}</h2>
        <p className="form-note">Загружай фотографии с прошлых мероприятий (JPG, PNG, WebP; до 2 МБ каждая, максимум 8 включая HTTPS-ссылки). Файлы сохраняются на сервере TicketTreat.</p>
        <label>Добавить фотографии
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy} onChange={e=>{void uploadPhotos(e.target.files);e.currentTarget.value="";}}/>
        </label>
        <div className="event-media-gallery">
          {(event.uploaded_gallery||[]).map((photo,i)=><div key={photo.id}>
            <img src={photo.url} alt="Фотография мероприятия" />
            <div className="admin-event-actions">
              <button type="button" className="button button-outline" disabled={busy||i===0}
                onClick={()=>updateMediaOrder(photo.id,-1)} aria-label="Переместить фото назад">↑</button>
              <button type="button" className="button button-outline" disabled={busy||i===(event.uploaded_gallery?.length||0)-1}
                onClick={()=>updateMediaOrder(photo.id,1)} aria-label="Переместить фото вперёд">↓</button>
              <button type="button" className="button button-outline" disabled={busy||photo.is_cover}
                onClick={()=>updateMediaOrder(photo.id,0)}>
                {photo.is_cover?"✓ Обложка":"Сделать обложкой"}</button>
              <button type="button" className="button button-outline" disabled={busy}
                onClick={()=>removePhoto(photo.id)}>{tr("Удалить")}</button>
            </div>
          </div>)}
        </div>
      </section>}
      {showCancel&&!event.is_cancelled&&<form className="panel form-stack" onSubmit={cancel}>
        <h2>{tr("Отмена ивента")}</h2>
        <p>Укажи причину отмены (обязательно). После отмены регистрация на ивент будет закрыта.</p>
        <label>{tr("Причина отмены")}<textarea required minLength={8} maxLength={1000} rows={4}
          value={reason} onChange={e=>setReason(e.target.value)} placeholder="Например: Организатор вынужден перенести мероприятие из-за…"/></label>
        <button className="button button-outline" disabled={busy||reason.trim().length<8}>{tr("Подтвердить отмену")}</button>
      </form>}
      {pilotInsights&&<section className="panel form-stack">
        <h2>{tr("Аналитика посещаемости")}</h2>
        <div className="stats-grid">
          <div className="stat-card"><strong>{pilotInsights.registered}</strong><span>{tr("Регистрации всего")}</span></div>
          <div className="stat-card"><strong>{pilotInsights.occupancy_percent??"—"}%</strong><span>{tr("Заполненность")}</span></div>
          <div className="stat-card"><strong>{pilotInsights.checked_in}</strong><span>{tr("Пришли по QR")}</span></div>
          <div className="stat-card"><strong>{pilotInsights.no_show??"—"}</strong><span>{pilotInsights.event_finished?"Итоговый no-show":"No-show после окончания"}</span></div>
          <div className="stat-card"><strong>{pilotInsights.waitlist}</strong><span>{tr("Ожидают места")}</span></div>
          <div className="stat-card"><strong>{pilotInsights.cancelled_tickets}</strong><span>{tr("Отмены")}</span></div>
        </div>
        <h3>{tr("Источники регистраций")}</h3>
        <div className="pilot-analytics-bars">
          {pilotInsights.channels.length?pilotInsights.channels.map(c=>
            <div className="pilot-bar-row" key={c.source}>
              <span>{c.source}</span><div className="pilot-bar-track"><div style={{
                width:`${100*c.registrations/Math.max(1,...pilotInsights.channels.map(v=>v.registrations))}%`
              }}/></div><strong>{c.registrations}</strong>
            </div>):<p>Пока нет данных по источникам.</p>}
        </div>
        <h3>{tr("Регистрации по дням (до 90 дат)")}</h3>
        {pilotInsights.daily_bookings.length===0?<p>{tr("Нет регистраций.")}</p>:
          <div className="pilot-analytics-bars">{pilotInsights.daily_bookings.map(day=>
            <div className="pilot-bar-row" key={day.date}><span>{day.date}</span>
              <div className="pilot-bar-track"><div style={{width:`${100*day.count/Math.max(1,...pilotInsights.daily_bookings.map(x=>x.count))}%`}}/></div>
              <strong>{day.count}</strong>
            </div>)}</div>}
        <p className="form-note">Старые записи Telegram учитываются во вместимости, но не во всех QR-метриках.</p>
      </section>}
      {!event.is_cancelled&&<section className="panel form-stack">
        <h2>{tr("Правила бесплатной регистрации")}</h2>
        <label>Закрыть регистрацию за N минут до начала (0 — до старта)
          <input type="number" min={0} max={10080}
            value={pilotSettings.signup_cutoff_minutes}
            onChange={e=>setPilotSettings(s=>({...s,signup_cutoff_minutes:Number(e.target.value)}))}/>
        </label>
        <ReminderEditor minutes={pilotSettings.reminder_minutes}
          onChange={value=>setPilotSettings(current=>({...current,reminder_minutes:value}))}
          message={reminderMessage} onMessageChange={setReminderMessage} language={language}/>
        <label>Продолжительность ивента (минуты для окончательной статистики no-show)
          <input type="number" min={15} max={1440} step={15} value={pilotSettings.event_duration_minutes||180}
            onChange={e=>setPilotSettings(s=>({...s,event_duration_minutes:Number(e.target.value)}))}/>
        </label>
        <label>Предложение места из waitlist
          <select value={pilotSettings.waitlist_offer_minutes||0}
            onChange={e=>setPilotSettings(s=>({...s,waitlist_offer_minutes:Number(e.target.value)}))}>
            <option value={0}>Автоматически выдавать билет (совместимый режим)</option>
            <option value={15}>Предложение на 15 минут</option>
            <option value={30}>Предложение на 30 минут</option>
            <option value={60}>Предложение на 1 час</option>
            <option value={120}>Предложение на 2 часа</option>
            <option value={1440}>Предложение на сутки</option>
          </select>
        </label>
        <p className="form-note">В режиме предложения место удерживается для следующего участника до принятия или истечения срока. Требуется включённый воркер истечения сроков в Railway.</p>
        <p className="form-note">Письма отправляются только подтверждённым владельцам билетов, после включения Resend. Пропущенные интервалы не рассылаются задним числом.</p>
        <button className="button button-primary" type="button" disabled={busy||!pilotSettings.reminder_minutes.length}
          onClick={savePilotPolicy}>{tr("Сохранить правила и напоминания")}</button>
      </section>}
      <section className="panel form-stack">
        <h2>{tr("Персонал для проверки билетов")}</h2>
        <p className="form-note">Можно назначить подтверждённый TicketTreat-аккаунт только на QR check-in этого мероприятия. Управление ивентом и экспорт участников остаются закрыты.</p>
        <label>{tr("Email сотрудника")}<input type="email" value={staffEmail} onChange={e=>setStaffEmail(e.target.value)} placeholder="staff@example.com"/></label>
        <button type="button" className="button button-outline" disabled={busy||!staffEmail.includes("@")} onClick={addCheckinStaff}>{tr("Выдать доступ")}</button>
        {pilotStaff.map(staff=><div className="participant-row" key={staff.account_id}>
          <div><strong>{staff.email}</strong><small>Аккаунт #{staff.account_id}</small></div>
          <button className="button button-outline" type="button" disabled={busy}
            onClick={()=>removeCheckinStaff(staff.account_id)}>{tr("Отозвать")}</button>
        </div>)}
      </section>
      <section className="panel form-stack">
        <h2>{tr("Уведомления участникам")}</h2>
        <Link href={`/admin/broadcasts?event_id=${eventId}`} className="button button-outline">📢 Рассылка участникам этого ивента →</Link>
        <p>С подтверждённым email и действующим билетом: <strong>{emailStatus?.verified_ticket_holders??"—"}</strong></p>
        <p className="form-note">{emailStatus?.email_enabled?
          "Отправка подключена. Зарегистрированные пользователи получают письма с билетами, напоминаниями и важными изменениями.":
          "Отправка отключена до подтверждения домена и настройки Resend. Новые письма пока не отправляются."}</p>
        {emailStatus&&<p className="form-note">Доставлено: {emailStatus.message_states.sent||0} · В очереди: {emailStatus.message_states.pending||0} · Ошибок: {emailStatus.message_states.failed||0}</p>}
        {!event.is_cancelled&&event.publication?.visible&&<section className="form-stack">
          <h3>{tr("Служебное сообщение по мероприятию")}</h3>
          <label>{tr("Тип уведомления")}<select value={announcementCategory} onChange={e=>
            setAnnouncementCategory(e.target.value as "access"|"logistics"|"schedule")}>
            <option value="access">{tr("Инструкция по входу")}</option>
            <option value="logistics">Как добраться / организационная информация</option>
            <option value="schedule">{tr("Уточнение программы")}</option>
          </select></label>
          <label>Текст для подтверждённых участников
            <textarea rows={4} maxLength={1000} minLength={20} value={announcementText}
              onChange={e=>setAnnouncementText(e.target.value)}
              placeholder="Например: Вход с боковой стороны здания. Покажите QR-билет на входе."/>
          </label>
          <button className="button button-outline" type="button"
            disabled={busy||announcementText.trim().length<20||!emailStatus?.email_enabled}
            onClick={sendOperationalNotice}>{tr("Отправить служебное сообщение")}</button>
          <small>Не более двух сообщений в сутки на ивент. Только действующие подтверждённые билеты, не маркетинговая рассылка.</small>
        </section>}
        <p className="form-note">Список адресов участников доступен через Export CSV. Рекламные массовые письма не отправляются без отдельного согласия.</p>
      </section>
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
              {ticket.ticket_status==="active"&&!ticket.checked_in_at&&<>
                <span className="status status-muted">Awaiting QR scan</span>
                <button className="button button-outline" type="button" disabled={busy}
                  onClick={()=>manualCheckIn(ticket.id)}>Отметить вручную</button>
              </>}
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
