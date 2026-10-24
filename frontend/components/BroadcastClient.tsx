"use client";

import Link from "next/link";
import {useEffect,useState} from "react";
import {AppHeader} from "@/components/AppHeader";
import {useLanguage} from "@/components/LanguageProvider";
import {broadcastText} from "@/lib/broadcast-i18n";
import {localeForLanguage} from "@/lib/i18n";
import {getWebToken} from "@/lib/session";
import {getManageMe,getManageEvents,previewBroadcast,sendBroadcast,getBroadcastHistory} from "@/lib/api";
import type {BroadcastAudience,BroadcastHistory} from "@/lib/api";
import type {ManageEvent,ManageIdentity} from "@/lib/types";

function messageOf(error:unknown,language: "en"|"cs"|"ru"|"uk"):string {
  const raw=error instanceof Error?error.message:String(error);
  const errors:Record<string,string>={
    global_admin_required:"Общая рассылка доступна только главным администраторам.",
    event_not_owned:"У тебя нет прав на рассылку по этому событию.",
    broadcast_audience_changed_preview_again:"Число получателей изменилось. Проверь аудиторию повторно.",
    global_broadcast_limit_one_per_24h:"Глобальная рассылка разрешена один раз в 24 часа.",
    event_broadcast_limit_two_per_24h:"На один ивент разрешены две рассылки в сутки.",
    broadcast_audience_empty:"Подходящих получателей пока нет.",
    broadcast_providers_unavailable:"Не настроены каналы доставки. Проверь Resend и Telegram.",
    audience_exceeds_50000_per_channel:"Аудитория превышает допустимый размер рассылки.",
  };
  const text = errors[raw] || raw;
  if (/^[a-z][a-z0-9_]{2,}$/.test(text)) return broadcastText(language,"Не удалось выполнить действие. Попробуй ещё раз.");
  return broadcastText(language,text);
}

const MIN_SUBJECT_CHARS=5;
const MIN_MESSAGE_CHARS=20;

