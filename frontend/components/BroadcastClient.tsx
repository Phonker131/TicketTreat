"use client";

import Link from "next/link";
import {useEffect,useState} from "react";
import {AppHeader} from "@/components/AppHeader";
import {getWebToken} from "@/lib/session";
import {getManageMe,getManageEvents,previewBroadcast,sendBroadcast,getBroadcastHistory} from "@/lib/api";
import type {BroadcastAudience,BroadcastHistory} from "@/lib/api";
import type {ManageEvent,ManageIdentity} from "@/lib/types";

function messageOf(error:unknown):string {
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
  return errors[raw]||raw;
}

export function BroadcastClient(){
  const [me,setMe]=useState<ManageIdentity|null>(null);
  const [events,setEvents]=useState<ManageEvent[]>([]);
  const [history,setHistory]=useState<BroadcastHistory[]>([]);
  const [scope,setScope]=useState<"global"|"event">("event");
  const [eventId,setEventId]=useState("");
  const [subject,setSubject]=useState("TicketTreat — важная информация");
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
    if(!token){setError("Войди в профиль TicketTreat.");setLoading(false);return;}
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
    }).catch(e=>{if(live)setError(messageOf(e));}).finally(()=>{if(live)setLoading(false);});
    return()=>{live=false;};
  },[]);

  function draft(){
    return {scope,event_id:scope==="global"?null:Number(eventId)};
  }
  async function checkAudience(){
    const token=getWebToken();if(!token)return;
    if(scope==="event" && !eventId){setError("Выбери ивент.");return;}
    setBusy(true);setError("");setSuccess("");
    try {
      const results=await previewBroadcast(token,draft());
      setPreview(results);setConfirmed("");setRequestId("");setSent(null);
    }catch(e){setError(messageOf(e));setPreview(null);}
    finally{setBusy(false);}
  }
  async function deliver(){
    const token=getWebToken();if(!token||!preview||busy)return;
    if(!serviceOnly || confirmed!=="SEND" || !message.trim() || !subject.trim())return;
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
      setSuccess("Рассылка добавлена в очередь. Статусы доставки будут обновляться.");
      setPreview(null);setConfirmed("");
    }catch(e){setError(messageOf(e));}
    finally{setBusy(false);}
  }
  async function refresh(){
    const token=getWebToken();if(!token)return;
    setBusy(true);
    try {
      const items=await getBroadcastHistory(token);
      setHistory(items);
      if(sent){setSent(items.find(item=>item.id===sent.id)||sent);}
    }catch(e){setError(messageOf(e));}
    finally{setBusy(false);}
  }

  const selected=events.find(event=>String(event.id)===eventId);
  const allCount=(preview?.email_recipients||0)+(preview?.telegram_recipients||0);
  return <div className="app-shell"><AppHeader/><main className="page tt-broadcast-page">
    <Link href="/admin" className="back-link">← Панель организатора</Link>
    <div className="admin-heading">
      <div><span className="status status-demo">TICKETTREAT / COMMUNICATIONS</span>
        <h1>📢 Рассылки</h1>
        <p>Служебные объявления по платформе или отдельному ивенту.</p>
      </div>
    </div>
    {error&&<div className="state-card state-error" role="alert">{error}</div>}
    {success&&<div className="success-banner" role="status">{success}</div>}
    {loading&&<div className="state-card">Загрузка…</div>}
    {!loading&&me&&me.role!=="participant"&&<>
      <section className="panel form-stack">
        <h2>1. Кому отправить</h2>
        <div className="tt-broadcast-scope" role="group" aria-label="Аудитория рассылки">
          {me.role==="global_admin"&&<button type="button" className={scope==="global"?"button button-primary":"button button-outline"}
            aria-pressed={scope==="global"} onClick={()=>{setScope("global");invalidate();}}>🌍 Всем пользователям</button>}
          <button type="button" className={scope==="event"?"button button-primary":"button button-outline"}
            aria-pressed={scope==="event"} onClick={()=>{setScope("event");invalidate();}}>🎟 Участникам ивента</button>
        </div>
        {scope==="event"&&<label>Выбери мероприятие
          <select value={eventId} onChange={e=>{setEventId(e.target.value);invalidate();}}>
            {!events.length&&<option value="">Нет доступных мероприятий</option>}
            {events.map(event=><option key={event.id} value={event.id}>{event.title} (#{event.id})</option>)}
          </select>
          {selected&&<small>Уведомления получат участники именно этого события с подтверждёнными контактами.</small>}
        </label>}
        {scope==="global"&&<p className="form-note">Только главный администратор может отправлять сообщения всем пользователям платформы. Лимит: одна глобальная рассылка за 24 часа.</p>}
        {scope==="event"&&<p className="form-note">Владелец может отправлять сообщения только по собственным событиям. Лимит: две рассылки на событие в сутки.</p>}
      </section>
      <section className="panel form-stack">
        <h2>2. Сообщение</h2>
        <label>Заголовок
          <input value={subject} maxLength={160} minLength={5} onChange={e=>{setSubject(e.target.value);invalidate();}} placeholder="Важные изменения по мероприятию"/>
        </label>
        <label>Текст рассылки
          <textarea value={message} rows={6} minLength={20} maxLength={1000}
            placeholder="Напиши важную информацию для участников…"
            onChange={e=>{setMessage(e.target.value);invalidate();}}/>
          <small>{message.length}/1000 символов</small>
        </label>
        <label>Ссылка на изображение (необязательно)
          <input type="url" value={imageUrl} maxLength={1000} placeholder="https://example.com/photo.jpg"
            onChange={e=>{setImageUrl(e.target.value);invalidate();}}/>
          <small>Публичный HTTPS-адрес картинки для Telegram и email. Необязательно.</small>
        </label>
        <div className="tt-broadcast-preview">
          <strong>{subject||"Заголовок"}</strong>
          <p>{message||"Текст сообщения появится здесь."}</p>
          {imageUrl&&<small>🖼 Изображение прикреплено</small>}
        </div>
      </section>
      <section className="panel form-stack">
        <h2>3. Проверка и отправка</h2>
        <button type="button" className="button button-outline" disabled={busy||scope==="event"&&!eventId}
          onClick={checkAudience}>{busy?"Проверяем…":"👥 Посчитать получателей"}</button>
        {preview&&<>
          <div className="tt-broadcast-stats">
            <div><strong>{preview.email_recipients}</strong><span>📧 Email</span><small>{preview.email_available?"Подключён":"Провайдер отключён"}</small></div>
            <div><strong>{preview.telegram_recipients}</strong><span>✈️ Telegram</span><small>{preview.telegram_available?"Подключён":"Бот недоступен"}</small></div>
          </div>
          {allCount===0&&<p role="status">Сейчас нет адресатов для рассылки.</p>}
          <label className="tt-broadcast-consent">
            <input type="checkbox" checked={serviceOnly} onChange={e=>setServiceOnly(e.target.checked)}/>
            <span>Подтверждаю, что это служебное сообщение, связанное с TicketTreat или участием в событии, а не рекламная рассылка без согласия получателей.</span>
          </label>
          <label>Для подтверждения введи <strong>SEND</strong>
            <input value={confirmed} onChange={e=>setConfirmed(e.target.value)} autoComplete="off" placeholder="SEND"/>
          </label>
          <button className="button button-primary" type="button" onClick={deliver}
            disabled={busy||allCount===0||!serviceOnly||confirmed!=="SEND"||subject.trim().length<5||message.trim().length<20||(!preview.email_available&&!preview.telegram_available)}>
            {busy?"Отправляем…":"📢 Подтвердить рассылку"}
          </button>
          <small>Рассылка запускается только после подтверждения. Количество сообщений по каналам может отличаться, а один человек может получить их в обоих каналах.</small>
        </>}
      </section>
      <section className="panel form-stack">
        <div className="tt-broadcast-history-heading"><h2>История отправок</h2>
          <button className="button button-outline" type="button" disabled={busy} onClick={refresh}>↻ Обновить</button></div>
        {!history.length&&<p>История рассылок пока пустая.</p>}
        {history.map(c=><article className="tt-broadcast-history" key={c.id}>
          <div><strong>{c.subject}</strong><small>#{c.id} · {c.scope==="global"?"Все пользователи":"Ивент #"+c.event_id} · {new Date(c.created_at).toLocaleString()}</small></div>
          <p>📧 Email: {c.emails.sent||0}/{c.email_count} отправлено · {c.emails.failed||0} ошибок</p>
          <p>✈️ Telegram: {c.telegram.sent||0}/{c.telegram_count} отправлено · {c.telegram.failed||0} ошибок · {c.telegram.skipped||0} недоступно</p>
        </article>)}
      </section>
    </>}
  </main></div>;
}
