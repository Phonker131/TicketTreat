"use client";
import Link from "next/link";
import {useCallback,useEffect,useState,type FormEvent} from "react";
import {AppHeader} from "@/components/AppHeader";
import {getManageMe,getSupportSummary,listAdminSupportTickets,getAdminSupportTicket,markSupportRead,replyAdminSupportTicket,closeAdminSupportTicket,
 type SupportTicket,type SupportThread,type SupportSummary} from "@/lib/api";
import {getWebToken} from "@/lib/session";

const stamp=(s:string)=>new Date(s).toLocaleString();
const errors:Record<string,string>={global_admin_only:"Только для администраторов TicketTreat.",
 mfa_enrollment_required:"Для доступа к поддержке нужно настроить MFA.",
 mfa_challenge_required:"Подтверди MFA для доступа к поддержке.",
 support_email_not_configured:"Resend не настроен. Ответ не сохранён: проверь EMAIL_FROM, RESEND_API_KEY и EMAIL_NOTIFICATIONS_ENABLED.",
 support_recipient_unverified:"Email пользователя не подтверждён.",
 support_ticket_closed:"Тикет закрыт.",
};
export function AdminSupportClient(){
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
     setNotice(`Ответ сохранён. Email: ${result.email_status}. Resend подтвердит доставку отдельно.`);
     setReply("");await open(current);
   }catch(e){const m=e instanceof Error?e.message:String(e);setError(errors[m]||m)}
   finally{setBusy(false)}
 }
 async function close(){
   if(current===null||!window.confirm("Закрыть обращение? Пользователь сможет создать новое."))return;
   setBusy(true);setError("");
   try{await closeAdminSupportTicket(current);await open(current);setNotice("Тикет закрыт.");}
   catch(e){setError(e instanceof Error?e.message:String(e))}
   finally{setBusy(false)}
 }
 return <div className="app-shell"><AppHeader/><main className="page tt-support-page">
  <Link href="/admin" className="back-link">← Админ-панель</Link>
  <span className="eyebrow">TICKETTREAT / SUPPORT DESK</span>
  <h1>Служба поддержки</h1>
  <p className="form-note">Обращения пользователей доступны только глобальным администраторам с MFA. Ответы отправляются через Resend на подтверждённый email аккаунта.</p>
  {loading&&<div className="state-card">Загрузка…</div>}
  {error&&<p className="state-card state-error" role="alert">{errors[error]||error} {(error==="mfa_challenge_required"||error==="mfa_enrollment_required")&&<Link href="/security/mfa">Настроить / подтвердить MFA →</Link>}</p>}
  {notice&&<p className="success-banner" role="status">{notice}</p>}
  {authorized&&<>
   <div className="stats-grid" aria-label="Support overview">
    <div className="stat-card"><strong>{summary?.unread??"–"}</strong><span>Непрочитанные</span></div>
    <div className="stat-card"><strong>{summary?.open??"–"}</strong><span>Ожидают ответа</span></div>
    <div className="stat-card"><strong>{summary?.answered??"–"}</strong><span>Отвеченные</span></div>
   </div>
   <div className="tt-support-admin-grid">
    <section className="panel form-stack">
     <h2>Входящие тикеты</h2>
     <div className="tt-support-filters">{(["all","open","answered","closed"] as const).map(status=><button
       type="button" key={status} className={filter===status?"button button-primary":"button button-outline"}
       onClick={()=>void changeFilter(status)}>{status==="all"?"Все":status==="open"?"Открытые":status==="answered"?"Отвеченные":"Закрытые"}</button>)}</div>
     {!tickets.length?<p>Обращений пока нет.</p>:<div className="tt-support-list">{tickets.map(t=>
      <button type="button" key={t.id} onClick={()=>void open(t.id)} className={`tt-support-list-item ${t.unread?"tt-support-unread":""} ${current===t.id?"tt-support-selected":""}`}>
       <span><strong>{t.unread?"● ":""}#{t.id} · {t.subject}</strong>
         <small>{t.customer?.name||"Пользователь"} · {t.customer?.email||"—"}</small>
         <small>{stamp(t.updated_at)}</small>
       </span><span className="status">{t.status==="open"?"Открыт":t.status==="answered"?"Отвечен":"Закрыт"}</span>
      </button>)}</div>}
    </section>
    <section className="panel form-stack" aria-label="Support ticket details">
      {!thread?<><h2>Выбери обращение</h2><p>Новые обращения отмечены точкой. Счётчик обновляется автоматически каждые 30 секунд.</p></>:<>
       <div className="tt-support-ticket-heading"><h2>#{thread.ticket.id} · {thread.ticket.subject}</h2><span className="status">{thread.ticket.status}</span></div>
       <p className="form-note">{thread.ticket.customer?.name} · {thread.ticket.customer?.email} · {thread.ticket.category}</p>
       <div className="tt-support-thread">{thread.messages.map(msg=>
        <article key={msg.id} className={`tt-support-message ${msg.role==="admin"?"is-staff":""}`}>
         <div className="tt-support-message-meta"><strong>{msg.role==="admin"?"TicketTreat Support":"Пользователь"}</strong><small>{stamp(msg.created_at)}</small></div>
         <p>{msg.body}</p>
         {msg.role==="admin"&&<small>Email: {msg.email_status==="sent"?"отправлен":msg.email_status==="pending"?"в очереди":msg.email_status==="failed"?"ошибка доставки":msg.email_status==="skipped"?"пропущен":"не поставлен в очередь"}</small>}
        </article>)}</div>
       {thread.ticket.status!=="closed"&&<form className="form-stack" onSubmit={send}>
        <label>Ответ пользователю (отправится также на email)
          <textarea rows={6} minLength={2} maxLength={5000} value={reply} onChange={e=>setReply(e.target.value)} required placeholder="Здравствуйте! Мы рассмотрели ваше обращение…"/></label>
        <button className="button button-primary" type="submit" disabled={busy||reply.trim().length<2}>{busy?"Отправляем…":"Ответить и отправить email"}</button>
        <button type="button" className="button button-outline" disabled={busy} onClick={()=>void close()}>Закрыть тикет</button>
       </form>}
      </>}
    </section>
   </div>
  </>}
 </main></div>;
}
