"use client";

import Link from "next/link";
import {useSearchParams} from "next/navigation";
import {useCallback,useEffect,useRef,useState,type FormEvent} from "react";
import {AppHeader} from "@/components/AppHeader";
import {useLanguage} from "@/components/LanguageProvider";
import {userFacingError} from "@/lib/user-facing-errors";
import {
  getMyEventChats,getManageEventChats,getEventConversation,getMyConversation,
  getManageConversation,sendFirstEventMessage,sendMyConversationMessage,
  sendManageConversationMessage,readMyConversation,readManageConversation,
  setManageConversationClosed,type EventChatDetail,type EventChatMessage,
  type EventChatThread,
} from "@/lib/api";

type Mode="participant"|"organizer";
const labels={
 en:{
  messageOrganizer:"Message organizer",chatHelp:"Ask the organizer about this event. Messages are private and separate from TicketTreat support.",
  open:"Open chat",hide:"Hide chat",guest:"You",organizer:"Organizer",
  title:"Messages",staffTitle:"Organizer inbox",intro:"Private conversations with event organizers.",
  staffIntro:"Reply to attendee questions about your events. Only conversations you are allowed to manage are shown.",
  empty:"No conversations yet.",emptyThread:"No messages yet. Ask your first question.",
  event:"Event",send:"Send",sending:"Sending…",placeholder:"Write a message…",
  login:"Sign in to send a message",signInHelp:"Sign in to your TicketTreat account or open the Telegram Mini App.",
  closed:"This conversation is closed. The organizer can reopen it.",
  reopen:"Reopen",close:"Close conversation",unread:"New",
  loadOlder:"Older messages",refresh:"Refresh",loading:"Loading messages…",unavailable:"Organizer messaging is unavailable for this event.",
  note:"Do not share passwords, payment card details or sensitive documents in chat.",
  support:"Contact TicketTreat support",everyone:"All",openOnly:"Open",count:"conversations",
  noAccess:"Sign in with your organizer account and complete MFA to see your inbox.",
  time:"Conversation updates automatically while this page is open.",
  noThread:"Select a conversation to read it.",retry:"Try again",
 },
 cs:{
  messageOrganizer:"Napsat pořadateli",chatHelp:"Zeptejte se pořadatele na tuto akci. Zprávy jsou soukromé a oddělené od podpory TicketTreat.",
  open:"Otevřít chat",hide:"Skrýt chat",guest:"Vy",organizer:"Pořadatel",
  title:"Zprávy",staffTitle:"Zprávy pořadatele",intro:"Soukromé konverzace s pořadateli akcí.",
  staffIntro:"Odpovídejte na dotazy účastníků vašich akcí. Zobrazí se pouze konverzace, ke kterým máte přístup.",
  empty:"Zatím žádné konverzace.",emptyThread:"Zatím žádné zprávy. Položte první otázku.",
  event:"Akce",send:"Odeslat",sending:"Odesílání…",placeholder:"Napište zprávu…",
  login:"Přihlásit se pro zaslání zprávy",signInHelp:"Přihlaste se k účtu TicketTreat nebo otevřete aplikaci v Telegramu.",
  closed:"Konverzace je uzavřená. Pořadatel ji může znovu otevřít.",
  reopen:"Znovu otevřít",close:"Uzavřít konverzaci",unread:"Nové",
  loadOlder:"Starší zprávy",refresh:"Obnovit",loading:"Načítání zpráv…",unavailable:"Zprávy pořadateli nejsou pro tuto akci dostupné.",
  note:"V chatu nesdílejte hesla, údaje o platební kartě ani citlivé dokumenty.",
  support:"Kontaktovat podporu TicketTreat",everyone:"Vše",openOnly:"Otevřené",count:"konverzací",
  noAccess:"Přihlaste se jako pořadatel a dokončete MFA.",
  time:"Konverzace se automaticky aktualizuje, dokud je stránka otevřená.",
  noThread:"Vyberte konverzaci.",retry:"Zkusit znovu",
 }
} as const;

