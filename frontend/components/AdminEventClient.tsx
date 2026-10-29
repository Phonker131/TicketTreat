"use client";
import Link from "next/link";
import {useRouter} from "next/navigation";
import QRCode from "qrcode";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import {useLanguage} from "@/components/LanguageProvider";
import {eventAdminText} from "@/lib/event-admin-i18n";
import {userFacingError} from "@/lib/user-facing-errors";
import {localeForLanguage} from "@/lib/i18n";
import { ReminderEditor } from "@/components/ReminderEditor";
import {
  getManageMe,getManageEvent,getManageParticipants,getEventEmailStatus,
  editManageEvent,cancelManageEvent,exportManageParticipantsCsv,uploadManageGalleryPhoto,deleteManageGalleryPhoto,orderManageGallery,
  setManagePublication,duplicateManageEvent,
  checkInManagedTicket,listManageOrganizers,assignManageOwner,getManageAudit,
  getPilotInsights,getPilotSettings,updatePilotSettings,getPilotStaff,grantPilotStaff,revokePilotStaff,sendEventAnnouncement,checkInByList,
  getManagePaidReservations,decidePaidReservation,
} from "@/lib/api";
import { getWebToken } from "@/lib/session";
import type { AdminEventTickets,ManageEvent,ManageIdentity,OrganizerIdentity,LanguageCode } from "@/lib/types";
import type {EventEmailStatus,PilotInsights,PilotSettings,CheckinStaff,PaidReservation} from "@/lib/api";