export function BroadcastClient(){
  const {language}=useLanguage();
  const tr=(text:string)=>broadcastText(language,text);
  const [me,setMe]=useState<ManageIdentity|null>(null);
  const [events,setEvents]=useState<ManageEvent[]>([]);
  const [history,setHistory]=useState<BroadcastHistory[]>([]);
  const [scope,setScope]=useState<"global"|"event">("event");
  const [eventId,setEventId]=useState("");
  const [subject,setSubject]=useState("TicketTreat");
  const [message,setMessage]=useState("");
  const [imageUrl,setImageUrl]=useState("");
  const [preview,setPreview]=useState<BroadcastAudience|null>(null);
  const [confirmed,setConfirmed]=useState("");
  const [serviceOnly,setServiceOnly]=useState(false);
  const [requestId,setRequestId]=useState("");
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");
  const [sent,setSent]=useState<BroadcastHistory|null>(null);

  function invalidate(){
    setPreview(null);setConfirmed("");setRequestId("");setSent(null);setError("");setSuccess("");
  }
  useEffect(()=>{
    const token=getWebToken();
    if(!token){setError(tr("Войди в профиль TicketTreat."));setLoading(false);return;}
    let live=true;
    Promise.all([getManageMe(token),getManageEvents(token),getBroadcastHistory(token)]).then(([who,list,previous])=>{
      if(!live)return;
      setMe(who);setEvents(list);setHistory(previous);
      const chosen=new URLSearchParams(window.location.search).get("event_id");
      if(chosen && list.some(event=>String(event.id)===chosen)){
        setScope("event");setEventId(chosen);
      }else{
        setScope(who.role==="global_admin"?"global":"event");
        setEventId(list.length?String(list[0].id):"");
      }
    }).catch(e=>{if(live)setError(e instanceof Error?e.message:String(e));}).finally(()=>{if(live)setLoading(false);});
    return()=>{live=false;};
  },[]);

  function draft(){
    return {scope,event_id:scope==="global"?null:Number(eventId)};
  }
  async function checkAudience(){
    const token=getWebToken();if(!token)return;
    if(scope==="event" && !eventId){setError(tr("Выбери ивент."));return;}
    setBusy(true);setError("");setSuccess("");
    try {
      const results=await previewBroadcast(token,draft());
      setPreview(results);setConfirmed("");setRequestId("");setSent(null);
    }catch(e){setError(e instanceof Error?e.message:String(e));setPreview(null);}
    finally{setBusy(false);}
  }
  async function deliver(){
    const token=getWebToken();if(!token||!preview||busy)return;
    // Keep the click handler and the disabled button in sync.
    if(!canSend)return;
    if(!requestId)setRequestId(crypto.randomUUID());
    const id=requestId||crypto.randomUUID();
    setRequestId(id);
    setBusy(true);setError("");setSuccess("");
    try{
      const campaign=await sendBroadcast(token,{
        ...draft(),request_id:id,subject:subject.trim(),message:message.trim(),
        image_url:imageUrl.trim()||null,
        expected_email_recipients:preview.email_recipients,
        expected_telegram_recipients:preview.telegram_recipients,
        confirm:"SEND",service_only:true,
      });
      setSent(campaign);
      setHistory(current=>[campaign,...current.filter(row=>row.id!==campaign.id)]);
      setSuccess(tr("Рассылка добавлена в очередь. Статусы доставки будут обновляться."));
      setPreview(null);setConfirmed("");
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  }
  async function refresh(){
    const token=getWebToken();if(!token)return;
    setBusy(true);
    try {
      const items=await getBroadcastHistory(token);
      setHistory(items);
      if(sent){setSent(items.find(item=>item.id===sent.id)||sent);}
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  }

  const selected=events.find(event=>String(event.id)===eventId);
  const allCount=(preview?.email_recipients||0)+(preview?.telegram_recipients||0);
  const subjectChars=subject.trim().length;
  const messageChars=message.trim().length;
  const blockers:string[]=[];
  if(preview){
    if(allCount===0)blockers.push(tr("Нет подтверждённых получателей. Выбери другую аудиторию."));
    if(!preview.email_available&&!preview.telegram_available)blockers.push(tr("Сейчас недоступны оба канала рассылки."));
    if(subjectChars<MIN_SUBJECT_CHARS)blockers.push(`${tr("Заголовок: добавь ещё")} ${MIN_SUBJECT_CHARS-subjectChars} ${tr("симв. (минимум")} ${MIN_SUBJECT_CHARS}).`);
    if(messageChars<MIN_MESSAGE_CHARS)blockers.push(`${tr("Текст рассылки: добавь ещё")} ${MIN_MESSAGE_CHARS-messageChars} ${tr("симв. (минимум")} ${MIN_MESSAGE_CHARS}).`);
    if(!serviceOnly)blockers.push(tr("Подтверди, что это служебное сообщение."));
    if(confirmed.trim()!=="SEND")blockers.push(tr("Введи SEND в поле подтверждения."));
  }
  const canSend=Boolean(preview)&&!busy&&blockers.length===0;
  return <div className="app-shell"><AppHeader/><main className="page tt-broadcast-page">
    <Link href="/admin" className="back-link">{tr("← Панель организатора")}</Link>
    <div className="admin-heading">
      <div><span className="status status-demo">TICKETTREAT / COMMUNICATIONS</span>
        <h1>{tr("📢 Рассылки")}</h1>
        <p>{tr("Служебные объявления по платформе или отдельному ивенту.")}</p>
      </div>
    </div>
    {error&&<div className="state-card state-error" role="alert">{messageOf(error,language)}</div>}
    {success&&<div className="success-banner" role="status">{tr(success)}</div>}
    {loading&&<div className="state-card">{tr("Загрузка…")}</div>}
    {!loading&&me&&me.role!=="participant"&&<>
      <section className="panel form-stack">
        <h2>{tr("1. Кому отправить")}</h2>
        <div className="tt-broadcast-scope" role="group" aria-label={tr("Аудитория рассылки")}>
          {me.role==="global_admin"&&<button type="button" className={scope==="global"?"button button-primary":"button button-outline"}
            aria-pressed={scope==="global"} onClick={()=>{setScope("global");invalidate();}}>{tr("🌍 Всем пользователям")}</button>}
          <button type="button" className={scope==="event"?"button button-primary":"button button-outline"}
            aria-pressed={scope==="event"} onClick={()=>{setScope("event");invalidate();}}>{tr("🎟 Участникам ивента")}</button>
        </div>
        {scope==="event"&&<label>{tr("Выбери мероприятие")}
          <select value={eventId} onChange={e=>{setEventId(e.target.value);invalidate();}}>
            {!events.length&&<option value="">{tr("Нет доступных мероприятий")}</option>}
            {events.map(event=><option key={event.id} value={event.id}>{event.title} (#{event.id})</option>)}
          </select>
          {selected&&<small>{tr("Уведомления получат участники именно этого события с подтверждёнными контактами.")}</small>}
        </label>}
        {scope==="global"&&<p className="form-note">{tr("Только главный администратор может отправлять сообщения всем пользователям платформы. Лимит: одна глобальная рассылка за 24 часа.")}</p>}
        {scope==="event"&&<p className="form-note">{tr("Владелец может отправлять сообщения только по собственным событиям. Лимит: две рассылки на событие в сутки.")}</p>}
      </section>
      <section className="panel form-stack">
        <h2>{tr("2. Сообщение")}</h2>
        <label>{tr("Заголовок")}
          <input value={subject} maxLength={160} minLength={5} onChange={e=>{setSubject(e.target.value);invalidate();}} placeholder={tr("Важные изменения по мероприятию")}/>
        </label>
        <label>{tr("Текст рассылки")}
          <textarea value={message} rows={6} minLength={20} maxLength={1000}
            placeholder={tr("Напиши важную информацию для участников…")}
            onChange={e=>{setMessage(e.target.value);invalidate();}}/>
          <small className={messageChars<MIN_MESSAGE_CHARS?"tt-broadcast-length-warning":"tt-broadcast-length-ok"} aria-live="polite">
            {messageChars<MIN_MESSAGE_CHARS
              ?`${tr("Минимум")} ${MIN_MESSAGE_CHARS} ${tr("символов")}. ${tr("Сейчас")} ${messageChars} — ${tr("добавь ещё")} ${MIN_MESSAGE_CHARS-messageChars}.`
              :`${tr("✓ Текст готов к отправке:")} ${messageChars}/1000 ${tr("символов")}.`}
          </small>
        </label>
        <label>{tr("Ссылка на изображение (необязательно)")}
          <input type="url" value={imageUrl} maxLength={1000} placeholder="https://example.com/photo.jpg"
            onChange={e=>{setImageUrl(e.target.value);invalidate();}}/>
          <small>{tr("Публичный HTTPS-адрес картинки для Telegram и email. Необязательно.")}</small>
        </label>
        <div className="tt-broadcast-preview">
          <strong>{subject||tr("Заголовок")}</strong>
          <p>{message||tr("Текст сообщения появится здесь.")}</p>
          {imageUrl&&<small>{tr("🖼 Изображение прикреплено")}</small>}
        </div>
      </section>
      <section className="panel form-stack">
        <h2>{tr("3. Проверка и отправка")}</h2>
        {!preview&&<p className="form-note">{tr("Сначала нажми «Посчитать получателей». После изменения заголовка или текста проверку аудитории нужно повторить. Для отправки требуется заголовок от 5 и текст от 20 символов.")}</p>}
        <button type="button" className="button button-outline" disabled={busy||scope==="event"&&!eventId}
          onClick={checkAudience}>{busy?tr("Проверяем…"):tr("👥 Посчитать получателей")}</button>
        {preview&&<>
          <div className="tt-broadcast-stats">
            <div><strong>{preview.email_recipients}</strong><span>📧 Email</span><small>{preview.email_available?tr("Подключён"):tr("Провайдер отключён")}</small></div>
            <div><strong>{preview.telegram_recipients}</strong><span>✈️ Telegram</span><small>{preview.telegram_available?tr("Подключён"):tr("Бот недоступен")}</small></div>
          </div>
          {allCount===0&&<p role="status">{tr("Сейчас нет адресатов для рассылки.")}</p>}
          <label className="tt-broadcast-consent">
            <input type="checkbox" checked={serviceOnly} onChange={e=>setServiceOnly(e.target.checked)}/>
            <span>{tr("Подтверждаю, что это служебное сообщение, связанное с TicketTreat или участием в событии, а не рекламная рассылка без согласия получателей.")}</span>
          </label>
          <label>{tr("Для подтверждения введи")} <strong>SEND</strong>
            <input value={confirmed} onChange={e=>setConfirmed(e.target.value.toUpperCase().slice(0,4))}
              autoCapitalize="characters" spellCheck={false} maxLength={4} autoComplete="off" placeholder="SEND"/>
          </label>
          {blockers.length>0
            ?<div className="tt-broadcast-validation" role="status" aria-live="polite">
              <strong>{tr("Что ещё нужно для отправки:")}</strong>
              <ul>{blockers.map(item=><li key={item}>{item}</li>)}</ul>
            </div>
            :<div className="tt-broadcast-ready" role="status">{tr("✓ Все проверки пройдены. Рассылка готова к подтверждению.")}</div>}
          <button className="button button-primary" type="button" onClick={deliver}
            disabled={!canSend} aria-describedby="tt-broadcast-send-explainer">
            {busy?tr("Отправляем…"):tr("📢 Подтвердить рассылку")}
          </button>
          <small id="tt-broadcast-send-explainer">{tr("Рассылка запускается только после подтверждения. Количество сообщений по каналам может отличаться, а один человек может получить их в обоих каналах.")}</small>
        </>}
      </section>
      <section className="panel form-stack">
        <div className="tt-broadcast-history-heading"><h2>{tr("История отправок")}</h2>
          <button className="button button-outline" type="button" disabled={busy} onClick={refresh}>{tr("↻ Обновить")}</button></div>
        {!history.length&&<p>{tr("История рассылок пока пустая.")}</p>}
        {history.map(c=><article className="tt-broadcast-history" key={c.id}>
          <div><strong>{c.subject}</strong><small>#{c.id} · {c.scope==="global"?tr("Все пользователи"):tr("Ивент #")+c.event_id} · {new Date(c.created_at).toLocaleString(localeForLanguage(language))}</small></div>
          <p>📧 Email: {c.emails.sent||0}/{c.email_count} {tr("отправлено")} · {c.emails.failed||0} {tr("ошибок")}</p>
          <p>✈️ Telegram: {c.telegram.sent||0}/{c.telegram_count} {tr("отправлено")} · {c.telegram.failed||0} {tr("ошибок")} · {c.telegram.skipped||0} {tr("недоступно")}</p>
        </article>)}
      </section>
    </>}
  </main></div>;
}