function date(iso:string,lang:"cs"|"en"){
 const d=new Date(iso);
 return Number.isNaN(d.getTime())?"":new Intl.DateTimeFormat(lang==="cs"?"cs-CZ":"en-GB",{
  day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"
 }).format(d);
}
function mergeMessages(old:EventChatMessage[],incoming:EventChatMessage[]):EventChatMessage[]{
 const items=new Map<number,EventChatMessage>();
 old.forEach(m=>items.set(m.id,m));incoming.forEach(m=>items.set(m.id,m));
 return [...items.values()].sort((a,b)=>a.id-b.id).slice(-500);
}
function nonce():string{
 if(typeof crypto!=="undefined"&&typeof crypto.randomUUID==="function")return crypto.randomUUID();
 // Modern HTTPS browsers, including Telegram WebView, support randomUUID.
 // Never send an uncertain idempotency token when secure randomness is absent.
 throw new Error("secure_browser_required");
}
function requiresLogin(error:string){
 return ["login_required","invalid_session","session_expired","telegram_login_required",
  "please_login_again","email_verification_required"].some(part=>error.includes(part));
}

export function ConversationPane({mode,threadId,eventId,inviteToken,onChange}:{
 mode:Mode;threadId?:number|null;eventId?:number|null;inviteToken?:string|null;onChange?:()=>void;
}){
 const {language}=useLanguage(),lang=language==="cs"?"cs":"en",t=labels[lang];
 const [data,setData]=useState<EventChatDetail|null>(null);
 const [draft,setDraft]=useState("");
 const [waiting,setWaiting]=useState(true),[sending,setSending]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [loadingOlder,setLoadingOlder]=useState(false),[changing,setChanging]=useState(false);
 const pending=useRef<{text:string;nonce:string}|null>(null);
 const paneRef=useRef<HTMLDivElement|null>(null);
 const activeId=data?.thread?.id ?? threadId ?? null;
 const reload=useCallback(async()=>{
  const next=mode==="organizer"
   ?(threadId?await getManageConversation(threadId):null)
   :(threadId?await getMyConversation(threadId):
      eventId?await getEventConversation(eventId,inviteToken):null);
  if(next){
   setData(previous=>({...next,messages:mergeMessages(previous?.messages||[],next.messages),
     has_more:previous?.has_more||next.has_more}));
  }
  return next;
 },[mode,threadId,eventId,inviteToken]);
 useEffect(()=>{
  let live=true;
  setWaiting(true);setError("");setNotice("");setData(null);pending.current=null;setDraft("");
  const load=async()=>{try{await reload();if(live)setError("")}
   catch(e){if(live)setError(e instanceof Error?e.message:"chat_unavailable")}
   finally{if(live)setWaiting(false)}};
  void load();
  const timer=window.setInterval(()=>{
   if(live&&document.visibilityState==="visible")void reload().catch(()=>{});
  },12000);
  return()=>{live=false;window.clearInterval(timer)};
 },[reload]);
 useEffect(()=>{
  if(!activeId||waiting||document.visibilityState!=="visible")return;
  const task=mode==="organizer"?readManageConversation(activeId):readMyConversation(activeId);
  void task.catch(()=>{});
 },[mode,activeId,waiting,data?.thread?.unread]);
 async function send(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  const body=draft.trim();
  if(body.length<2||body.length>2000||sending)return;
  setSending(true);setError("");setNotice("");
  try{
   if(!pending.current||pending.current.text!==body){
    pending.current={text:body,nonce:nonce()};
   }
   const idempotency=pending.current.nonce;
   if(mode==="organizer"){
    if(!activeId)throw new Error("conversation_not_found");
    await sendManageConversationMessage(activeId,body,idempotency);
   }else if(activeId){
    await sendMyConversationMessage(activeId,body,idempotency);
   }else if(eventId){
    await sendFirstEventMessage(eventId,body,idempotency,inviteToken);
   }else throw new Error("conversation_not_found");
   pending.current=null;setDraft("");
   await reload();onChange?.();
   if(paneRef.current)paneRef.current.scrollTop=paneRef.current.scrollHeight;
  }catch(e){setError(e instanceof Error?e.message:"chat_send_failed")}
  finally{setSending(false)}
 }
 async function older(){
  const oldest=data?.messages[0]?.id;
  if(!oldest||!activeId||loadingOlder)return;
  setLoadingOlder(true);setError("");
  try{
   const prev=mode==="organizer"?await getManageConversation(activeId,oldest):await getMyConversation(activeId,oldest);
   setData(current=>current?{...current,
    messages:mergeMessages(prev.messages,current.messages),has_more:prev.has_more}:prev);
  }catch(e){setError(userFacingError(e,language))}
  finally{setLoadingOlder(false)}
 }
 async function changeClosed(closed:boolean){
  if(!activeId)return;setChanging(true);setError("");
  try{await setManageConversationClosed(activeId,closed);await reload();onChange?.()}
  catch(e){setError(userFacingError(e,language))}
  finally{setChanging(false)}
 }
 const login=requiresLogin(error);
 const unavailable=error==="organizer_chat_unavailable"||error==="event_not_found";
 return <section className="tt-chat-pane" aria-label={t.messageOrganizer}>
  {waiting?<div className="state-card" role="status">{t.loading}</div>:
   error&&(!data||!data.thread)&&!login&&!unavailable?
     <div role="alert" className="state-card state-error">{userFacingError(new Error(error),language)}
       <button type="button" className="button button-outline" onClick={()=>void reload().catch(()=>{})}>{t.retry}</button>
     </div>:
   login?<div className="tt-chat-login">
     <p>{t.signInHelp}</p><Link href="/login" className="button button-primary">{t.login}</Link>
   </div>:
   unavailable?<p className="form-note">{t.unavailable}</p>:
   <>
    {data?.thread&&<div className="tt-chat-thread-head">
     <div><strong>{data.thread.event_title}</strong>
      {mode==="organizer"&&data.thread.participant_name&&<small>{data.thread.participant_name}</small>}
     </div>
     {mode==="organizer"&&<button type="button" disabled={changing}
      className="button button-outline" onClick={()=>void changeClosed(data.thread!.status!=="closed")}>
      {data.thread.status==="closed"?t.reopen:t.close}
     </button>}
    </div>}
    <div className="tt-chat-message-scroll" ref={paneRef} role="log" aria-label={t.title} aria-live="polite">
     {data?.has_more&&<button type="button" className="tt-chat-older" disabled={loadingOlder}
      onClick={()=>void older()}>{t.loadOlder}</button>}
     {!(data?.messages.length)&&<p className="tt-chat-empty">{t.emptyThread}</p>}
     {data?.messages.map(msg=>{
      const own=mode==="organizer"?msg.sender_kind==="organizer":msg.sender_kind==="participant";
      return <article key={msg.id} className={"tt-chat-bubble"+(own?" is-own":"")}>
       <div className="tt-chat-msg-meta"><strong>{msg.sender_kind==="organizer"?t.organizer:t.guest}</strong>
         <time dateTime={msg.created_at}>{date(msg.created_at,lang)}</time></div>
       <p>{msg.body}</p>
      </article>;
     })}
    </div>
    {error&&<p role="alert" className="tt-chat-error">{userFacingError(new Error(error),language)}</p>}
    {notice&&<p role="status">{notice}</p>}
    {data?.thread?.status==="closed"?<p className="tt-chat-closed">{t.closed}</p>:
     <form className="tt-chat-compose" onSubmit={send}>
      <label className="sr-only" htmlFor={"tt-chat-compose-"+mode+"-"+(eventId||threadId)}>{t.placeholder}</label>
      <textarea id={"tt-chat-compose-"+mode+"-"+(eventId||threadId)}
       rows={3} maxLength={2000} required minLength={2} value={draft}
       placeholder={t.placeholder} onChange={e=>{setDraft(e.target.value);if(pending.current?.text!==e.target.value.trim())pending.current=null;}}
       onKeyDown={e=>{
        if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)){e.preventDefault();e.currentTarget.form?.requestSubmit();}
       }}/>
      <button className="button button-primary" type="submit"
       disabled={sending||draft.trim().length<2||draft.trim().length>2000}>
       {sending?t.sending:t.send}
      </button>
     </form>}
    <p className="tt-chat-safety">{t.note} <Link href="/support">{t.support}</Link>.</p>
   </>
  }
 </section>;
}

