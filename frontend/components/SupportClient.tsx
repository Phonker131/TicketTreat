"use client";
import Link from "next/link";
import {useCallback,useEffect,useState,type FormEvent} from "react";
import {AppHeader} from "@/components/AppHeader";
import {useLanguage} from "@/components/LanguageProvider";
import {getWebToken} from "@/lib/session";
import {createSupportTicket,listMySupportTickets,getMySupportTicket,replyMySupportTicket,type SupportTicket,type SupportThread} from "@/lib/api";

const words={
 ru:{title:"Служба поддержки",intro:"Опиши проблему или жалобу. Мы ответим в тикете и отправим письмо на подтверждённый email твоего аккаунта.",new:"Создать обращение",history:"Мои обращения",subject:"Тема",body:"Опиши проблему",send:"Отправить обращение",sendReply:"Отправить сообщение",reply:"Дополнительная информация",signed:"Войди в аккаунт, чтобы обратиться в поддержку и получить ответ на email.",login:"Войти",empty:"У тебя пока нет обращений.",loading:"Загрузка…",sent:"Обращение зарегистрировано. Мы увидим его в админке.",closed:"Этот тикет закрыт. Создай новое обращение, если нужна помощь.",email:"Ответ также отправляется на email аккаунта.",open:"Открыт",answered:"Ответ поддержки",done:"Закрыт",back:"К списку",categories:["Аккаунт","Билеты","Мероприятие","Техническая проблема","Жалоба","Другое"]},
 en:{title:"Support",intro:"Tell us about a problem or complaint. We will reply to your ticket and email your verified account address.",new:"New support ticket",history:"My tickets",subject:"Subject",body:"Describe what happened",send:"Send ticket",sendReply:"Send message",reply:"Additional information",signed:"Sign in to contact support and receive an email reply.",login:"Sign in",empty:"You have no tickets yet.",loading:"Loading…",sent:"Your request was created. Our admins will see it.",closed:"This ticket is closed. Create another ticket if you need help.",email:"Replies are also emailed to your account.",open:"Open",answered:"Answered",done:"Closed",back:"Back to tickets",categories:["Account","Tickets","Event","Technical issue","Complaint","Other"]},
 cs:{title:"Podpora",intro:"Popište problém nebo stížnost. Odpovíme v požadavku a e-mailem na ověřenou adresu vašeho účtu.",new:"Nový požadavek",history:"Moje požadavky",subject:"Předmět",body:"Popište problém",send:"Odeslat",sendReply:"Odeslat zprávu",reply:"Doplňující informace",signed:"Přihlaste se, abyste mohli kontaktovat podporu a dostat odpověď e-mailem.",login:"Přihlásit se",empty:"Zatím nemáte žádné požadavky.",loading:"Načítání…",sent:"Požadavek byl vytvořen a je dostupný administrátorům.",closed:"Požadavek je uzavřen. V případě potřeby vytvořte nový.",email:"Odpovědi zasíláme také na e-mail účtu.",open:"Otevřeno",answered:"Zodpovězeno",done:"Uzavřeno",back:"Zpět na seznam",categories:["Účet","Vstupenky","Akce","Technický problém","Stížnost","Ostatní"]},
 uk:{title:"Служба підтримки",intro:"Опиши проблему чи скаргу. Ми відповімо в заявці та надішлемо листа на підтверджену адресу акаунта.",new:"Нове звернення",history:"Мої звернення",subject:"Тема",body:"Опиши проблему",send:"Надіслати",sendReply:"Надіслати повідомлення",reply:"Додаткова інформація",signed:"Увійди до акаунта, щоб звернутися до підтримки та отримати відповідь на email.",login:"Увійти",empty:"У тебе ще немає звернень.",loading:"Завантаження…",sent:"Звернення створено. Адміністратори його побачать.",closed:"Звернення закрито. Створи нове, якщо потрібна допомога.",email:"Відповіді також надходять на email акаунта.",open:"Відкрито",answered:"Відповіли",done:"Закрито",back:"До списку",categories:["Акаунт","Квитки","Подія","Технічна проблема","Скарга","Інше"]},
};
const keys=["account","tickets","event","technical","complaint","other"];
function date(s:string){return new Date(s).toLocaleString();}
function label(status:string,t:(typeof words)["ru"]){return status==="open"?t.open:status==="answered"?t.answered:t.done;}
export function SupportClient(){
 const {language}=useLanguage();const t=words[language];
 const [items,setItems]=useState<SupportTicket[]>([]);
 const [thread,setThread]=useState<SupportThread|null>(null);
 const [selected,setSelected]=useState<number|null>(null);
 const [category,setCategory]=useState("technical");
 const [subject,setSubject]=useState("");const [body,setBody]=useState("");const [extra,setExtra]=useState("");
 const [busy,setBusy]=useState(false);const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");const [notice,setNotice]=useState("");
 const [needsLogin,setNeedsLogin]=useState(false);
 const refresh=useCallback(async(id:number|null)=>{
   const rows=await listMySupportTickets();setItems(rows.tickets);
   if(id!==null)setThread(await getMySupportTicket(id));
 },[]);
 useEffect(()=>{
   let active=true;
   const urlId=new URLSearchParams(window.location.search).get("ticket");
   const parsed=urlId&&/^\d+$/.test(urlId)?Number(urlId):null;
   if(parsed)setSelected(parsed);
   refresh(parsed).then(()=>{if(active)setLoading(false)}).catch((e)=>{
     if(active){setNeedsLogin(["login_required","invalid_session","email_verification_required"].includes(e.message));
       setError(e.message);setLoading(false);}
   });
   return()=>{active=false};
 },[refresh]);
 useEffect(()=>{
   if(needsLogin||loading)return;
   const i=window.setInterval(()=>{if(document.visibilityState==="visible")refresh(selected).catch(()=>{});},45000);
   return()=>window.clearInterval(i);
 },[selected,needsLogin,loading,refresh]);
 async function open(id:number){
   setError("");setNotice("");setSelected(id);
   window.history.replaceState(null,"",`/support?ticket=${id}`);
   try{setThread(await getMySupportTicket(id));}catch(e){setError(String(e))}
 }
 function back(){setSelected(null);setThread(null);setError("");window.history.replaceState(null,"","/support");}
 async function create(e:FormEvent){
   e.preventDefault();setBusy(true);setError("");setNotice("");
   try{const result=await createSupportTicket(category,subject.trim(),body.trim());
     setSubject("");setBody("");setNotice(t.sent);await refresh(null);await open(result.id);
   }catch(e){setError(e instanceof Error?e.message:String(e))}
   finally{setBusy(false)}
 }
 async function reply(e:FormEvent){
   e.preventDefault();if(!selected)return;setBusy(true);setError("");setNotice("");
   try{await replyMySupportTicket(selected,extra.trim());setExtra("");await refresh(selected);}
   catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}
 }
 return <div className="app-shell"><AppHeader/><main className="page tt-support-page">
   <span className="eyebrow">TICKETTREAT / HELP</span>
   <h1>{t.title}</h1><p className="tt-support-lead">{t.intro}</p>
   {needsLogin?<section className="panel form-stack"><p>{t.signed}</p><Link href="/profile" className="button button-primary">{t.login}</Link></section>:
    <>
    {error&&<p className="state-card state-error" role="alert">{error}</p>}
    {notice&&<p className="success-banner" role="status">{notice}</p>}
    {loading?<div className="state-card">{t.loading}</div>:selected&&thread?<>
      <button className="button button-outline" type="button" onClick={back}>← {t.back}</button>
      <section className="panel form-stack">
       <div className="tt-support-ticket-heading"><h2>#{thread.ticket.id} · {thread.ticket.subject}</h2>
        <span className="status">{label(thread.ticket.status,t)}</span></div>
       <small>{date(thread.ticket.created_at)} · {t.categories[keys.indexOf(thread.ticket.category)]||thread.ticket.category}</small>
       <div className="tt-support-thread" aria-label="Ticket messages">{thread.messages.map(m=>
        <article key={m.id} className={`tt-support-message ${m.role==="admin"?"is-staff":""}`}>
          <div className="tt-support-message-meta"><strong>{m.role==="admin"?"TicketTreat Support":t.title==="Support"?"You":language==="cs"?"Vy":language==="uk"?"Ви":"Вы"}</strong>
           <small>{date(m.created_at)}</small></div>
          <p>{m.body}</p>
          {m.role==="admin"&&<small>{m.email_status==="sent"?"Email ✓":m.email_status==="failed"?"Email delivery failed":m.email_status==="pending"?"Email queued":""}</small>}
        </article>)}</div>
       {thread.ticket.status==="closed"?<p>{t.closed}</p>:<form className="form-stack" onSubmit={reply}>
         <label>{t.reply}<textarea rows={4} value={extra} minLength={2} maxLength={5000} required onChange={e=>setExtra(e.target.value)} /></label>
         <button type="submit" className="button button-primary" disabled={busy||extra.trim().length<2}>{t.sendReply}</button>
       </form>}
      </section>
    </>:<>
     <section className="panel form-stack"><h2>{t.new}</h2>
      <form className="form-stack" onSubmit={create}>
       <label>{language==="ru"?"Тип обращения":language==="cs"?"Kategorie":language==="uk"?"Категорія":"Category"}
        <select value={category} onChange={e=>setCategory(e.target.value)}>{keys.map((k,i)=><option key={k} value={k}>{t.categories[i]}</option>)}</select>
       </label>
       <label>{t.subject}<input required minLength={4} maxLength={160} value={subject} onChange={e=>setSubject(e.target.value)} /></label>
       <label>{t.body}<textarea rows={6} required minLength={15} maxLength={5000} value={body} onChange={e=>setBody(e.target.value)} /></label>
       <p className="form-note">{t.email} <Link href="/privacy-policy">Privacy Policy</Link>. {language==="ru"?"Не отправляй пароли или банковские данные.":"Never send passwords or bank details."}</p>
       <button className="button button-primary" type="submit" disabled={busy||subject.trim().length<4||body.trim().length<15}>{busy?"…":t.send}</button>
      </form>
     </section>
     <section className="panel form-stack"><h2>{t.history}</h2>
       {!items.length?<p>{t.empty}</p>:<div className="tt-support-list">{items.map(item=>
        <button className="tt-support-list-item" type="button" key={item.id} onClick={()=>void open(item.id)}>
         <span><strong>#{item.id} · {item.subject}</strong><small>{date(item.updated_at)}</small></span>
         <span className="status">{label(item.status,t)}</span>
        </button>)}</div>}
     </section>
    </>}
    </>}
 </main></div>;
}
