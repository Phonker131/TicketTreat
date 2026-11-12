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
  editManageEvent,cancelManageEvent,deleteManageEvent,exportManageParticipantsCsv,uploadManageGalleryPhoto,deleteManageGalleryPhoto,orderManageGallery,
  setManagePublication,setManageVisibility,duplicateManageEvent,
  checkInManagedTicket,listManageOrganizers,assignManageOwner,getManageAudit,
  getPilotInsights,getPilotSettings,updatePilotSettings,getPilotStaff,grantPilotStaff,revokePilotStaff,sendEventAnnouncement,checkInByList,
  removeManageParticipant,removeManageWaitlistGuest,
} from "@/lib/api";
import { getWebToken } from "@/lib/session";
import type { AdminEventTickets,ManageEvent,ManageIdentity,OrganizerIdentity,LanguageCode } from "@/lib/types";
import {EVENT_TAGS,TAG_LABELS,TagIcon,isEventTag,type EventTag} from "@/lib/event-tags";
import type {EventEmailStatus,PilotInsights,PilotSettings,CheckinStaff} from "@/lib/api";

type Tab="overview"|"details"|"media"|"guests"|"notify"|"analytics"|"moderation";
const TABS:Tab[]=["overview","details","media","guests","notify","analytics","moderation"];
const TAB_WORDS:Record<LanguageCode,Record<Tab,string>>={
  ru:{overview:"Обзор",details:"Описание",media:"Фото",guests:"Гости",notify:"Напоминания",analytics:"Аналитика",moderation:"Модерация"},
  en:{overview:"Overview",details:"Details",media:"Photos",guests:"Guests",notify:"Reminders",analytics:"Analytics",moderation:"Moderation"},
  cs:{overview:"Přehled",details:"Údaje",media:"Fotky",guests:"Hosté",notify:"Připomínky",analytics:"Analytika",moderation:"Moderace"},
  uk:{overview:"Огляд",details:"Опис",media:"Фото",guests:"Гості",notify:"Нагадування",analytics:"Аналітика",moderation:"Модерація"},
};
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
  type RemoveTarget={kind:"ticket"|"waitlist";id:number;name:string;paid:boolean};
  const [removeTarget,setRemoveTarget]=useState<RemoveTarget|null>(null);
  const [removeReason,setRemoveReason]=useState("");
  const [manualPaymentReviewConfirmed,setManualPaymentReviewConfirmed]=useState(false);
  const [removeError,setRemoveError]=useState("");
  const removeDialogRef=useRef<HTMLDialogElement>(null);
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
  const [staffEmail,setStaffEmail]=useState("");
  const [reminderMessage,setReminderMessage]=useState("Your TicketTreat event starts soon.");
  const [announcementCategory,setAnnouncementCategory]=useState<"access"|"logistics"|"schedule">("logistics");
  const [announcementText,setAnnouncementText]=useState("");
  const [organizers,setOrganizers]=useState<OrganizerIdentity[]>([]);
  const [audit,setAudit]=useState<{action:string;details:string;actor_account_id:number;at:string}[]>([]);
  const [error,setError]=useState(""),[notice,setNotice]=useState("");
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const [showCancel,setShowCancel]=useState(false);
  const [tab,setTab]=useState<Tab>("overview");
  useEffect(()=>{const hash=window.location.hash.slice(1);if((TABS as string[]).includes(hash))setTab(hash as Tab)},[]);
  // On phones the tab strip scrolls sideways; keep the active tab in view.
  useEffect(()=>{document.querySelector('.tp-tabs [aria-selected="true"]')?.scrollIntoView({block:"nearest",inline:"center"})},[tab]);
  const pickTab=(next:Tab)=>{setTab(next);window.history.replaceState(null,"","#"+next)};
  const cancelDialogRef=useRef<HTMLDialogElement>(null);
  const [cancelError,setCancelError]=useState("");
  const [reason,setReason]=useState(""),[owner,setOwner]=useState("");
  const [scheduleDate,setScheduleDate]=useState("");
  const [scheduleTime,setScheduleTime]=useState("");
  const scheduleAt=scheduleDate&&scheduleTime?`${scheduleDate}T${scheduleTime}`:"";
  const [poster,setPoster]=useState<File|null>(null);
  const [title,setTitle]=useState(""),[location,setLocation]=useState("");
  const [organizer,setOrganizer]=useState(""),[description,setDescription]=useState("");
  const [gallery,setGallery]=useState(""),[video,setVideo]=useState("");
  const [startsAt,setStartsAt]=useState(""),[capacity,setCapacity]=useState("30");
  const [price,setPrice]=useState("0"),[currency,setCurrency]=useState("CZK");
  const [languages,setLanguages]=useState<LanguageCode[]>(["en","ru"]);
  const [venueUrl,setVenueUrl]=useState("");
  const [tags,setTags]=useState<EventTag[]>([]);
  async function reload(){
    const token=getWebToken();if(!token)throw new LocalValidationError(tr("Сначала войди в профиль."));
    const [me,ev,tickets]=await Promise.all([
      getManageMe(token),getManageEvent(eventId,token),getManageParticipants(token,eventId)
    ]);
    setIdentity(me);setEvent(ev);setData(tickets);
    setReminderMessage(ev.reminder_text||tr("Your TicketTreat event starts soon."));
    void getEventEmailStatus(token,eventId).then(setEmailStatus).catch(()=>setEmailStatus(null));
    void getPilotInsights(token,eventId).then(setPilotInsights).catch(()=>setPilotInsights(null));
    void getPilotSettings(token,eventId).then(setPilotSettings).catch(()=>{});
    void getPilotStaff(token,eventId).then(setPilotStaff).catch(()=>setPilotStaff([]));
    setTitle(ev.title);setLocation(ev.location||"");setOrganizer(ev.organizer||"TicketTreat");
    setDescription(ev.description||"");setGallery((ev.external_gallery_urls||ev.gallery_urls||[]).filter(s=>!s.startsWith("/api/gateway/demo/events/")).join("\n"));setVideo(ev.video_url||"");setStartsAt(asLocal(ev.starts_at));
    setCapacity(String(ev.max_participants??30));setPrice(String(ev.price??0));
    setCurrency(ev.currency||"CZK");setLanguages(ev.languages||[]);
    setVenueUrl(ev.venue_url||"");setTags((ev.tags||[]).filter(isEventTag));
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
        max_participants:Number(capacity),
        price:String(price),currency,
        starts_at:startsAt+":00",languages,
        venue_url:venueUrl.trim(),tags,
      };
      if(image)payload.poster_data_url=image;
      await editManageEvent(token,eventId,payload);
      await reload();setPoster(null);
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
  async function removeUnusedEvent(){
    if(busy||!event)return;
    const title=event.title,id=event.id;
    const question=language==="ru"
      ?`Безвозвратно удалить мероприятие «${title}» (#${id}) из базы и всех списков? Удаление возможно только без регистраций, билетов, платежей и истории уведомлений.`
      :language==="cs"
      ?`Trvale smazat akci „${title}“ (#${id}) z databáze a všech seznamů? Lze smazat pouze akci bez registrací, vstupenek, plateb a historie oznámení.`
      :language==="uk"
      ?`Назавжди видалити подію «${title}» (#${id}) з бази та всіх списків? Видалення можливе лише без реєстрацій, квитків, платежів і сповіщень.`
      :`Permanently remove “${title}” (#${id}) from the database and all event lists? Only events without registration, ticket, payment or notification history can be deleted.`;
    if(!window.confirm(question))return;
    const prompt=language==="ru"?`Для подтверждения введи ID мероприятия: ${id}`:
      language==="cs"?`Pro potvrzení zadejte ID akce: ${id}`:
      language==="uk"?`Для підтвердження введи ID події: ${id}`:
      `Type the event ID to confirm permanent deletion: ${id}`;
    if(window.prompt(prompt)!==String(id))return;
    const token=getWebToken();
    if(!token){setError(tr("Сессия завершилась. Войди в профиль и повтори попытку."));return;}
    setBusy(true);setError("");setNotice("");
    try{
      await deleteManageEvent(token,id);
      router.replace("/admin");
    }catch(e){
      setError(formattedError(e,language));
      setBusy(false);
    }
  }
  async function assign(){
    const token=getWebToken();if(!token||!owner)return;
    setBusy(true);setError("");setNotice("");
    try{
      await assignManageOwner(token,eventId,Number(owner));
      await reload();setNotice(tr("Владелец ивента обновлён."));
    }catch(e){setError(formattedError(e,language));}finally{setBusy(false);}
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
  function askRemoveParticipant(kind:"ticket"|"waitlist",id:number,name:string,paid=false){
    setRemoveTarget({kind,id,name,paid});
    setRemoveReason("");setManualPaymentReviewConfirmed(false);setRemoveError("");
    window.requestAnimationFrame(()=>{if(!removeDialogRef.current?.open)removeDialogRef.current?.showModal();});
  }
  async function confirmRemoveParticipant(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!removeTarget||removeReason.trim().length<8||(removeTarget.paid&&!manualPaymentReviewConfirmed))return;
    const token=getWebToken();
    if(!token){setRemoveError(tr("Сессия завершилась. Войди в профиль и повтори попытку."));return;}
    setBusy(true);setRemoveError("");setError("");setNotice("");
    try{
      const result=removeTarget.kind==="ticket"
        ?await removeManageParticipant(token,eventId,removeTarget.id,removeReason.trim(),removeTarget.paid&&manualPaymentReviewConfirmed)
        :await removeManageWaitlistGuest(token,eventId,removeTarget.id,removeReason.trim());
      removeDialogRef.current?.close();
      setRemoveTarget(null);setRemoveReason("");setManualPaymentReviewConfirmed(false);
      await reload();
      setNotice(language==="cs"
        ?result.promoted_ticket_id?"Registrace zrušena a místo bylo uvolněno dalšímu hostovi.":"Host byl odebrán z akce."
        :language==="en"
        ?result.promoted_ticket_id?"Registration cancelled; a waiting guest received the free spot.":"Participant removed from the event."
        :language==="uk"
        ?result.promoted_ticket_id?"Реєстрацію скасовано, вільне місце передано наступному гостю.":"Учасника видалено з події."
        :result.promoted_ticket_id?"Регистрация отменена, свободное место передано следующему гостю.":"Участник отписан от мероприятия.");
      if(result.manual_payment_followup_required)setNotice(
        language==="cs"?"Vstupenka zrušena. Zkontrolujte platbu a případné vrácení peněz přímo s hostem; TicketTreat peníze nevrací automaticky."
        :language==="en"?"Ticket cancelled. Review the payment and any refund directly with the guest; TicketTreat does not automatically refund money."
        :language==="uk"?"Квиток скасовано. Перевірте оплату й можливе повернення коштів напряму з гостем; TicketTreat не повертає гроші автоматично."
        :"Билет отменён. Проверь оплату и возможный возврат напрямую с гостем; TicketTreat не возвращает деньги автоматически.");
    }catch(cause){setRemoveError(formattedError(cause,language));}
    finally{setBusy(false);}
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
  async function changeVisibility(visibility:"public"|"link_only"){
    if(!event||event.visibility===visibility)return;
    if(!window.confirm(visibility==="public"?
      (language==="ru"?"Сделать мероприятие доступным всем и показать в каталоге?":language==="cs"?"Zveřejnit událost v katalogu?":language==="uk"?"Показати подію всім у каталозі?":"Make this event public and list it in the catalog?"):
      (language==="ru"?"Скрыть мероприятие из каталога и открыть только по новой секретной ссылке?":language==="cs"?"Skrýt akci v katalogu a přístup povolit pouze přes nový odkaz?":language==="uk"?"Приховати подію з каталогу та відкрити лише за новим посиланням?":"Hide from the catalog and require a new invitation link?")))return;
    const token=getWebToken();if(!token)return;
    setBusy(true);setError("");setNotice("");
    try{await setManageVisibility(token,eventId,visibility);await reload();
      setNotice(visibility==="link_only"?
        (language==="ru"?"Закрытый доступ включён. Скопируй ссылку-приглашение ниже.":"Invitation-only access enabled. Copy the private link below."):
        (language==="ru"?"Мероприятие стало публичным.":"Event is now public."));
    }catch(e){setError(formattedError(e,language))}finally{setBusy(false)}
  }
  async function publication(status:"draft"|"scheduled"|"published"){
    const token=getWebToken();if(!token||!event)return;
    if(status==="published"&&!window.confirm(event.visibility==="link_only"?
      (language==="ru"?"Открыть регистрацию только по ссылке-приглашению?":"Allow registration only via the invitation link?"):
      tr("Открыть мероприятие для всех и разрешить бесплатную регистрацию?")))return;
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
    const url=event.visibility==="link_only"?event.invite_url:window.location.origin+`/events/${eventId}`;
    if(!url)return;
    const png=await QRCode.toDataURL(url,{width:960,margin:3,
      color:{dark:"#1E0A28",light:"#FFFFFF"}});
    const link=document.createElement("a");
    link.href=png;link.download=`tickettreat-event-${eventId}-qr.png`;
    link.click();
  }
  async function copyEventLink(){
    if(!event?.publication?.visible)return;
    const url=event.visibility==="link_only"?event.invite_url:window.location.origin+`/events/${eventId}`;
    if(!url)return;
    try{await navigator.clipboard.writeText(url);setNotice(event.visibility==="link_only"?
      (language==="ru"?"Секретная ссылка-приглашение скопирована.":"Private invite link copied."):tr("Публичная ссылка скопирована."));}
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
    try{
      const result=await checkInManagedTicket(token,qr,eventId);
      await reload();
      setNotice(result.status==="already_checked_in"
        ?tr("Этот билет уже отмечен.")
        :tr("Check-in выполнен."));
    }
    catch(e){setError(formattedError(e,language));}finally{setBusy(false);}
  }
  return <div className="app-shell"><AppHeader/><main className="page">
    <Link href="/admin" className="back-link">← Organizer dashboard</Link>
    {loading&&<div className="state-card">{tr("Загрузка…")}</div>}
    {error&&<div className="state-card state-error" role="alert">{error}</div>}
    {notice&&<div className="success-banner" role="status">{notice}</div>}
    {event&&identity&&<>
      <div className="admin-heading tp-event-head">
        <div><span className={event.is_cancelled?"status status-danger":"status status-demo"}>{event.is_cancelled?tr("Cancelled"):`${tr(event.publication?.status==="draft"?"Черновик":event.publication?.status==="scheduled"?"Запланировано":"Опубликовано")} · #${event.id}`}</span>
        <h1>{event.title}</h1><p>{event.location}</p></div>
      </div>
      {event.is_cancelled&&<div className="state-card state-error"><strong>{tr("Причина отмены:")}</strong> {event.cancellation_reason||"—"}</div>}
      <div className="tp-tabs" role="tablist" aria-label={TAB_WORDS[language].overview}>
        {TABS.filter(t=>t!=="moderation"||identity.role==="global_admin").map(t=><button key={t} type="button" role="tab" aria-selected={tab===t} onClick={()=>pickTab(t)}>
          {TAB_WORDS[language][t]}
          {t==="guests"&&data&&<b className="tp-badge">{data.tickets.filter(x=>x.ticket_status==="active").length}</b>}
        </button>)}
      </div>
      {tab==="overview"&&<div className="tp-tabpanel">
      <div className="tp-quick">
        <div><strong>{event.registered_count??0}{event.max_participants?` / ${event.max_participants}`:""}</strong><span>{tr("Регистрации всего")}</span></div>
        <div><strong>{data?data.tickets.filter(t=>t.checked_in_at).length:"—"}</strong><span>{tr("Пришли по QR")}</span></div>
        <div><strong>{data?data.waitlist.filter(w=>w.status==="waiting").length:"—"}</strong><span>{tr("Ожидают места")}</span></div>
        <div><strong>{asLocal(event.starts_at).replace("T"," ")||"—"}</strong><span>{tr("Дата и время")}</span></div>
      </div>
      <section className="tt-admin-event-toolbar" aria-label={language==="cs"?"Správa akce":language==="ru"?"Управление мероприятием":language==="uk"?"Керування подією":"Event management actions"}>
        <div className="tt-admin-event-toolbar-primary">
          {!event.is_cancelled&&<button type="button" className="button button-primary" disabled={busy} onClick={()=>pickTab("details")}>
            {tr("Редактировать ивент")}
          </button>}
          <Link className="button button-outline" href={`/admin/events/${event.id}/preview`}>{tr("Предпросмотр ↗")}</Link>
          {event.publication?.visible&&<Link className="button button-outline" href={event.invite_url||`/events/${event.id}`}>{language==="ru"?"Страница мероприятия ↗":language==="cs"?"Stránka akce ↗":language==="uk"?"Сторінка події ↗":"Event page ↗"}</Link>}
          <button type="button" className="button button-outline" disabled={busy} onClick={duplicate}>{tr("Копировать ивент")}</button>
        </div>
        <div className="tt-admin-event-toolbar-secondary">
          <button type="button" className="button button-outline" onClick={csv} disabled={busy}>{tr("↓ Export CSV")}</button>
          <Link className="button button-sun" href="/admin/check-in">{tr("Scan QR")}</Link>
          {!event.is_cancelled&&<button type="button" className="button button-outline" disabled={busy} onClick={openCancelDialog}>{tr("Отменить ивент")}</button>}
          <button type="button" className="button button-outline tt-admin-event-delete" disabled={busy}
            onClick={()=>void removeUnusedEvent()}>
            {language==="ru"?"Удалить мероприятие":language==="cs"?"Smazat akci":language==="uk"?"Видалити подію":"Delete event"}
          </button>
        </div>
        <p className="tt-admin-event-delete-hint">{language==="ru"
          ?"Безвозвратное удаление доступно, только если у мероприятия нет регистраций, билетов, платежей и истории отправленных уведомлений."
          :language==="cs"?"Trvalé odstranění je možné pouze bez registrací, vstupenek, plateb a odeslaných oznámení."
          :language==="uk"?"Остаточне видалення можливе лише без реєстрацій, квитків, платежів та надісланих сповіщень."
          :"Permanent deletion requires no registrations, tickets, payments or delivered notification history."}</p>
      </section>
      {!event.is_cancelled&&<section className="panel form-stack">
        <h2>{tr("Публикация мероприятия")}</h2>
        <label>{language==="ru"?"Видимость":language==="cs"?"Viditelnost":language==="uk"?"Видимість":"Visibility"}
          <select value={event.visibility||"public"} disabled={busy} onChange={e=>void changeVisibility(e.target.value as "public"|"link_only")}>
            <option value="public">{language==="ru"?"Публичное (каталог)":language==="cs"?"Veřejné (katalog)":language==="uk"?"Публічне (каталог)":"Public (catalog)"}</option>
            <option value="link_only">{language==="ru"?"Закрытое (по ссылке)":language==="cs"?"Soukromé (přes odkaz)":language==="uk"?"Закрите (за посиланням)":"Private (invitation link)"}</option>
          </select>
        </label>
        {event.visibility==="link_only"&&<div className="state-card" role="status">
          🔒 {language==="ru"?"Мероприятие скрыто из каталога и Google. Чтобы открыть его, нужна секретная ссылка. Любой обладатель ссылки может передать её другим.":language==="cs"?"Akce není v katalogu ani ve vyhledávačích. Odkaz může předat kdokoli, kdo jej získá.":language==="uk"?"Подія прихована з каталогу та Google. Кожен, хто має посилання, може ним поділитися.":"Unlisted: only guests with the private invitation link can view or book. Anyone who has the link may share it."}
          {event.invite_url&&<div className="admin-event-actions" style={{marginTop:10}}>
            <button type="button" className="button button-primary" onClick={copyEventLink}>{language==="ru"?"Скопировать приглашение":language==="cs"?"Kopírovat pozvánku":language==="uk"?"Скопіювати запрошення":"Copy invitation link"}</button>
          </div>}
        </div>}
        <p className="form-note">{tr("Статус:")} <strong>{event.publication?.status==="draft"?tr("Черновик"):event.publication?.status==="scheduled"?tr("Запланировано"):tr("Опубликовано")}</strong>. {tr("Новые ивенты скрыты до публикации. Для платных ивентов укажи инструкцию прямой оплаты организатору; подтверждение оплаченных заявок доступно ниже.")}</p>
        {event.publication?.publish_at&&<p>{tr("Автопубликация:")} {new Date(event.publication.publish_at).toLocaleString(localeForLanguage(language))}</p>}
        <div className="admin-event-actions">
          {!event.publication?.visible&&<button type="button" className="button button-primary" disabled={busy} onClick={()=>publication("published")}>{tr("Опубликовать сейчас")}</button>}
          {event.publication?.visible&&<button type="button" className="button button-outline" disabled={busy} onClick={()=>publication("draft")}>{tr("Снять с публикации")}</button>}
        </div>
        {!event.publication?.visible&&<div className="tt-publication-schedule">
          <div className="tt-publication-schedule-fields" role="group" aria-label={tr("Опубликовать автоматически")}>
            <label>{language==="ru"?"Дата публикации":language==="cs"?"Datum zveřejnění":language==="uk"?"Дата публікації":"Publish date"}
              <input type="date" value={scheduleDate} onChange={e=>setScheduleDate(e.target.value)}/>
            </label>
            <label>{language==="ru"?"Время публикации":language==="cs"?"Čas zveřejnění":language==="uk"?"Час публікації":"Publish time"}
              <input type="time" value={scheduleTime} onChange={e=>setScheduleTime(e.target.value)}/>
            </label>
          </div>
          <button type="button" className="button button-outline" disabled={busy||!scheduleAt} onClick={()=>publication("scheduled")}>{tr("Запланировать")}</button>
        </div>}
        {event.publication?.visible&&<div className="admin-event-actions">
          <button type="button" className="button button-outline" onClick={copyEventLink}>{tr("Копировать ссылку")}</button>
          <button type="button" className="button button-sun" onClick={()=>void downloadPromotionQR()}>{tr("Скачать QR для афиши")}</button>
        </div>}
      </section>}
      </div>}
      {tab==="details"&&<div className="tp-tabpanel">
      {event.is_cancelled&&<div className="state-card">{tr("Cancelled")}</div>}
      {!event.is_cancelled&&<form className="panel form-stack" onSubmit={saveChanges}>
        <h2>{tr("Редактировать информацию")}</h2>
        <label>{tr("Название")}<input value={title} required onChange={e=>setTitle(e.target.value)}/></label>
        <label>{tr("Организатор")}<input value={organizer} onChange={e=>setOrganizer(e.target.value)}/></label>
        <label>{tr("Адрес или место проведения")}<input value={location} onChange={e=>setLocation(e.target.value)}/></label>
        <label>{tr("Ссылка на площадку")}<input type="url" inputMode="url" value={venueUrl} onChange={e=>setVenueUrl(e.target.value)} placeholder="https://…"/>
          <small className="tp-field-hint">{tr("Сайт, Instagram или страница места на карте. Гости увидят кнопку «Сайт площадки» на странице ивента.")}</small></label>
        <label>{tr("Описание")}<textarea rows={5} value={description} onChange={e=>setDescription(e.target.value)}/></label>
        <label>{tr("Фото мероприятия (HTTPS, по одной ссылке на строку, до 8)")}<textarea rows={4} value={gallery} onChange={e=>setGallery(e.target.value)}/></label>
        <label>{tr("Видео (YouTube/Vimeo)")}<input type="url" value={video} onChange={e=>setVideo(e.target.value)} placeholder="https://www.youtube.com/watch?v=…"/></label>
        <div className="two-col"><label>{tr("Дата и время")}<input type="datetime-local" required value={startsAt} onChange={e=>setStartsAt(e.target.value)}/></label>
          <label>{tr("Количество мест")}<input type="number" min="1" value={capacity} onChange={e=>setCapacity(e.target.value)}/></label></div>
        <div className="two-col">
          <label>{tr("Цена")}<input type="number" min="0" step="0.01" value={price} onChange={e=>setPrice(e.target.value)} required/></label>
          <label>{tr("Валюта")}<select value={currency} onChange={e=>setCurrency(e.target.value)}>
            <option value="CZK">CZK</option><option value="EUR">EUR</option><option value="USD">USD</option>
          </select></label>
        </div>
        <p className="form-note">{language==="cs"?"Registrace na placené akce vydá vstupenku ihned, platbu TicketTreat nevybírá ani nepotvrzuje.":language==="en"?"Registration for priced events issues a ticket immediately. TicketTreat does not collect or confirm payment.":language==="uk"?"На платну подію квиток видається відразу; TicketTreat не приймає і не підтверджує оплату.":"На платное мероприятие билет выдаётся сразу; TicketTreat не принимает и не подтверждает оплату."}</p>
        <fieldset className="event-language-fieldset"><legend>{tr("Категории")}</legend>
        <p className="tp-field-hint">{tr("По ним гости фильтруют афишу на главной. Можно выбрать несколько.")}</p>
        <div className="event-language-options">
          {EVENT_TAGS.map(tag=><label className="event-language-option" key={tag}>
            <input type="checkbox" checked={tags.includes(tag)} onChange={e=>setTags(s=>e.target.checked?[...s,tag]:s.filter(x=>x!==tag))}/>
            <span className="event-language-flag" aria-hidden="true"><TagIcon tag={tag}/></span>
            <span className="event-language-name">{TAG_LABELS[language][tag]}</span>
          </label>)}
        </div></fieldset>
        <fieldset className="event-language-fieldset"><legend>{tr("Языки")}</legend>
        <div className="event-language-options">
          {([["en","🇬🇧","English"],["cs","🇨🇿","Čeština"],["ru","🇷🇺","Русский"],["uk","🇺🇦","Українська"]] as const).map(([id,flag,name])=>
            <label className="event-language-option" key={id}>
              <input type="checkbox" checked={languages.includes(id)}
                onChange={e=>setLanguages(s=>e.target.checked?[...s,id]:s.filter(x=>x!==id))}/>
              <span className="event-language-flag" aria-hidden="true">{flag}</span>
              <span className="event-language-name">{name}</span>
            </label>)}
        </div></fieldset>
        <label>{tr("Новый постер (необязательно)")}<input type="file" accept="image/png,image/jpeg,image/webp"
          onChange={e=>setPoster(e.target.files?.[0]||null)}/>
          <small className="tp-field-hint">{tr("Размер постера: 1080×1350 px (вертикальный 4:5), минимум 800×1000 px. Важное держите в центре, в ленте края могут обрезаться. Цвета остаются как в файле.")}</small></label>
        {event.image_url&&<img src={event.image_url} alt="Event poster" className="event-poster-preview"/>}
        <button className="button button-primary" disabled={busy}>{busy?tr("Сохраняем…"):tr("Сохранить изменения")}</button>
      </form>}
      </div>}
      {tab==="media"&&<div className="tp-tabpanel">
      {event.image_url&&<section className="panel form-stack">
        <h2>{tr("Постер")}</h2>
        <img src={event.image_url} alt="" className="event-poster-preview"/>
        <p className="form-note">{tr("Новый постер загружается на вкладке «Описание».")}</p>
      </section>}
      {!event.is_cancelled&&<section className="panel form-stack">
        <h2>{tr("Фотогалерея мероприятия")}</h2>
        <p className="form-note">{tr("Загружай фотографии с прошлых мероприятий (JPG, PNG, WebP; до 2 МБ каждая, максимум 8 включая HTTPS-ссылки). Файлы сохраняются на сервере TicketTreat.")}</p>
        <p className="form-note">{tr("Фото галереи: от 1200 px по длинной стороне, горизонтальные 3:2 или 4:3 смотрятся лучше всего.")}</p>
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
      </div>}
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
      {tab==="analytics"&&<div className="tp-tabpanel">
      {!pilotInsights&&<div className="state-card">{tr("Нет регистраций.")}</div>}
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
      </div>}
      {tab==="notify"&&<div className="tp-tabpanel">
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
      </div>}
      {tab==="guests"&&<div className="tp-tabpanel">
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
      </div>}
      {tab==="notify"&&<div className="tp-tabpanel">
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
              <strong>Email</strong>
              <span>{tr("Доставлено провайдеру:")} {emailStatus.message_states.sent||0}</span>
              <span>{tr("В очереди:")} {emailStatus.message_states.pending||0} · {tr("Ошибок:")} {emailStatus.message_states.failed||0}</span>
            </div>
            <div className="stat-card">
              <strong>Telegram</strong>
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
      </div>}
      {tab==="moderation"&&<div className="tp-tabpanel">
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
          <div><strong>{({
            create:{ru:"Создание",uk:"Створення",cs:"Vytvoření",en:"Created"},
            cancel:{ru:"Отмена",uk:"Скасування",cs:"Zrušení",en:"Cancelled"},
            publish:{ru:"Публикация",uk:"Публікація",cs:"Zveřejnění",en:"Published"},
            unpublish:{ru:"Снятие с публикации",uk:"Зняття з публікації",cs:"Stažení z publikace",en:"Unpublished"},
            update:{ru:"Изменение",uk:"Зміна",cs:"Úprava",en:"Updated"}
          } as Record<string,Record<string,string>>)[a.action]?.[language]||a.action}</strong><small>{tr("Организатор")} #{a.actor_account_id}</small><small>{a.details}</small></div>
          <small>{new Date(a.at).toLocaleString(localeForLanguage(language))}</small>
        </div>)}
      </section>}
      </div>}
      {tab==="guests"&&<div className="tp-tabpanel">
      <dialog ref={removeDialogRef} className="tt-event-cancel-dialog tt-participant-remove-dialog"
        aria-labelledby="tt-participant-remove-title"
        onClose={()=>{setRemoveTarget(null);setRemoveReason("");setManualPaymentReviewConfirmed(false);setRemoveError("");}}>
        <form className="form-stack" onSubmit={confirmRemoveParticipant}>
          <h2 id="tt-participant-remove-title">{language==="cs"?"Odebrat hosta":language==="en"?"Remove participant":language==="uk"?"Видалити учасника":"Отписать участника"}</h2>
          <p>{language==="cs"?"Vybraný host:":language==="en"?"Selected guest:":language==="uk"?"Обраний учасник:":"Выбранный участник:"} <strong>{removeTarget?.name}</strong></p>
          <p>{removeTarget?.kind==="ticket"
            ?language==="cs"?"Registrace bude zrušena, vstupenka zneplatněna a volné místo nabídnuto čekajícím hostům. Záznam zůstane v historii.":language==="en"?"The registration will be cancelled, the QR ticket invalidated and the place made available to waiting guests. Audit history is kept.":language==="uk"?"Реєстрацію буде скасовано, QR-квиток анульовано, а місце звільнено для черги. Історія залишиться.":"Регистрация будет отменена, QR-билет аннулирован, а место освобождено для очереди. История сохранится."
            :language==="cs"?"Host bude odebrán z čekací listiny. Historie zůstane zachována.":language==="en"?"The guest will be removed from the waitlist. History is retained.":language==="uk"?"Учасника буде видалено з черги. Історія збережеться.":"Гость будет удалён из листа ожидания. История сохранится."}</p>
          {removeTarget?.paid&&<>
            <p className="form-note">{language==="cs"?"Platba byla vyřízena mimo TicketTreat. Zrušení vstupenky nevrátí peníze automaticky.":language==="en"?"This payment was handled outside TicketTreat. Cancelling the ticket will not refund money automatically.":language==="uk"?"Оплату проведено поза TicketTreat. Скасування квитка не поверне гроші автоматично.":"Оплата прошла вне TicketTreat. Отмена билета не возвращает деньги автоматически."}</p>
            <label className="tt-manual-payment-confirmation">
              <input type="checkbox" checked={manualPaymentReviewConfirmed}
                onChange={ev=>{setManualPaymentReviewConfirmed(ev.target.checked);setRemoveError("");}} required/>
              <span>{language==="cs"?"Potvrzuji, že jsem platbu ručně prověřil(a) a případné vrácení peněz vyřeším přímo s hostem."
                :language==="en"?"I have manually reviewed this payment and will handle any refund directly with the guest."
                :language==="uk"?"Підтверджую, що вручну перевірив(ла) оплату й вирішу питання можливого повернення коштів безпосередньо з гостем."
                :"Подтверждаю, что вручную проверил(а) оплату и решу вопрос возможного возврата напрямую с гостем."}</span>
            </label>
          </>}
          <label>{language==="cs"?"Důvod (min. 8 znaků)":language==="en"?"Reason (at least 8 characters)":language==="uk"?"Причина (від 8 символів)":"Причина (минимум 8 символов)"}
            <textarea required rows={3} minLength={8} maxLength={500} value={removeReason}
              onChange={ev=>{setRemoveReason(ev.target.value);setRemoveError("");}}/>
          </label>
          {removeError&&<div className="state-card state-error" role="alert">{removeError}</div>}
          <div className="tt-event-cancel-actions">
            <button className="button button-outline" type="button" disabled={busy}
              onClick={()=>removeDialogRef.current?.close()}>{language==="cs"?"Zpět":language==="en"?"Keep registration":language==="uk"?"Назад":"Не удалять"}</button>
            <button className="button button-primary" type="submit"
              disabled={busy||removeReason.trim().length<8||(Boolean(removeTarget?.paid)&&!manualPaymentReviewConfirmed)}>{busy
                ?language==="cs"?"Ukládám…":language==="en"?"Removing…":language==="uk"?"Видалення…":"Удаляем…"
                :language==="cs"?"Odebrat hosta":language==="en"?"Remove guest":language==="uk"?"Видалити":"Отписать"}</button>
          </div>
        </form>
      </dialog>
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
              <small>{ticket.guest?.email}</small><small>{ticket.code} · {ticket.payment_provider==="registration_only"?(language==="cs"?"Registrace (platba neověřena)":language==="en"?"Registered (payment not verified)":language==="uk"?"Записано (оплату не перевірено)":"Записан (оплата не проверена)"):ticket.payment_status === "paid"?tr("Paid"):ticket.payment_status === "not_required"?tr("Free"):ticket.payment_status === "pending"?tr("Ожидает оплаты"):ticket.payment_status}</small></div>
            <div className="participant-actions">
              <span className={ticket.checked_in_at?"status status-success":"status status-demo"}>
                {ticket.ticket_status==="cancelled"?tr("Cancelled"):ticket.checked_in_at?tr("Checked in"):(language==="cs"?"Registrován":language==="en"?"Registered":language==="uk"?"Записано":"Записан")}</span>
              {ticket.ticket_status==="active"&&!ticket.checked_in_at&&<>
                <span className="status status-muted">{tr("Awaiting QR scan")}</span>
                <button className="button button-outline" type="button" disabled={busy}
                  onClick={()=>manualCheckIn(ticket.id)}>{tr("Отметить вручную")}</button>
                <button className="button button-outline tt-remove-attendee-button" type="button" disabled={busy}
                  onClick={()=>askRemoveParticipant("ticket",ticket.id,
                    [ticket.guest?.first_name,ticket.guest?.last_name].filter(Boolean).join(" ")||`#${ticket.id}`,
                    !["free","legacy_free","registration_only","demo"].includes(ticket.payment_provider))}>
                  {language==="cs"?"Odebrat z akce":language==="en"?"Remove from event":language==="uk"?"Відписати":"Отписать от ивента"}
                </button>
              </>}
            </div>
          </div>)}
        </div></section>
        <section className="panel"><h2>{tr("Лист ожидания")}</h2>
          {!data.waitlist.length&&<p>{tr("Пока пусто.")}</p>}
          {data.waitlist.filter(w=>w.status==="waiting"||w.status==="offered").map(w=><div key={w.id} className="participant-row">
            <strong>{w.guest.first_name} {w.guest.last_name}</strong>
            <div className="participant-actions">
              <span className="status status-muted">{w.status==="offered"
                ?language==="cs"?"Nabídnuto":language==="en"?"Place offered":language==="uk"?"Місце запропоновано":"Место предложено"
                :tr("Waiting")}</span>
              <button className="button button-outline tt-remove-attendee-button" type="button" disabled={busy}
                onClick={()=>askRemoveParticipant("waitlist",w.id,[w.guest.first_name,w.guest.last_name].filter(Boolean).join(" ")||`#${w.id}`)}>
                {language==="cs"?"Odebrat z čekací listiny":language==="en"?"Remove from waitlist":language==="uk"?"Видалити з черги":"Убрать из ожидания"}
              </button>
            </div>
          </div>)}
        </section>
      </>}
      </div>}
    </>}
  </main></div>;
}