export function EventOrganizerChat({eventId,inviteToken}:{
 eventId:number;inviteToken?:string|null;
}){
 const {language}=useLanguage(),lang=language==="cs"?"cs":"en",t=labels[lang];
 const [open,setOpen]=useState(false);
 return <section className="panel tt-event-chat-inline">
  <div className="tt-chat-inline-head"><div>
   <h2>{t.messageOrganizer}</h2><p>{t.chatHelp}</p>
  </div><button type="button" className="button button-outline" onClick={()=>setOpen(v=>!v)}
   aria-expanded={open}>{open?t.hide:t.open}</button></div>
  {open&&<ConversationPane mode="participant" eventId={eventId} inviteToken={inviteToken}/>}
 </section>;
}

export function EventChatInbox({mode}:{mode:Mode}){
 const {language}=useLanguage(),lang=language==="cs"?"cs":"en",t=labels[lang];
 const search=useSearchParams();
 const queryThread=Number(search.get("thread"));
 const [threads,setThreads]=useState<EventChatThread[]>([]);
 const [selected,setSelected]=useState<number|null>(null);
 const [loading,setLoading]=useState(true),[error,setError]=useState("");
 const [onlyOpen,setOnlyOpen]=useState(false);
 const load=useCallback(async()=>{
  const result=mode==="organizer"?await getManageEventChats():await getMyEventChats();
  setThreads(result.threads);
  return result.threads;
 },[mode]);
 useEffect(()=>{
  let live=true;
  const fetchAll=async()=>{try{const items=await load();if(live){
   setSelected(prev=>prev&&items.some(x=>x.id===prev)?prev:
     Number.isInteger(queryThread)&&queryThread>0&&items.some(x=>x.id===queryThread)
     ?queryThread:items[0]?.id||null);
  }}catch(e){if(live)setError(e instanceof Error?e.message:"chat_unavailable")}
  finally{if(live)setLoading(false)}};
  void fetchAll();
  const timer=window.setInterval(()=>{
   if(document.visibilityState==="visible")void load().catch(()=>{});
  },15000);
  return()=>{live=false;window.clearInterval(timer)};
 },[load,queryThread]);
 const visible=threads.filter(x=>!onlyOpen||x.status==="open");
 const current=threads.find(x=>x.id===selected);
 return <div className="app-shell"><AppHeader/><main className="page tt-chat-page">
  <Link href={mode==="organizer"?"/admin":"/"} className="back-link">← {mode==="organizer"?"Dashboard":t.event}</Link>
  <div className="section-heading"><div><h1>{mode==="organizer"?t.staffTitle:t.title}</h1>
   <p>{mode==="organizer"?t.staffIntro:t.intro}</p></div>
   <button type="button" className="button button-outline" onClick={()=>void load().catch(e=>setError(String(e)))}>
    {t.refresh}</button>
  </div>
  {error&&<div role="alert" className="state-card state-error">
    {mode==="organizer"?t.noAccess:userFacingError(new Error(error),language)}
    {requiresLogin(error)&&<Link href="/login" className="button button-primary">{t.login}</Link>}
    {mode==="organizer"&&<Link href="/security/mfa" className="button button-outline">MFA</Link>}
  </div>}
  {loading?<div className="state-card">{t.loading}</div>:
  !threads.length?<div className="panel tt-chat-inbox-empty">
    <p>{t.empty}</p>{mode==="participant"&&<Link href="/" className="button button-primary">{t.event}</Link>}
  </div>:
  <div className="tt-chat-inbox">
   <aside className="tt-chat-thread-list" aria-label={t.title}>
    <div className="tt-chat-list-head"><strong>{threads.length} {t.count}</strong>
     <button type="button" className={"tt-chat-filter"+(onlyOpen?" is-active":"")}
      onClick={()=>setOnlyOpen(v=>!v)} aria-pressed={onlyOpen}>
      {onlyOpen?t.openOnly:t.everyone}</button>
    </div>
    {visible.map(thread=><button key={thread.id} type="button"
     className={"tt-chat-list-item"+(thread.id===selected?" is-selected":"")}
     aria-current={thread.id===selected?"true":undefined}
     onClick={()=>setSelected(thread.id)}>
      <strong>{thread.event_title}</strong>
      {mode==="organizer"&&thread.participant_name&&<small>{thread.participant_name}</small>}
      <span>{date(thread.updated_at,lang)} {thread.unread&&<b className="tt-chat-unread">{t.unread}</b>}</span>
     </button>)}
   </aside>
   <div className="tt-chat-inbox-content">
    {current?<ConversationPane key={mode+"-"+current.id} mode={mode} threadId={current.id}
     onChange={()=>{void load().catch(()=>{})}}/>:
     <p className="state-card">{t.noThread}</p>}
   </div>
  </div>}
  <p className="form-note tt-chat-poll-note">{t.time}</p>
 </main></div>;
}
