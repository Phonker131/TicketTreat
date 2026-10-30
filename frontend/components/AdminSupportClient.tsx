"use client";
import Link from "next/link";
import {useCallback,useEffect,useState,type FormEvent} from "react";
import {AppHeader} from "@/components/AppHeader";
import {useLanguage} from "@/components/LanguageProvider";
import {userFacingError} from "@/lib/user-facing-errors";
import {getManageMe,getSupportSummary,listAdminSupportTickets,getAdminSupportTicket,markSupportRead,replyAdminSupportTicket,closeAdminSupportTicket,
 type SupportTicket,type SupportThread,type SupportSummary} from "@/lib/api";
import {getWebToken} from "@/lib/session";

const WORDS={"en":{"back":"← Admin dashboard","title":"Support desk","intro":"Only global administrators with MFA can view user requests. Replies are also sent to the account's verified email through Resend.","loading":"Loading…","mfa":"Configure / verify MFA →","unread":"Unread","openCount":"Awaiting response","answeredCount":"Answered","inbox":"Incoming tickets","all":"All","open":"Open","answered":"Answered","closed":"Closed","empty":"No requests yet.","user":"User","choose":"Select a request","chooseInfo":"New requests are marked with a dot. Counts refresh automatically every 30 seconds.","reply":"Reply to user (also sent by email)","send":"Reply and send email","sending":"Sending…","close":"Close ticket","closeConfirm":"Close this ticket? The user can open a new one.","closedNotice":"Ticket closed.","saved":"Reply saved. Resend will confirm delivery separately.","placeholder":"Hello! We have reviewed your request…","sent":"sent","pending":"queued","failed":"delivery failed","skipped":"skipped","unqueued":"not queued","global_admin_only":"TicketTreat administrators only.","mfa_enrollment_required":"Configure MFA before accessing support.","mfa_challenge_required":"Verify MFA to access support.","support_email_not_configured":"Email delivery is not configured. Check the sender and Resend configuration.","support_recipient_unverified":"The user's email is not verified.","support_ticket_closed":"Ticket closed."},"cs":{"back":"← Administrace","title":"Zákaznická podpora","intro":"Požadavky uživatelů mohou zobrazit pouze hlavní administrátoři s MFA. Odpovědi se odesílají i na ověřený e-mail účtu přes Resend.","loading":"Načítání…","mfa":"Nastavit / ověřit MFA →","unread":"Nepřečtené","openCount":"Čeká na odpověď","answeredCount":"Zodpovězené","inbox":"Příchozí požadavky","all":"Vše","open":"Otevřené","answered":"Zodpovězené","closed":"Uzavřené","empty":"Zatím žádné požadavky.","user":"Uživatel","choose":"Vyberte požadavek","chooseInfo":"Nové požadavky jsou označeny tečkou. Počty se automaticky obnovují každých 30 sekund.","reply":"Odpověď uživateli (také e-mailem)","send":"Odpovědět a odeslat e-mail","sending":"Odesílání…","close":"Uzavřít požadavek","closeConfirm":"Uzavřít požadavek? Uživatel může vytvořit nový.","closedNotice":"Požadavek uzavřen.","saved":"Odpověď uložena. Doručení e-mailu potvrdí Resend samostatně.","placeholder":"Dobrý den, váš požadavek jsme prověřili…","sent":"odesláno","pending":"ve frontě","failed":"chyba doručení","skipped":"přeskočeno","unqueued":"nezařazeno do fronty","global_admin_only":"Pouze pro administrátory TicketTreat.","mfa_enrollment_required":"Před přístupem k podpoře nastavte MFA.","mfa_challenge_required":"Před přístupem k podpoře ověřte MFA.","support_email_not_configured":"Odesílání e-mailů není nastaveno. Zkontrolujte odesílatele a konfiguraci Resend.","support_recipient_unverified":"E-mail uživatele není ověřen.","support_ticket_closed":"Požadavek uzavřen."},"ru":{"back":"← Админ-панель","title":"Служба поддержки","intro":"Обращения пользователей доступны только главным администраторам с MFA. Ответы отправляются через Resend на подтверждённый email аккаунта.","loading":"Загрузка…","mfa":"Настроить / подтвердить MFA →","unread":"Непрочитанные","openCount":"Ожидают ответа","answeredCount":"Отвеченные","inbox":"Входящие тикеты","all":"Все","open":"Открытые","answered":"Отвеченные","closed":"Закрытые","empty":"Обращений пока нет.","user":"Пользователь","choose":"Выбери обращение","chooseInfo":"Новые обращения отмечены точкой. Счётчик обновляется каждые 30 секунд.","reply":"Ответ пользователю (также отправится на email)","send":"Ответить и отправить email","sending":"Отправляем…","close":"Закрыть тикет","closeConfirm":"Закрыть обращение? Пользователь сможет создать новое.","closedNotice":"Тикет закрыт.","saved":"Ответ сохранён. Resend подтвердит доставку отдельно.","placeholder":"Здравствуйте! Мы рассмотрели ваше обращение…","sent":"отправлен","pending":"в очереди","failed":"ошибка доставки","skipped":"пропущен","unqueued":"не поставлен в очередь","global_admin_only":"Только для администраторов TicketTreat.","mfa_enrollment_required":"Для доступа к поддержке нужно настроить MFA.","mfa_challenge_required":"Подтверди MFA для доступа к поддержке.","support_email_not_configured":"Отправка почты не настроена. Проверь отправителя и Resend.","support_recipient_unverified":"Email пользователя не подтверждён.","support_ticket_closed":"Тикет закрыт."},"uk":{"back":"← Адмін-панель","title":"Служба підтримки","intro":"Звернення користувачів доступні лише головним адміністраторам з MFA. Відповіді також надсилаються через Resend на підтверджений email акаунта.","loading":"Завантаження…","mfa":"Налаштувати / підтвердити MFA →","unread":"Непрочитані","openCount":"Очікують відповіді","answeredCount":"З відповіддю","inbox":"Вхідні звернення","all":"Усі","open":"Відкриті","answered":"З відповіддю","closed":"Закриті","empty":"Звернень ще немає.","user":"Користувач","choose":"Обери звернення","chooseInfo":"Нові звернення позначено крапкою. Лічильник оновлюється кожні 30 секунд.","reply":"Відповідь користувачу (також на email)","send":"Відповісти й надіслати email","sending":"Надсилаємо…","close":"Закрити звернення","closeConfirm":"Закрити звернення? Користувач зможе створити нове.","closedNotice":"Звернення закрито.","saved":"Відповідь збережено. Resend окремо підтвердить доставку.","placeholder":"Вітаємо! Ми розглянули ваше звернення…","sent":"надіслано","pending":"у черзі","failed":"помилка доставки","skipped":"пропущено","unqueued":"не поставлено в чергу","global_admin_only":"Лише для адміністраторів TicketTreat.","mfa_enrollment_required":"Потрібно налаштувати MFA для доступу до підтримки.","mfa_challenge_required":"Підтвердь MFA для доступу до підтримки.","support_email_not_configured":"Надсилання листів не налаштовано. Перевір відправника й Resend.","support_recipient_unverified":"Email користувача не підтверджено.","support_ticket_closed":"Звернення закрито."}};
export function AdminSupportClient(){
 const {language}=useLanguage();const tr=WORDS[language];
 const show=(value:string)=>value.startsWith("msg:")?tr[value.slice(4) as keyof typeof tr]||value : tr[value as keyof typeof tr]||value;
 const stamp=(value:string)=>new Date(value).toLocaleString(language);
 const [tickets,setTickets]=useState<SupportTicket[]>([]);
 const [summary,setSummary]=useState<SupportSummary|null>(null);
 const [thread,setThread]=useState<SupportThread|null>(null);
 const [current,setCurrent]=useState<number|null>(null);
 const [filter,setFilter]=useState<"all"|"open"|"answered"|"closed">("all");
 const [reply,setReply]=useState("");
 const [error,setError]=useState("");const [notice,setNotice]=useState("");
 const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);
 const [authorized,setAuthorized]=useState(false);
 const refresh=useCallback(async(status:"all"|"open"|"answered"|"closed")=>{
   const [s,t]=await Promise.all([getSupportSummary(),listAdminSupportTickets(status)]);
   setSummary(s);setTickets(t.tickets);
 },[]);
 useEffect(()=>{
   let live=true;
   getManageMe(getWebToken()||"").then(async(me)=>{
     if(me.role!=="global_admin")throw new Error("global_admin_only");
     if(!live)return;setAuthorized(true);await refresh(filter);
   }).catch(e=>{if(live)setError(e.message||String(e));}).finally(()=>{if(live)setLoading(false)});
   return()=>{live=false};
 },[refresh]);
 useEffect(()=>{
   if(!authorized)return;
   const id=window.setInterval(()=>{if(document.visibilityState==="visible"){
     void refresh(filter).catch(()=>{});
     if(current!==null)void getAdminSupportTicket(current).then(setThread).catch(()=>{});
   }},30000);
   return()=>window.clearInterval(id);
 },[authorized,current,filter,refresh]);
 async function changeFilter(status:"all"|"open"|"answered"|"closed"){
   setFilter(status);setError("");
   try{await refresh(status);}catch(e){setError(String(e))}
 }
 async function open(id:number){
   setError("");setNotice("");setCurrent(id);
   try{const data=await getAdminSupportTicket(id);setThread(data);
     await markSupportRead(id);await refresh(filter);
   }catch(e){setError(e instanceof Error?e.message:String(e))}
 }
 async function send(e:FormEvent){
   e.preventDefault();if(current===null)return;
   setBusy(true);setError("");setNotice("");
   try{
     const result=await replyAdminSupportTicket(current,reply.trim());
     setReply("");await open(current);setNotice(`msg:saved`);
   }catch(e){const m=e instanceof Error?e.message:String(e);setError(m)}
   finally{setBusy(false)}
 }
 async function close(){
   if(current===null||!window.confirm(tr.closeConfirm))return;
   setBusy(true);setError("");
   try{await closeAdminSupportTicket(current);await open(current);setNotice("msg:closedNotice");}
   catch(e){setError(e instanceof Error?e.message:String(e))}
   finally{setBusy(false)}
 }
 return <div className="app-shell"><AppHeader/><main className="page tt-support-page">
  <div className="tt-support-heading-nav">
   <Link href="/admin" className="back-link">{tr.back}</Link>
   <span className="eyebrow">TICKETTREAT / SUPPORT DESK</span>
  </div>
  <h1>{tr.title}</h1>
  <p className="form-note">{tr.intro}</p>
  {loading&&<div className="state-card">{tr.loading}</div>}
  {error&&<p className="state-card state-error" role="alert">{show(error)===error?userFacingError(error,language):show(error)} {(error==="mfa_challenge_required"||error==="mfa_enrollment_required")&&<Link href="/security/mfa">{tr.mfa}</Link>}</p>}
  {notice&&<p className="success-banner" role="status">{show(notice)}</p>}
  {authorized&&<>
   <div className="stats-grid" aria-label="Support overview">
    <div className="stat-card"><strong>{summary?.unread??"–"}</strong><span>{tr.unread}</span></div>
    <div className="stat-card"><strong>{summary?.open??"–"}</strong><span>{tr.openCount}</span></div>
    <div className="stat-card"><strong>{summary?.answered??"–"}</strong><span>{tr.answeredCount}</span></div>
   </div>
   <div className="tt-support-admin-grid">
    <section className="panel form-stack">
     <h2>{tr.inbox}</h2>
     <div className="tt-support-filters">{(["all","open","answered","closed"] as const).map(status=><button
       type="button" key={status} className={filter===status?"button button-primary":"button button-outline"}
       onClick={()=>void changeFilter(status)}>{tr[status]}</button>)}</div>
     {!tickets.length?<p>{tr.empty}</p>:<div className="tt-support-list">{tickets.map(t=>
      <button type="button" key={t.id} onClick={()=>void open(t.id)} className={`tt-support-list-item ${t.unread?"tt-support-unread":""} ${current===t.id?"tt-support-selected":""}`}>
       <span><strong>{t.unread?"● ":""}#{t.id} · {t.subject}</strong>
         <small>{t.customer?.name||tr.user} · {t.customer?.email||"—"}</small>
         <small>{stamp(t.updated_at)}</small>
       </span><span className="status">{tr[t.status]}</span>
      </button>)}</div>}
    </section>
    <section className="panel form-stack" aria-label="Support ticket details">
      {!thread?<><h2>{tr.choose}</h2><p>{tr.chooseInfo}</p></>:<>
       <div className="tt-support-ticket-heading"><h2>#{thread.ticket.id} · {thread.ticket.subject}</h2><span className="status">{tr[thread.ticket.status]}</span></div>
       <p className="form-note">{thread.ticket.customer?.name} · {thread.ticket.customer?.email} · {thread.ticket.category}</p>
       <div className="tt-support-thread">{thread.messages.map(msg=>
        <article key={msg.id} className={`tt-support-message ${msg.role==="admin"?"is-staff":""}`}>
         <div className="tt-support-message-meta"><strong>{msg.role==="admin"?"TicketTreat Support":tr.user}</strong><small>{stamp(msg.created_at)}</small></div>
         <p>{msg.body}</p>
         {msg.role==="admin"&&<small>Email: {msg.email_status==="sent"?tr.sent:msg.email_status==="pending"?tr.pending:msg.email_status==="failed"?tr.failed:msg.email_status==="skipped"?tr.skipped:tr.unqueued}</small>}
        </article>)}</div>
       {thread.ticket.status!=="closed"&&<form className="form-stack" onSubmit={send}>
        <label>{tr.reply}
          <textarea rows={6} minLength={2} maxLength={5000} value={reply} onChange={e=>setReply(e.target.value)} required placeholder={tr.placeholder}/></label>
        <button className="button button-primary" type="submit" disabled={busy||reply.trim().length<2}>{busy?tr.sending:tr.send}</button>
        <button type="button" className="button button-outline" disabled={busy} onClick={()=>void close()}>{tr.close}</button>
       </form>}
      </>}
    </section>
   </div>
  </>}
 </main></div>;
}