function asLocal(value: string|null): string {
  if(!value)return "";
  return value.slice(0,16);
}
class LocalValidationError extends Error {}
function formattedError(e:unknown,language:LanguageCode):string {
  return e instanceof LocalValidationError ? e.message : userFacingError(e,language);
}
function posterData(file:File):Promise<string> {return new Promise((resolve,reject)=>{
  const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error("Poster read failed"));reader.readAsDataURL(file);
});}
export function AdminEventClient(){
  const {language}=useLanguage();
  const tr=(phrase:string)=>eventAdminText(language,phrase);
  const router=useRouter();
  const params=useParams<{id:string}>(),eventId=Number(params?.id);
  const [identity,setIdentity]=useState<ManageIdentity|null>(null);
  const [event,setEvent]=useState<ManageEvent|null>(null);
  const [data,setData]=useState<AdminEventTickets|null>(null);
  const [manualCode,setManualCode]=useState("");
  const [codeError,setCodeError]=useState("");
  function normalizePrintedTicketCode(raw:string):string {
    const normalized=raw.normalize("NFKC").toUpperCase().replace(/[\s-]+/g,"");
    // Ticket codes have a fixed alphabetic CRD prefix and numeric suffix.
    // Confusable O/0 and I/1 occur only within the numeric suffix.
    if(!normalized.startsWith("CRD"))return normalized;
    return "CRD"+normalized.slice(3).replace(/O/g,"0").replace(/I/g,"1");
  }

  const [emailStatus,setEmailStatus]=useState<EventEmailStatus|null>(null);
  const [pilotInsights,setPilotInsights]=useState<PilotInsights|null>(null);
  const [pilotSettings,setPilotSettings]=useState<PilotSettings>({signup_cutoff_minutes:0,reminder_minutes:[10080,1440,180],waitlist_offer_minutes:0,event_duration_minutes:180});
  const [pilotStaff,setPilotStaff]=useState<CheckinStaff[]>([]);
  const [paidReservations,setPaidReservations]=useState<PaidReservation[]>([]);
  const [staffEmail,setStaffEmail]=useState("");
  const [reminderMessage,setReminderMessage]=useState("Your TicketTreat event starts soon.");
  const [announcementCategory,setAnnouncementCategory]=useState<"access"|"logistics"|"schedule">("logistics");
  const [announcementText,setAnnouncementText]=useState("");
  const [organizers,setOrganizers]=useState<OrganizerIdentity[]>([]);
  const [audit,setAudit]=useState<{action:string;details:string;actor_account_id:number;at:string}[]>([]);
  const [error,setError]=useState(""),[notice,setNotice]=useState("");
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const [showEdit,setShowEdit]=useState(false),[showCancel,setShowCancel]=useState(false);
  const cancelDialogRef=useRef<HTMLDialogElement>(null);
  const [cancelError,setCancelError]=useState("");
  const [reason,setReason]=useState(""),[owner,setOwner]=useState("");
  const [scheduleAt,setScheduleAt]=useState("");
  const [poster,setPoster]=useState<File|null>(null);
  const [title,setTitle]=useState(""),[location,setLocation]=useState("");
  const [organizer,setOrganizer]=useState(""),[description,setDescription]=useState("");
  const [gallery,setGallery]=useState(""),[video,setVideo]=useState("");
  const [startsAt,setStartsAt]=useState(""),[capacity,setCapacity]=useState("30");
  const [price,setPrice]=useState("0"),[currency,setCurrency]=useState("CZK");
  const [paymentInstructions,setPaymentInstructions]=useState("");
  const [languages,setLanguages]=useState<LanguageCode[]>(["en","ru"]);
  async function reload(){
    const token=getWebToken();if(!token)throw new LocalValidationError(tr("Сначала войди в профиль."));
    const [me,ev,tickets]=await Promise.all([
      getManageMe(token),getManageEvent(eventId,token),getManageParticipants(token,eventId)
    ]);
    setIdentity(me);setEvent(ev);setData(tickets);
    if(Number(ev.price||0)>0){
      void getManagePaidReservations(token,eventId).then(r=>setPaidReservations(r.reservations)).catch(()=>setPaidReservations([]));
    }else setPaidReservations([]);
    setReminderMessage(ev.reminder_text||tr("Your TicketTreat event starts soon."));
    void getEventEmailStatus(token,eventId).then(setEmailStatus).catch(()=>setEmailStatus(null));
    void getPilotInsights(token,eventId).then(setPilotInsights).catch(()=>setPilotInsights(null));
    void getPilotSettings(token,eventId).then(setPilotSettings).catch(()=>{});
    void getPilotStaff(token,eventId).then(setPilotStaff).catch(()=>setPilotStaff([]));
    setTitle(ev.title);setLocation(ev.location||"");setOrganizer(ev.organizer||"TicketTreat");
    setDescription(ev.description||"");setGallery((ev.external_gallery_urls||ev.gallery_urls||[]).filter(s=>!s.startsWith("/api/gateway/demo/events/")).join("\n"));setVideo(ev.video_url||"");setStartsAt(asLocal(ev.starts_at));
    setCapacity(String(ev.max_participants??30));setPrice(String(ev.price??0));
    setCurrency(ev.currency||"CZK");setLanguages(ev.languages||[]);
    setPaymentInstructions(ev.payment_instructions||"");
    setOwner(ev.owner_account_id==null?"":String(ev.owner_account_id));
    if(me.role==="global_admin"){
      const [list,history]=await Promise.all([
        listManageOrganizers(token),getManageAudit(token,eventId)
      ]);
      setOrganizers(list);setAudit(history);
    }
  }
  useEffect(()=>{if(!eventId)return;let active=true;
    reload().catch(e=>{if(active)setError(formattedError(e,language));}).finally(()=>{if(active)setLoading(false);});
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
        if(poster.size>4*1024*1024)throw new LocalValidationError(tr("Постер больше 4 МБ"));
        if(!["image/jpeg","image/png","image/webp"].includes(poster.type))throw new LocalValidationError(tr("Формат постера — JPG, PNG или WebP."));
        image=await posterData(poster);
      }
      if(!languages.length)throw new LocalValidationError(tr("Выбери язык."));
      const payload:Record<string,unknown>={
        title:title.trim(),organizer:organizer.trim(),description,location,
        gallery_urls:gallery.split(/\r?\n/).map(s=>s.trim()).filter(Boolean),video_url:video.trim(),
        country_code:"CZ",city:"",
        max_participants:Number(capacity),price:String(price),
        payment_instructions:paymentInstructions.trim(),
        currency,starts_at:startsAt+":00",languages,
      };
      if(image)payload.poster_data_url=image;
      await editManageEvent(token,eventId,payload);
      await reload();setShowEdit(false);setPoster(null);
      setNotice(tr("Изменения сохранены."));
    }catch(e){setError(formattedError(e,language));}
    finally{setBusy(false);}
  }
  useEffect(()=>{
    const dialog=cancelDialogRef.current;
    if(!dialog)return;
    if(showCancel && !event?.is_cancelled){
      if(!dialog.open)dialog.showModal();
    }else if(dialog.open){
      dialog.close();
    }
  },[showCancel,event?.is_cancelled]);

  function openCancelDialog(){
    setReason("");
    setCancelError("");
    setShowCancel(true);
  }
  async function cancel(e:FormEvent) {
    e.preventDefault();
    if(busy)return;
    const token=getWebToken();
    if(!token){setCancelError(tr("Сессия завершилась. Войди в профиль и повтори попытку."));return;}
    if(reason.trim().length<8){
      setCancelError(tr("Причина отмены должна содержать не менее 8 символов."));
      return;
    }
    if(!window.confirm(tr("Окончательно отменить мероприятие? Регистрация закроется, активные билеты будут аннулированы. Уведомления подтверждённым участникам будут поставлены в очередь.")))return;
    setBusy(true);setCancelError("");setError("");setNotice("");
    try{
      await cancelManageEvent(token,eventId,reason.trim());
      setShowCancel(false);
      setNotice(tr("Мероприятие отменено. Регистрация закрыта, причина сохранена."));
      try{await reload();}catch(e){setError(tr("Мероприятие отменено, но не удалось обновить страницу: ")+formattedError(e,language));}
    }catch(e){
      setCancelError(formattedError(e,language));
    }finally{setBusy(false);}
  }
  async function assign(){
    const token=getWebToken();if(!token||!owner)return;
    setBusy(true);setError("");setNotice("");
    try{
      await assignManageOwner(token,eventId,Number(owner));
      await reload();setNotice(tr("Владелец ивента обновлён."));
    }catch(e){setError(formattedError(e,language));}finally{setBusy(false);}
  }
  async function decidePaid(id:number,action:"confirm"|"decline"){
    const token=getWebToken();if(!token)return;
    if(!window.confirm(action==="confirm"?
      tr("Подтверди только после фактического получения денег организатором. Выдать билет?"):
      tr("Отклонить заявку? Резерв места будет освобождён.")))return;
    setBusy(true);setError("");setNotice("");
    try{
      await decidePaidReservation(token,eventId,id,action);
      await reload();
      setNotice(action==="confirm"?tr("Оплата подтверждена, QR-билет выдан."):tr("Заявка отклонена, место освобождено."));
    }catch(e){setError(formattedError(e,language))}
    finally{setBusy(false)}
  }

  async function uploadPhotos(files: FileList|null) {
    const token=getWebToken();if(!token||!files?.length)return;
    setBusy(true);setError("");setNotice("");
    try {
      const current=event?.gallery_urls?.length||0;
      if(current+files.length>8)throw new LocalValidationError(tr("Не более 8 фотографий на мероприятие."));
      for(const file of Array.from(files)){
        if(file.size>2*1024*1024)throw new LocalValidationError(tr("Фотография должна быть меньше 2 МБ."));
        if(!["image/jpeg","image/png","image/webp"].includes(file.type))throw new LocalValidationError(tr("Нужны JPG, PNG или WebP."));
        const dataUrl=await posterData(file);
        await uploadManageGalleryPhoto(token,eventId,dataUrl);
      }
      await reload();
      setNotice(tr("Фотографии добавлены."));
    }catch(e){setError(formattedError(e,language))}
    finally{setBusy(false)}
  }
  async function removePhoto(imageId:number){
    const token=getWebToken();if(!token)return;
    if(!window.confirm(tr("Удалить фотографию из галереи?")))return;
    setBusy(true);setError("");setNotice("");
    try{
      await deleteManageGalleryPhoto(token,eventId,imageId);
      await reload();setNotice(tr("Фотография удалена."));
    }catch(e){setError(formattedError(e,language))}
    finally{setBusy(false)}
  }
  function admitByPrintedCode(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const code=normalizePrintedTicketCode(manualCode);
    if(!/^CRD[0-9]{6}$/.test(code)){
      setCodeError(language==="cs"?"Zadejte platný kód vstupenky, například CRD-000123.":language==="uk"?"Введіть код квитка, наприклад CRD-000123.":language==="en"?"Enter a ticket code such as CRD-000123.":"Введи код билета, например CRD-000123.");
      return;
    }
    const ticket=data?.tickets.find(item=>normalizePrintedTicketCode(item.code)===code);
    if(!ticket){
      setCodeError(language==="cs"?"Vstupenka nebyla pro tuto akci nalezena. Zkontrolujte kód.":language==="uk"?"Квиток не знайдено на цій події. Перевір код.":language==="en"?"No matching ticket for this event. Check the code.":"Билет этого ивента не найден. Проверь код.");
      return;
    }
    if(ticket.checked_in_at){
      setCodeError(language==="cs"?"Tato vstupenka již byla odbavena.":language==="uk"?"За цим квитком уже пройшли.":language==="en"?"This ticket has already been checked in.":"По этому билету уже прошли.");
      return;
    }
    if(ticket.ticket_status!=="active"){
      setCodeError(language==="cs"?"Vstupenka není aktivní.":language==="uk"?"Квиток неактивний.":language==="en"?"This ticket is not active.":"Билет неактивен.");
      return;
    }
    setCodeError("");
    void manualCheckIn(ticket.id);
  }
  async function manualCheckIn(ticketId:number){
    const token=getWebToken();if(!token)return;
    if(!window.confirm(tr("Отметить участника как прошедшего без сканирования QR? Действие попадёт в журнал.")))return;
    setBusy(true);setError("");setNotice("");
    try{const result=await checkInByList(token,eventId,ticketId);await reload();
      setNotice(result.status==="already_checked_in"?tr("Этот билет уже отмечен."):tr("Участник отмечен на входе."));}
    catch(e){setError(formattedError(e,language));}finally{setBusy(false);}
  }
  async function sendOperationalNotice(){
    const token=getWebToken();if(!token||!event||announcementText.trim().length<20)return;
    if(!window.confirm(tr("Отправить важное сообщение всем подтверждённым владельцам действующих билетов?")))return;
    setBusy(true);setError("");setNotice("");
    try{const result=await sendEventAnnouncement(token,eventId,{
      category:announcementCategory,message:announcementText.trim()});
      setAnnouncementText("");await reload();
      setNotice(`${tr("В очереди: ")}${result.eligible_notification_deliveries} ${tr("доставок через email и/или Telegram.")}`);
    }catch(e){setError(formattedError(e,language));}
    finally{setBusy(false);}
  }
  async function savePilotPolicy(){
    const token=getWebToken();if(!token)return;
    setBusy(true);setError("");setNotice("");
    try{
      if(!pilotSettings.reminder_minutes.length||!reminderMessage.trim())throw new LocalValidationError(tr("Укажи расписание и текст напоминания."));
      await updatePilotSettings(token,eventId,{...pilotSettings,reminder_text:reminderMessage.trim()});
      await reload();setNotice(tr("Расписание напоминаний и текст организатора сохранены."));
    }catch(e){setError(formattedError(e,language));}
    finally{setBusy(false);}
  }
  async function addCheckinStaff(){
    const token=getWebToken();if(!token||!staffEmail.trim())return;
    setBusy(true);setError("");
    try{await grantPilotStaff(token,eventId,staffEmail.trim());setStaffEmail("");await reload();
      setNotice(tr("Доступ к сканированию билетов предоставлен."));}
    catch(e){setError(formattedError(e,language));}
    finally{setBusy(false);}
  }
  async function removeCheckinStaff(id:number){
    const token=getWebToken();if(!token||!window.confirm(tr("Отозвать доступ к сканированию?")))return;
    setBusy(true);setError("");
    try{await revokePilotStaff(token,eventId,id);await reload();setNotice(tr("Доступ отозван."));}
    catch(e){setError(formattedError(e,language));}
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
      await reload();setNotice(tr("Галерея обновлена."));}
    catch(e){setError(formattedError(e,language));}
    finally{setBusy(false);}
  }
  async function publication(status:"draft"|"scheduled"|"published"){
    const token=getWebToken();if(!token||!event)return;
    if(status==="published"&&!window.confirm(tr("Открыть мероприятие для всех и разрешить бесплатную регистрацию?")))return;
    if(status==="draft"&&!window.confirm(tr("Снять мероприятие с публикации? Это возможно только без участников.")))return;
    setBusy(true);setError("");setNotice("");
    try{
      const when=status==="scheduled" ? new Date(scheduleAt).toISOString() : undefined;
      await setManagePublication(token,eventId,{status,publish_at:when});
      await reload();
      setNotice(status==="published"?tr("Мероприятие опубликовано."):status==="scheduled"?tr("Публикация запланирована."):tr("Мероприятие сохранено как черновик."));
    }catch(e){setError(formattedError(e,language))}finally{setBusy(false)}
  }
  async function duplicate(){
    const token=getWebToken();if(!token||!event)return;
    if(!window.confirm(tr("Создать закрытую копию этого ивента без участников и билетов?")))return;
    setBusy(true);setError("");setNotice("");
    try{
      const next=await duplicateManageEvent(token,eventId);
      router.push(`/admin/events/${next.id}`);
    }catch(e){setError(formattedError(e,language));setBusy(false)}
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
    try{await navigator.clipboard.writeText(window.location.origin+`/events/${eventId}`);setNotice(tr("Публичная ссылка скопирована."));}
    catch{setError(tr("Не удалось скопировать ссылку. Открой публичную страницу."))}
  }
  async function csv(){
    const token=getWebToken();if(!token)return;
    setBusy(true);try{await exportManageParticipantsCsv(token,eventId);}
    catch(e){setError(formattedError(e,language));}finally{setBusy(false);}
  }
  async function checkIn(qr:string){
    const token=getWebToken();if(!token)return;
    setBusy(true);setError("");
    try{await checkInManagedTicket(token,qr);await reload();setNotice(tr("Check-in выполнен."));}
    catch(e){setError(formattedError(e,language));}finally{setBusy(false);}
  }
  return <div className="app-shell"><AppHeader/><main className="page">
    <Link href="/admin" className="back-link">← Organizer dashboard</Link>
    {loading&&<div className="state-card">{tr("Загрузка…")}</div>}
    {error&&<div className="state-card state-error" role="alert">{error}</div>}
    {notice&&<div className="success-banner" role="status">{notice}</div>}
    {event&&identity&&<>
      <div className="admin-heading">
        <div><span className={event.is_cancelled?"status status-danger":"status status-demo"}>{event.is_cancelled?tr("Cancelled"):`${tr(event.publication?.status==="draft"?"Черновик":event.publication?.status==="scheduled"?"Запланировано":"Опубликовано")} · #${event.id}`}</span>
        <h1>{event.title}</h1><p>{event.location}</p></div>
        <div className="admin-event-actions">
          <button className="button button-outline" onClick={csv} disabled={busy}>{tr("↓ Export CSV")}</button>
          <Link className="button button-sun" href="/admin/check-in">{tr("Scan QR")}</Link>
        </div>
      </div>
      {event.is_cancelled&&<div className="state-card state-error"><strong>{tr("Причина отмены:")}</strong> {event.cancellation_reason||"—"}</div>}
      <div className="admin-event-actions" style={{marginBottom:18}}>
        {!event.is_cancelled&&<button className="button button-primary" onClick={()=>setShowEdit(v=>!v)}>
        {showEdit?tr("Закрыть"):tr("Редактировать ивент")}</button>}
        {!event.is_cancelled&&<button type="button" className="button button-outline" disabled={busy}
          onClick={openCancelDialog}>{tr("Отменить ивент")}</button>}
        <Link className="button button-outline" href={`/admin/events/${event.id}/preview`}>{tr("Предпросмотр ↗")}</Link>
        {event.publication?.visible&&<Link className="button button-outline" href={`/events/${event.id}`}>{tr("Публичная страница ↗")}</Link>}
        <button type="button" className="button button-outline" disabled={busy} onClick={duplicate}>{tr("Копировать ивент")}</button>
      </div>
      {!event.is_cancelled&&<section className="panel form-stack">
        <h2>{tr("Публикация мероприятия")}</h2>
        <p className="form-note">{tr("Статус:")} <strong>{event.publication?.status==="draft"?tr("Черновик"):event.publication?.status==="scheduled"?tr("Запланировано"):tr("Опубликовано")}</strong>. {tr("Новые ивенты скрыты до публикации. Для платных ивентов укажи инструкцию прямой оплаты организатору; подтверждение оплаченных заявок доступно ниже.")}</p>
        {event.publication?.publish_at&&<p>{tr("Автопубликация:")} {new Date(event.publication.publish_at).toLocaleString(localeForLanguage(language))}</p>}
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
        <label>{tr("Адрес или место проведения")}<input value={location} onChange={e=>setLocation(e.target.value)}/></label>
        <label>{tr("Описание")}<textarea rows={5} value={description} onChange={e=>setDescription(e.target.value)}/></label>
        <label>{tr("Фото мероприятия (HTTPS, по одной ссылке на строку, до 8)")}<textarea rows={4} value={gallery} onChange={e=>setGallery(e.target.value)}/></label>
        <label>{tr("Видео (YouTube/Vimeo)")}<input type="url" value={video} onChange={e=>setVideo(e.target.value)} placeholder="https://www.youtube.com/watch?v=…"/></label>
        <div className="two-col"><label>{tr("Дата и время")}<input type="datetime-local" required value={startsAt} onChange={e=>setStartsAt(e.target.value)}/></label>
          <label>{tr("Количество мест")}<input type="number" min="1" value={capacity} onChange={e=>setCapacity(e.target.value)}/></label></div>
        <div className="two-col"><label>{tr("Цена")}<input type="number" min="0" step="0.01" value={price} onChange={e=>setPrice(e.target.value)}/></label>
          <label>{tr("Валюта")}<select value={currency} onChange={e=>setCurrency(e.target.value)}>
          <option>CZK</option><option>EUR</option><option>USD</option></select></label></div>
        <label>{tr("Инструкция по оплате организатору (обязательно для платных мероприятий)")}
          <textarea value={paymentInstructions} maxLength={2000} rows={4} onChange={e=>setPaymentInstructions(e.target.value)} placeholder={tr("Способ и реквизиты прямого платежа, контакт организатора; TicketTreat платежи не принимает.")}/>
        </label>
        <fieldset className="event-language-fieldset"><legend>{tr("Языки")}</legend>
        <div className="event-language-options">
          {([["en","🇬🇧 English"],["cs","🇨🇿 Čeština"],["ru","🇷🇺 Русский"],["uk","🇺🇦 Українська"]] as const).map(([id,label])=>
            <label key={id}><input type="checkbox" checked={languages.includes(id)}
              onChange={e=>setLanguages(s=>e.target.checked?[...s,id]:s.filter(x=>x!==id))}/>{label}</label>)}
        </div></fieldset>
        <label>{tr("Новый постер (необязательно)")}<input type="file" accept="image/png,image/jpeg,image/webp"
          onChange={e=>setPoster(e.target.files?.[0]||null)}/></label>
        {event.image_url&&<img src={event.image_url} alt="Event poster" className="event-poster-preview"/>}
        <button className="button button-primary" disabled={busy}>{busy?tr("Сохраняем…"):"Сохранить изменения"}</button>
      </form>}
      {!event.is_cancelled&&<section className="panel form-stack">
        <h2>{tr("Фотогалерея мероприятия")}</h2>
        <p className="form-note">{tr("Загружай фотографии с прошлых мероприятий (JPG, PNG, WebP; до 2 МБ каждая, максимум 8 включая HTTPS-ссылки). Файлы сохраняются на сервере TicketTreat.")}</p>
        <label>{tr("Добавить фотографии")}
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy} onChange={e=>{void uploadPhotos(e.target.files);e.currentTarget.value="";}}/>
        </label>
        <div className="event-media-gallery">
          {(event.uploaded_gallery||[]).map((photo,i)=><div key={photo.id}>
            <img src={photo.url} alt={tr("Фотография мероприятия")} />
            <div className="admin-event-actions">
              <button type="button" className="button button-outline" disabled={busy||i===0}
                onClick={()=>updateMediaOrder(photo.id,-1)} aria-label={tr("Переместить фото назад")}>↑</button>
              <button type="button" className="button button-outline" disabled={busy||i===(event.uploaded_gallery?.length||0)-1}
                onClick={()=>updateMediaOrder(photo.id,1)} aria-label={tr("Переместить фото вперёд")}>↓</button>
              <button type="button" className="button button-outline" disabled={busy||photo.is_cover}
                onClick={()=>updateMediaOrder(photo.id,0)}>
                {photo.is_cover?tr("✓ Обложка"):tr("Сделать обложкой")}</button>
              <button type="button" className="button button-outline" disabled={busy}
                onClick={()=>removePhoto(photo.id)}>{tr("Удалить")}</button>
            </div>
          </div>)}
        </div>
      </section>}
      <dialog ref={cancelDialogRef} className="tt-event-cancel-dialog" aria-labelledby="tt-event-cancel-title"
        aria-describedby="tt-event-cancel-description" onClose={()=>setShowCancel(false)}>
        <form className="form-stack" onSubmit={cancel}>
          <span className="status status-danger">#{event.id} · {tr("Отмена ивента")}</span>
          <h2 id="tt-event-cancel-title">{tr("Отмена ивента")}</h2>
          <p id="tt-event-cancel-description">{tr("Ты собираешься отменить")} <strong>{event.title}</strong>. {tr("Новые регистрации закроются, действующие билеты будут аннулированы, а уведомления подтверждённым владельцам билетов будут поставлены в очередь.")} {tr("Это действие нельзя отменить через панель организатора.")}</p>
          <label>{tr("Причина отмены")} <span className="tt-cancel-required">{tr("(обязательно, минимум 8 символов)")}</span>
            <textarea required minLength={8} maxLength={1000} rows={4} autoFocus
              value={reason} onChange={e=>{setReason(e.target.value);setCancelError("");}}
              placeholder={tr("Например: Организатор вынужден отменить мероприятие из-за…")}/>
          </label>
          <small className="tt-cancel-counter">{reason.trim().length}/1000 {tr("символов")}</small>
          {cancelError&&<div className="state-card state-error" role="alert">{cancelError}</div>}
          <div className="tt-event-cancel-actions">
            <button type="button" className="button button-outline" disabled={busy}
              onClick={()=>setShowCancel(false)}>{tr("Закрыть")}</button>
            <button type="submit" className="button button-primary" disabled={busy||reason.trim().length<8}>
              {busy?tr("Отменяем мероприятие…"):tr("Подтвердить отмену")}
            </button>
          </div>
        </form>
      </dialog>
      {pilotInsights&&<section className="panel form-stack">
        <h2>{tr("Аналитика посещаемости")}</h2>
        <div className="stats-grid">
          <div className="stat-card"><strong>{pilotInsights.registered}</strong><span>{tr("Регистрации всего")}</span></div>
          <div className="stat-card"><strong>{pilotInsights.occupancy_percent??"—"}%</strong><span>{tr("Заполненность")}</span></div>
          <div className="stat-card"><strong>{pilotInsights.checked_in}</strong><span>{tr("Пришли по QR")}</span></div>
          <div className="stat-card"><strong>{pilotInsights.no_show??"—"}</strong><span>{pilotInsights.event_finished?tr("Итоговый no-show"):tr("No-show после окончания")}</span></div>
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
            </div>):<p>{tr("Пока нет данных по источникам.")}</p>}
        </div>
        <h3>{tr("Регистрации по дням (до 90 дат)")}</h3>
        {pilotInsights.daily_bookings.length===0?<p>{tr("Нет регистраций.")}</p>:
          <div className="pilot-analytics-bars">{pilotInsights.daily_bookings.map(day=>
            <div className="pilot-bar-row" key={day.date}><span>{day.date}</span>
              <div className="pilot-bar-track"><div style={{width:`${100*day.count/Math.max(1,...pilotInsights.daily_bookings.map(x=>x.count))}%`}}/></div>
              <strong>{day.count}</strong>
            </div>)}</div>}
        <p className="form-note">{tr("Старые записи Telegram учитываются во вместимости, но не во всех QR-метриках.")}</p>
      </section>}
      {!event.is_cancelled&&<section className="panel form-stack">
        <h2>{tr("Правила бесплатной регистрации")}</h2>
        <label>{tr("Закрыть регистрацию за N минут до начала (0 — до старта)")}
          <input type="number" min={0} max={10080}
            value={pilotSettings.signup_cutoff_minutes}
            onChange={e=>setPilotSettings(s=>({...s,signup_cutoff_minutes:Number(e.target.value)}))}/>
        </label>
        <ReminderEditor minutes={pilotSettings.reminder_minutes}
          onChange={value=>setPilotSettings(current=>({...current,reminder_minutes:value}))}
          message={reminderMessage} onMessageChange={setReminderMessage} language={language}/>
        <label>{tr("Продолжительность ивента (минуты для окончательной статистики no-show)")}
          <input type="number" min={15} max={1440} step={15} value={pilotSettings.event_duration_minutes||180}
            onChange={e=>setPilotSettings(s=>({...s,event_duration_minutes:Number(e.target.value)}))}/>
        </label>
        <label>{tr("Предложение места из waitlist")}
          <select value={pilotSettings.waitlist_offer_minutes||0}
            onChange={e=>setPilotSettings(s=>({...s,waitlist_offer_minutes:Number(e.target.value)}))}>
            <option value={0}>{tr("Автоматически выдавать билет (совместимый режим)")}</option>
            <option value={15}>{tr("Предложение на 15 минут")}</option>
            <option value={30}>{tr("Предложение на 30 минут")}</option>
            <option value={60}>{tr("Предложение на 1 час")}</option>
            <option value={120}>{tr("Предложение на 2 часа")}</option>
            <option value={1440}>{tr("Предложение на сутки")}</option>
          </select>
        </label>
        <p className="form-note">{tr("В режиме предложения место удерживается для следующего участника до принятия или истечения срока. Требуется включённый воркер истечения сроков в Railway.")}</p>
        <p className="form-note">{tr("Письма отправляются только подтверждённым владельцам билетов, после включения Resend. Пропущенные интервалы не рассылаются задним числом.")}</p>
        <button className="button button-primary" type="button" disabled={busy||!pilotSettings.reminder_minutes.length}
          onClick={savePilotPolicy}>{tr("Сохранить правила и напоминания")}</button>
      </section>}
      <section className="panel form-stack">
        <h2>{tr("Персонал для проверки билетов")}</h2>
        <p className="form-note">{tr("Можно назначить подтверждённый TicketTreat-аккаунт только на QR check-in этого мероприятия. Управление ивентом и экспорт участников остаются закрыты.")}</p>
        <label>{tr("Email сотрудника")}<input type="email" value={staffEmail} onChange={e=>setStaffEmail(e.target.value)} placeholder="staff@example.com"/></label>
        <button type="button" className="button button-outline" disabled={busy||!staffEmail.includes("@")} onClick={addCheckinStaff}>{tr("Выдать доступ")}</button>
        {pilotStaff.map(staff=><div className="participant-row" key={staff.account_id}>
          <div><strong>{staff.email}</strong><small>{tr("Аккаунт #")}{staff.account_id}</small></div>
          <button className="button button-outline" type="button" disabled={busy}
            onClick={()=>removeCheckinStaff(staff.account_id)}>{tr("Отозвать")}</button>
        </div>)}
      </section>
      <section className="panel form-stack">
        <h2>{tr("Уведомления участникам")}</h2>
        <Link href={`/admin/broadcasts?event_id=${eventId}`} className="button button-outline">{tr("📢 Рассылка участникам этого ивента →")}</Link>
        <p>{tr("С подтверждённым email и действующим билетом:")} <strong>{emailStatus?.verified_ticket_holders??"—"}</strong></p>
        <p className="form-note">{emailStatus?.email_enabled?
          tr("Отправка подключена. Зарегистрированные пользователи получают письма с билетами, напоминаниями и важными изменениями."):
          tr("Отправка отключена до подтверждения домена и настройки Resend. Новые письма пока не отправляются.")}</p>
        {emailStatus&&<>
          <div className="stats-grid" aria-label={tr("Статус служебных уведомлений")}>
            <div className="stat-card">
              <strong>✉️ Email</strong>
              <span>{tr("Доставлено провайдеру:")} {emailStatus.message_states.sent||0}</span>
              <span>{tr("В очереди:")} {emailStatus.message_states.pending||0} · {tr("Ошибок:")} {emailStatus.message_states.failed||0}</span>
            </div>
            <div className="stat-card">
              <strong>✈️ Telegram</strong>
              <span>{tr("Зарегистрированных получателей:")} {emailStatus.telegram_recipients??0}</span>
              <span>{tr("Отправлено:")} {emailStatus.telegram_message_states?.sent||0} · {tr("В очереди:")} {emailStatus.telegram_message_states?.pending||0} · {tr("Ошибок:")} {emailStatus.telegram_message_states?.failed||0}</span>
              <span>{emailStatus.telegram_enabled?tr("Канал подключён. Напоминания отправляются по расписанию."):tr("Канал сейчас не настроен.")}</span>
            </div>
          </div>
          <p className="form-note">{tr("В Telegram бот может написать только тем, кто ранее открыл чат с TicketTreat. Подтверждения входа и пароли по этому каналу не отправляются.")}</p>
        </>}
        {!event.is_cancelled&&event.publication?.visible&&<section className="form-stack">
          <h3>{tr("Служебное сообщение по мероприятию")}</h3>
          <label>{tr("Тип уведомления")}<select value={announcementCategory} onChange={e=>
            setAnnouncementCategory(e.target.value as "access"|"logistics"|"schedule")}>
            <option value="access">{tr("Инструкция по входу")}</option>
            <option value="logistics">{tr("Как добраться / организационная информация")}</option>
            <option value="schedule">{tr("Уточнение программы")}</option>
          </select></label>
          <label>{tr("Текст для подтверждённых участников")}
            <textarea rows={4} maxLength={1000} minLength={20} value={announcementText}
              onChange={e=>setAnnouncementText(e.target.value)}
              placeholder={tr("Например: Вход с боковой стороны здания. Покажите QR-билет на входе.")}/>
          </label>
          <button className="button button-outline" type="button"
            disabled={busy||announcementText.trim().length<20||!emailStatus?.email_enabled}
            onClick={sendOperationalNotice}>{tr("Отправить служебное сообщение")}</button>
          <small>{tr("Не более двух сообщений в сутки на ивент. Только действующие подтверждённые билеты, не маркетинговая рассылка.")}</small>
        </section>}
        <p className="form-note">{tr("Список адресов участников доступен через Export CSV. Рекламные массовые письма не отправляются без отдельного согласия.")}</p>
      </section>
      {identity.role==="global_admin"&&<section className="panel form-stack">
        <h2>{tr("Глобальная модерация")}</h2>
        <p>{tr("Владелец ивента:")} {event.owner_account_id==null?tr("не назначен"):`${tr("Аккаунт #")}${event.owner_account_id}`}</p>
        <label>{tr("Назначить организатора")}
          <select value={owner} onChange={e=>setOwner(e.target.value)}>
          <option value="">{tr("Выбери организатора")}</option>
          {organizers.map(x=><option key={x.account_id} value={x.account_id}>{x.name} ({x.email})</option>)}
          </select>
        </label>
        <button type="button" className="button button-primary" disabled={busy||!owner} onClick={assign}>{tr("Сохранить владельца")}</button>
        <h3>{tr("История модерации")}</h3>
        {!audit.length&&<small>{tr("Нет действий")}</small>}
        {audit.map((a,i)=><div className="participant-row" key={i}>
          <div><strong>{a.action}</strong><small>{tr("Организатор")} #{a.actor_account_id}</small><small>{a.details}</small></div>
          <small>{new Date(a.at).toLocaleString(localeForLanguage(language))}</small>
        </div>)}
      </section>}
      {Number(event.price||0)>0&&<section className="panel form-stack">
        <h2>{tr("Заявки на платное мероприятие — подтверждение в течение 24 часов")}</h2>
        <p className="form-note">{tr("Деньги поступают напрямую организатору. Подтверждай заявку только после проверки фактического поступления. До подтверждения QR-билет не выдаётся. Не подтверждённые заявки автоматически истекают через 24 часа.")}</p>
        {!paidReservations.length&&<p>{tr("Заявок пока нет.")}</p>}
        {paidReservations.map(r=><div className="participant-row" key={r.id}>
          <div>
            <strong>{r.guest?.first_name||tr("Участник")} {r.guest?.last_name||""}</strong>
            <small>{r.guest?.email||"—"}</small>
            <small>{tr("Заявка #")}{r.id} · {r.status==="pending"?tr("Ожидает оплаты"):r.status==="confirmed"?tr("Подтверждено"):r.status==="expired"?tr("Истекло"):tr("Отклонено")}</small>
            <small>{r.status==="pending"?tr("Крайний срок: "):tr("Дата истечения: ")}{new Date(r.expires_at).toLocaleString(localeForLanguage(language))}</small>
          </div>
          <div className="participant-actions">
            {r.status==="pending"&&<>
              <button type="button" className="button button-primary" disabled={busy} onClick={()=>void decidePaid(r.id,"confirm")}>{tr("Подтвердить оплату")}</button>
              <button type="button" className="button button-outline" disabled={busy} onClick={()=>void decidePaid(r.id,"decline")}>{tr("Отклонить")}</button>
            </>}
            {r.status!=="pending"&&<span className="status">{tr(r.status==="confirmed"?"Подтверждено":r.status==="expired"?"Истекло":"Отклонено")}</span>}
          </div>
        </div>)}
      </section>}
      {data&&<>
        <div className="stats-grid">
          <div className="stat-card"><strong>{data.tickets.filter(t=>t.ticket_status==="active").length}</strong><span>{tr("Билеты")}</span></div>
          <div className="stat-card"><strong>{data.tickets.filter(t=>t.checked_in_at).length}</strong><span>{tr("Checked in")}</span></div>
          <div className="stat-card"><strong>{data.waitlist.filter(w=>w.status==="waiting").length}</strong><span>{tr("Waitlist")}</span></div>
        </div>
        <section className="panel">
          <h2>{tr("Участники")}</h2>
          <form onSubmit={admitByPrintedCode} className="tt-printed-code-form">
            <label htmlFor="tt-printed-code">{language==="cs"?"Přijmout podle kódu":language==="uk"?"Прийняти за кодом":language==="en"?"Admit by ticket code":"Принять по коду"}</label>
            <div className="tt-printed-code-inputs">
              <input id="tt-printed-code" type="text" autoCapitalize="characters" autoComplete="off" spellCheck={false}
                placeholder="CRD-000123" maxLength={32} value={manualCode} onChange={event=>{setManualCode(event.target.value);setCodeError("");}}/>
              <button className="button button-primary" type="submit" disabled={busy||!manualCode.trim()}>
                {language==="cs"?"Přijmout vstupenku":language==="uk"?"Прийняти квиток":language==="en"?"Admit ticket":"Принять билет"}
              </button>
            </div>
            <small>{language==="cs"?"Mezery, velikost písmen a záměny O/0, I/1 nevadí.":language==="uk"?"Пробіли, регістр і плутанина O/0, I/1 не заважають.":language==="en"?"Spaces, letter case and O/0 or I/1 do not matter.":"Пробелы, регистр и путаница O/0 или I/1 не мешают."}</small>
            {codeError&&<p className="tt-code-error" role="alert">{codeError}</p>}
          </form>
          <div className="participant-list">
          {!data.tickets.length&&<p>{tr("Пока нет билетов.")}</p>}
          {data.tickets.map(ticket=><div className="participant-row" key={ticket.id}>
            <div><strong>{ticket.guest?.first_name} {ticket.guest?.last_name}</strong>
              <small>{ticket.guest?.email}</small><small>{ticket.code} · {ticket.payment_status === "paid"?tr("Paid"):ticket.payment_status === "not_required"?tr("Free"):ticket.payment_status === "pending"?tr("Ожидает оплаты"):ticket.payment_status}</small></div>
            <div className="participant-actions">
              <span className={ticket.checked_in_at?"status status-success":"status status-demo"}>
                {ticket.ticket_status==="cancelled"?tr("Cancelled"):ticket.checked_in_at?tr("Checked in"):tr("Paid")}</span>
              {ticket.ticket_status==="active"&&!ticket.checked_in_at&&<>
                <span className="status status-muted">{tr("Awaiting QR scan")}</span>
                <button className="button button-outline" type="button" disabled={busy}
                  onClick={()=>manualCheckIn(ticket.id)}>{tr("Отметить вручную")}</button>
              </>}
            </div>
          </div>)}
        </div></section>
        <section className="panel"><h2>{tr("Лист ожидания")}</h2>
          {!data.waitlist.length&&<p>{tr("Пока пусто.")}</p>}
          {data.waitlist.filter(w=>w.status==="waiting").map(w=><div key={w.id} className="participant-row">
            <strong>{w.guest.first_name} {w.guest.last_name}</strong><span className="status status-muted">{tr("Waiting")}</span>
          </div>)}
        </section>
      </>}
    </>}
  </main></div>;
}
