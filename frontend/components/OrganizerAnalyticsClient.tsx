"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {AppHeader} from "@/components/AppHeader";
import {useLanguage} from "@/components/LanguageProvider";
import {getOrganizerAnalytics,type OrganizerAnalytics,type OrganizerAnalyticsEvent} from "@/lib/api";
import type {LanguageCode} from "@/lib/types";

type Copy=Record<string,string>;
const WORDS:Record<LanguageCode,Copy>={
  ru:{title:"Аналитика организатора",subtitle:"Обзор всех мероприятий, регистраций и посещаемости на основе реальных данных TicketTreat.",back:"Панель организатора",loading:"Загружаем аналитику…",error:"Не удалось получить статистику. Проверьте авторизацию организатора и двухфакторную защиту.",reload:"Обновить",all:"Все",upcoming:"Предстоящие",finished:"Завершённые",cancelled:"Отменённые",search:"Найти мероприятие",events:"Мероприятия",registered:"Занятые места",qr:"Активные QR-билеты",arrived:"QR check-in",waitlist:"В листе ожидания",holds:"Ожидают подтверждения оплаты",urgent:"Истекают в следующие 24 часа",attendance:"Доля QR check-in",occupancy:"Заполненность",trend:"Активные QR-регистрации по датам",channels:"Источники активных QR-регистраций",table:"Операционный статус мероприятий",name:"Мероприятие",bookings:"Занято / вместимость",payments:"Ожидают оплаты",arrivals:"На входе",actions:"Действия",manage:"Управление",copy:"Копировать ссылку",copied:"Ссылка скопирована",export:"Скачать отчёт CSV",empty:"По этому фильтру мероприятий нет.",notAvailable:"—",noData:"Пока нет данных.",allEvents:"Ивентов всего",tasks:"На что обратить внимание",pending:"Подтвердить платежи",waiting:"Обработать лист ожидания",fill:"Низкая заполненность",fillHint:"До начала ещё есть время — проверь продвижение события.",capacity:"Мест осталось",draft:"Черновик",published:"Опубликовано",scheduled:"Запланировано",countNote:"Занятые места включают активные QR, регистрации старого бота и неистёкшие заявки на оплату. Они не являются количеством проданных билетов.",qrNote:"Динамика и источники учитывают только активные QR-билеты; старые Telegram-регистрации не имеют этих метрик.",rangeNote:"Динамика отражает последние 30 дней. Данные не содержат имён, email или телефонов участников.",limit:"Показаны только последние 200 мероприятий; итоги относятся к ним.",scan:"Сканировать QR"},
  en:{title:"Organizer analytics",subtitle:"Live registration, attendance and operations across your TicketTreat events.",back:"Organizer dashboard",loading:"Loading analytics…",error:"Could not load statistics. Check organizer access and MFA.",reload:"Refresh",all:"All",upcoming:"Upcoming",finished:"Finished",cancelled:"Cancelled",search:"Search events",events:"Events",registered:"Reserved places",qr:"Active QR tickets",arrived:"QR check-ins",waitlist:"On waitlist",holds:"Pending payment confirmation",urgent:"Expiring in the next 24h",attendance:"QR check-in rate",occupancy:"Occupancy",trend:"Active QR registrations by day",channels:"Sources of active QR registrations",table:"Event operations",name:"Event",bookings:"Reserved / capacity",payments:"Pending payment",arrivals:"Check-ins",actions:"Actions",manage:"Manage",copy:"Copy link",copied:"Link copied",export:"Download CSV summary",empty:"No events match these filters.",notAvailable:"—",noData:"No data yet.",allEvents:"Total events",tasks:"Items to review",pending:"Confirm payments",waiting:"Review waitlist",fill:"Low occupancy",fillHint:"There is still time to promote this event.",capacity:"Places available",draft:"Draft",published:"Published",scheduled:"Scheduled",countNote:"Reserved places include active QR, legacy bot registrations and unexpired payment holds. They are not ticket sales.",qrNote:"Sources and trend cover only active QR tickets; legacy Telegram bookings are excluded.",rangeNote:"Trend covers the last 30 days. No attendee names, emails or phone numbers are included.",limit:"Only the 200 newest events are included in totals.",scan:"Scan QR"},
  cs:{title:"Analytika pořadatele",subtitle:"Přehled registrací, návštěvnosti a provozu všech vašich akcí TicketTreat.",back:"Panel pořadatele",loading:"Načítání analytiky…",error:"Statistiky nelze načíst. Zkontrolujte oprávnění a MFA.",reload:"Obnovit",all:"Vše",upcoming:"Nadcházející",finished:"Dokončené",cancelled:"Zrušené",search:"Hledat akci",events:"Akce",registered:"Obsazená místa",qr:"Aktivní QR vstupenky",arrived:"QR odbavení",waitlist:"Čekací listina",holds:"Čeká na potvrzení platby",urgent:"Vyprší během 24 hodin",attendance:"Podíl QR odbavení",occupancy:"Obsazenost",trend:"Aktivní QR registrace podle dne",channels:"Zdroje aktivních QR registrací",table:"Přehled akcí",name:"Akce",bookings:"Obsazeno / kapacita",payments:"Čekající platby",arrivals:"Odbavení",actions:"Akce",manage:"Spravovat",copy:"Kopírovat odkaz",copied:"Odkaz zkopírován",export:"Stáhnout souhrn CSV",empty:"Žádné odpovídající akce.",notAvailable:"—",noData:"Zatím žádná data.",allEvents:"Celkem akcí",tasks:"Na co se zaměřit",pending:"Potvrdit platby",waiting:"Vyřídit čekací listinu",fill:"Nízká obsazenost",fillHint:"Ještě můžete podpořit propagaci.",capacity:"Volná místa",draft:"Koncept",published:"Zveřejněno",scheduled:"Naplánováno",countNote:"Obsazená místa zahrnují aktivní QR, staré registrace botu a nevypršené rezervace platby. Nejde o prodané vstupenky.",qrNote:"Trendy a zdroje zahrnují pouze aktivní QR; staré Telegram registrace ne.",rangeNote:"Trend za posledních 30 dní. Bez jmen, emailů a telefonů návštěvníků.",limit:"Souhrn zahrnuje pouze 200 nejnovějších akcí.",scan:"Skenovat QR"},
  uk:{title:"Аналітика організатора",subtitle:"Огляд реєстрацій, відвідуваності та операцій за всіма подіями TicketTreat.",back:"Панель організатора",loading:"Завантаження аналітики…",error:"Не вдалося завантажити статистику. Перевір доступ та MFA.",reload:"Оновити",all:"Усі",upcoming:"Майбутні",finished:"Завершені",cancelled:"Скасовані",search:"Знайти подію",events:"Події",registered:"Зайняті місця",qr:"Активні QR-квитки",arrived:"QR check-in",waitlist:"У черзі",holds:"Очікують підтвердження оплати",urgent:"Спливають протягом 24 годин",attendance:"Частка QR check-in",occupancy:"Заповненість",trend:"Активні QR-реєстрації за днями",channels:"Джерела активних QR-реєстрацій",table:"Стан подій",name:"Подія",bookings:"Зайнято / місткість",payments:"Очікування оплати",arrivals:"Відмітки",actions:"Дії",manage:"Керувати",copy:"Копіювати посилання",copied:"Посилання скопійовано",export:"Завантажити звіт CSV",empty:"Подій не знайдено.",notAvailable:"—",noData:"Даних поки немає.",allEvents:"Усього подій",tasks:"Потребують уваги",pending:"Підтвердити оплати",waiting:"Перевірити чергу",fill:"Низька заповненість",fillHint:"Ще можна просувати подію.",capacity:"Вільні місця",draft:"Чернетка",published:"Опубліковано",scheduled:"Заплановано",countNote:"Зайняті місця включають активні QR, старі реєстрації бота та не прострочені заявки на оплату. Це не продажі.",qrNote:"Джерела та динаміка охоплюють лише активні QR, без старих Telegram-реєстрацій.",rangeNote:"Динаміка за останні 30 днів. Без імен, email або телефонів учасників.",limit:"Підсумки лише для 200 найновіших подій.",scan:"Сканувати QR"}
};
const COUNT=(num:number)=>new Intl.NumberFormat("en-US").format(num);
function escapeCSV(value:unknown):string{
  const raw=String(value??"");
  // Spreadsheet software must not execute formula-like organizer titles.
  const safe=/^[\\s]*[=+@-]/.test(raw)?"'"+raw:raw;
  return '"'+safe.replace(/"/g,'""')+'"';
}
function exportSummary(data:OrganizerAnalytics){
  const headers=["Event ID","Event title","Start","Publication","Cancelled","Reserved places","Capacity","Occupancy percent","Active QR tickets","QR check-ins","Waitlist","Pending payment","Expiring within 24h","Legacy bot registrations"];
  const rows=data.events.map(e=>[e.event_id,e.title,e.starts_at,e.publication,e.is_cancelled,e.reserved_places,e.capacity,e.occupancy_percent,e.active_qr,e.checked_in_qr,e.waitlist,e.pending_payment,e.pending_payment_24h,e.legacy_registrations]);
  const csv="\uFEFF"+[headers,...rows].map(values=>values.map(escapeCSV).join(",")).join("\r\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement("a");anchor.href=url;anchor.download="tickettreat-organizer-analytics.csv";
  document.body.appendChild(anchor);anchor.click();anchor.remove();URL.revokeObjectURL(url);
}
export function OrganizerAnalyticsClient(){
  const {language}=useLanguage(),t=WORDS[language];
  const [data,setData]=useState<OrganizerAnalytics|null>(null);
  const [error,setError]=useState(""),[loading,setLoading]=useState(true);
  const [search,setSearch]=useState(""),[status,setStatus]=useState("all");
  const [shareSource,setShareSource]=useState("direct");
  const [notice,setNotice]=useState("");
  async function reload(){
    setLoading(true);setError("");
    try{setData(await getOrganizerAnalytics());}
    catch{setError(t.error);}finally{setLoading(false);}
  }
  useEffect(()=>{void reload();},[]);
  const filtered=useMemo(()=>data?.events.filter(e=>{
    const matching=e.title.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
    const state=status==="all"|| (status==="upcoming"&&e.upcoming)
      ||(status==="finished"&&e.event_finished&&!e.is_cancelled)
      ||(status==="cancelled"&&e.is_cancelled);
    return matching&&state;
  })||[],[data,search,status]);
  const tasks=useMemo(()=>data?.events.flatMap(e=>{
    const list:{id:string;event:OrganizerAnalyticsEvent;label:string;detail:string}[]=[];
    if(e.pending_payment>0)list.push({id:`payment-${e.event_id}`,event:e,label:t.pending,detail:`${e.pending_payment} · 24h: ${e.pending_payment_24h}`});
    if(e.waitlist>0)list.push({id:`waiting-${e.event_id}`,event:e,label:t.waiting,detail:String(e.waitlist)});
    if(e.upcoming&&e.publication==="published"&&e.capacity!==null&&e.capacity>=5&&e.occupancy_percent!==null&&e.occupancy_percent<30)
      list.push({id:`fill-${e.event_id}`,event:e,label:t.fill,detail:t.fillHint});
    return list;
  }).slice(0,12)||[],[data,t]);
  const peak=Math.max(1,...(data?.daily_bookings.map(x=>x.count)||[1]));
  const allSources=Math.max(1,...(data?.channels.map(x=>x.registrations)||[1]));
  const metrics=data?[
    {name:t.allEvents,value:data.summary.events},
    {name:t.upcoming,value:data.summary.upcoming},
    {name:t.registered,value:data.summary.reserved_places},
    {name:t.arrived,value:data.summary.checked_in_qr},
    {name:t.waitlist,value:data.summary.waitlist},
    {name:t.holds,value:data.summary.pending_payment},
    {name:t.occupancy,value:data.summary.capacity?data.summary.occupancy_percent===null?t.notAvailable:`${data.summary.occupancy_percent}%`:t.notAvailable},
    {name:t.attendance,value:data.summary.qr_checkin_percent===null?t.notAvailable:`${data.summary.qr_checkin_percent}%`},
  ]:[];
  async function copyEvent(event:OrganizerAnalyticsEvent){
    if(event.publication!=="published"||event.is_cancelled)return;
    const url=`${window.location.origin}/events/${event.event_id}${shareSource==="direct"?"":`?utm_source=${encodeURIComponent(shareSource)}`}`;
    try{await navigator.clipboard.writeText(url);setNotice(t.copied);}
    catch{setNotice(url);}
  }
  return <div className="app-shell"><AppHeader/><main className="page tt-analytics-dashboard">
    <Link href="/admin" className="back-link">← {t.back}</Link>
    <div className="tt-analytics-header">
      <div><h1>{t.title}</h1><p className="form-note">{t.subtitle}</p></div>
      <div className="tt-analytics-actions">
        <button type="button" className="button button-outline" disabled={loading} onClick={()=>void reload()}>{t.reload}</button>
        <button type="button" className="button button-primary" disabled={!data||loading} onClick={()=>{if(data)exportSummary(data);}}>{t.export}</button>
      </div>
    </div>
    {error&&<div className="state-card state-error" role="alert">{error}<p><Link href="/security/mfa">MFA →</Link></p></div>}
    {loading&&!data&&<div className="state-card">{t.loading}</div>}
    {notice&&<div className="state-card" role="status">{notice}</div>}
    {data&&<div className="tt-analytics-sections">
      {data.truncated&&<div className="state-card">{t.limit}</div>}
      <section className="tt-analytics-metrics">
        {metrics.map(x=><div className="stat-card" key={x.name}><strong>{typeof x.value==="number"?COUNT(x.value):x.value}</strong><span>{x.name}</span></div>)}
      </section>
      <p className="form-note">{t.countNote}</p>
      <div className="tt-analytics-two-col">
        <section className="panel">
          <h2>{t.trend}</h2><p className="form-note">{t.rangeNote}</p>
          {data.daily_bookings.length?<div className="tt-analytics-bars">
            {data.daily_bookings.map(v=><div className="tt-analytics-bar-row" key={v.date}><span>{v.date}</span><div className="tt-analytics-bar-track"><div style={{width:`${v.count/peak*100}%`}}/></div><strong>{v.count}</strong></div>)}
          </div>:<p>{t.noData}</p>}
        </section>
        <section className="panel">
          <h2>{t.channels}</h2><p className="form-note">{t.qrNote}</p>
          {data.channels.length?<div className="tt-analytics-bars">
            {data.channels.map(v=><div className="tt-analytics-bar-row" key={v.source}><span>{v.source}</span><div className="tt-analytics-bar-track"><div style={{width:`${v.registrations/allSources*100}%`}}/></div><strong>{v.registrations}</strong></div>)}
          </div>:<p>{t.noData}</p>}
        </section>
      </div>
      {tasks.length>0&&<section className="panel">
        <h2>{t.tasks}</h2>
        <div className="tt-analytics-tasks">{tasks.map(task=><Link href={`/admin/events/${task.event.event_id}`} className="tt-analytics-task" key={task.id}>
          <span><strong>{task.label}</strong><small>{task.event.title}</small></span>
          <span>{task.detail} ↗</span>
        </Link>)}</div>
      </section>}
      <section className="panel">
        <h2>{t.table}</h2>
        <div className="tt-analytics-filter">
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={t.search} aria-label={t.search}/>
          <select value={status} onChange={e=>setStatus(e.target.value)} aria-label={t.events}>
            {["all","upcoming","finished","cancelled"].map(x=><option value={x} key={x}>{t[x]}</option>)}
          </select>
          <label className="tt-analytics-share-label">{language==="ru"?"Источник ссылки":language==="cs"?"Zdroj odkazu":language==="uk"?"Джерело посилання":"Share link source"} <select value={shareSource} onChange={e=>setShareSource(e.target.value)}><option value="direct">Direct</option><option value="telegram">Telegram</option><option value="instagram">Instagram</option><option value="partner">Partner</option></select></label>
        </div>
        <div className="tt-analytics-scroll"><table className="tt-analytics-table">
          <thead><tr><th>{t.name}</th><th>{t.bookings}</th><th>{t.arrivals}</th><th>{t.waitlist}</th><th>{t.payments}</th><th>{t.actions}</th></tr></thead>
          <tbody>{filtered.map(e=><tr key={e.event_id}>
            <td><strong>{e.title}</strong><small>#{e.event_id} · {e.publication==="draft"?t.draft:e.publication==="scheduled"?t.scheduled:t.published}</small></td>
            <td>{e.reserved_places} / {e.capacity??"∞"}{e.occupancy_percent!==null&&<small>{e.occupancy_percent}%</small>}</td>
            <td>{e.checked_in_qr} / {e.active_qr}</td>
            <td>{e.waitlist}</td><td>{e.pending_payment}{e.pending_payment_24h>0&&<small>24h: {e.pending_payment_24h}</small>}</td>
            <td><div className="tt-analytics-row-actions">
              <Link className="button button-outline" href={`/admin/events/${e.event_id}`}>{t.manage}</Link>
              {e.publication==="published"&&!e.is_cancelled&&<button className="button button-outline" type="button" onClick={()=>void copyEvent(e)}>{t.copy}</button>}
            </div></td>
          </tr>)}</tbody>
        </table></div>
        {!filtered.length&&<p className="state-card">{t.empty}</p>}
      </section>
      <div className="tt-analytics-actions">
        <Link href="/admin/check-in" className="button button-primary">{t.scan}</Link>
        <Link href="/admin" className="button button-outline">{t.events}</Link>
      </div>
    </div>}
  </main></div>;
}
