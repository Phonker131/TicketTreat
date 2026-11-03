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
type CRMText={title:string;visitors:string;first:string;repeat:string;loyal:string;active:string;inactive:string;repeatRate:string;note:string;sourceTitle:string;sourceName:string;bookings:string;checked:string;rate:string;sourceNote:string;marketing:string;marketingNote:string;event:string;source:string;custom:string;badSource:string;noPublished:string;copyLink:string;copyPost:string;postIntro:string};
const CRM:Record<LanguageCode,CRMText>={
  en:{title:"Audience CRM · completed visits",visitors:"Unique visitors",first:"One recorded visit",repeat:"Returning visitors (2+)",loyal:"Loyal visitors (3+)",active:"Active in last 30 days",inactive:"No visit in 90+ days",repeatRate:"Repeat-visitor share",note:"Counts use confirmed QR check-ins for events you manage (up to 200 newest events). A returning visitor has checked in at least twice. Inactive means the last check-in was more than 90 days ago. These are aggregate segments, not contact lists.",sourceTitle:"Campaign source performance",sourceName:"Source",bookings:"Active registrations",checked:"QR check-ins",rate:"Check-in rate",sourceNote:"UTM source is an attribution label provided at signup, not a verified click/conversion metric. Future events can have a low check-in rate.",marketing:"Marketing links and ready-to-share posts",marketingNote:"Choose a published event and a source tag. Each unique tag can distinguish a campaign in registration reports; only bookings and QR entries are tracked, not page views. Share publicly; this tool does not send unsolicited email.",event:"Published event",source:"Traffic source",custom:"Custom campaign code (a-z, 0-9, _ or -, max 40)",badSource:"Use 1–40 lowercase letters, digits, underscores or dashes for the source tag.",noPublished:"Publish an event before creating a shareable link.",copyLink:"Copy campaign link",copyPost:"Copy ready-to-share post",postIntro:"Join us at"},
  cs:{title:"CRM publika · skutečné návštěvy",visitors:"Unikátní návštěvníci",first:"Jedna zaznamenaná návštěva",repeat:"Opakovaní návštěvníci (2+)",loyal:"Věrní návštěvníci (3+)",active:"Aktivní za 30 dní",inactive:"Bez návštěvy více než 90 dní",repeatRate:"Podíl opakovaných návštěvníků",note:"Počítají se pouze skutečná QR odbavení u vašich akcí (nejvýše 200 nejnovějších). Opakovaný návštěvník přišel alespoň dvakrát. Neaktivní neměl odbavení více než 90 dní. Jde o souhrny, nikoli seznam kontaktů.",sourceTitle:"Výsledky zdrojů kampaní",sourceName:"Zdroj",bookings:"Aktivní registrace",checked:"QR odbavení",rate:"Podíl odbavených",sourceNote:"Zdroj UTM je údaj o původu registrace, nikoli ověřené kliknutí nebo konverze. Budoucí akce mohou mít nízký podíl odbavení.",marketing:"Marketingové odkazy a texty ke sdílení",marketingNote:"Vyberte zveřejněnou akci a zdroj. Jedinečný kód umožňuje měřit registrace z kampaně, nikoli zobrazení. Nástroj neposílá nevyžádané zprávy.",event:"Zveřejněná akce",source:"Zdroj návštěvnosti",custom:"Vlastní kód kampaně (a-z, 0-9, _ nebo -, max 40)",badSource:"Použijte 1–40 malých písmen, číslic, podtržítek nebo pomlček.",noPublished:"Nejprve zveřejněte akci.",copyLink:"Kopírovat odkaz",copyPost:"Kopírovat text k publikování",postIntro:"Přijďte na"},
  ru:{title:"CRM-аудитория · реальные посещения",visitors:"Уникальные гости",first:"Одно зарегистрированное посещение",repeat:"Вернувшиеся гости (2+)",loyal:"Постоянные гости (3+)",active:"Активны за 30 дней",inactive:"Без визитов более 90 дней",repeatRate:"Доля вернувшихся",note:"Учитываются только подтверждённые QR-посещения ваших мероприятий (до 200 последних событий). Вернувшийся гость посетил как минимум два события. Неактивный — без посещений более 90 дней. Это агрегированные сегменты, не списки контактов.",sourceTitle:"Эффективность источников продвижения",sourceName:"Источник",bookings:"Активные регистрации",checked:"QR-посещения",rate:"Доля посещений",sourceNote:"UTM-источник — метка, переданная при регистрации, а не подтверждённые переходы или конверсия из просмотров. Для будущих событий доля посещений может быть низкой.",marketing:"Маркетинговые ссылки и тексты публикаций",marketingNote:"Выберите опубликованное мероприятие и источник. Уникальная метка позволяет сравнивать регистрации из кампаний, но не просмотры страниц. Инструмент не отправляет рекламные письма без согласия.",event:"Опубликованное мероприятие",source:"Источник перехода",custom:"Свой код кампании (a-z, 0-9, _ или -, до 40)",badSource:"Код источника: 1–40 строчных латинских букв, цифр, _ или -.",noPublished:"Сначала опубликуйте мероприятие.",copyLink:"Скопировать ссылку",copyPost:"Скопировать текст публикации",postIntro:"Приглашаем на"},
  uk:{title:"CRM-аудиторія · реальні відвідування",visitors:"Унікальні гості",first:"Одне підтверджене відвідування",repeat:"Повторні гості (2+)",loyal:"Постійні гості (3+)",active:"Активні за 30 днів",inactive:"Без візитів понад 90 днів",repeatRate:"Частка повторних гостей",note:"Ураховуються лише підтверджені QR-відвідування ваших подій (до 200 найновіших). Повторний гість був щонайменше двічі. Неактивний не відвідував понад 90 днів. Це зведені сегменти, а не списки контактів.",sourceTitle:"Ефективність джерел просування",sourceName:"Джерело",bookings:"Активні реєстрації",checked:"QR-відвідування",rate:"Частка відвідувань",sourceNote:"UTM-джерело — мітка реєстрації, а не підтверджений перехід або конверсія з переглядів. Для майбутніх подій показник може бути низьким.",marketing:"Маркетингові посилання і тексти публікацій",marketingNote:"Оберіть опубліковану подію та джерело. Унікальна мітка дає змогу порівнювати реєстрації кампаній, але не перегляди. Інструмент не розсилає рекламних повідомлень без згоди.",event:"Опублікована подія",source:"Джерело переходу",custom:"Свій код кампанії (a-z, 0-9, _ або -, до 40)",badSource:"Код джерела: 1–40 малих латинських літер, цифр, _ або -.",noPublished:"Спочатку опублікуйте подію.",copyLink:"Скопіювати посилання",copyPost:"Скопіювати текст публікації",postIntro:"Запрошуємо на"}
};
function trackedLink(eventId:number,source:string):string{
  return `https://tickettreat.eu/events/${eventId}${source==="direct"?"":`?utm_source=${encodeURIComponent(source)}`}`;
}
const COUNT=(num:number)=>new Intl.NumberFormat("en-US").format(num);
function escapeCSV(value:unknown):string{
  const raw=String(value??"");
  // Spreadsheet software must not execute formula-like organizer titles.
  const safe=/^\s*[=+@-]/.test(raw)?"'"+raw:raw;
  return '"'+safe.replace(/"/g,'""')+'"';
}
function exportSummary(data:OrganizerAnalytics){
  const headers=["Event ID","Event title","Start","Publication","Cancelled","Reserved places","Capacity","Occupancy percent","Active QR tickets","QR check-ins","Waitlist","Pending payment","Expiring within 24h","Legacy bot registrations","Source performance (registrations / QR entries)"];
  const rows=data.events.map(e=>[e.event_id,e.title,e.starts_at,e.publication,e.is_cancelled,e.reserved_places,e.capacity,e.occupancy_percent,e.active_qr,e.checked_in_qr,e.waitlist,e.pending_payment,e.pending_payment_24h,e.legacy_registrations,(e.channels??[]).map(x=>`${x.source}: ${x.registrations}/${x.checked_in??"—"}`).join("; ")]);
  const csv="\uFEFF"+[headers,...rows].map(values=>values.map(escapeCSV).join(",")).join("\r\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement("a");anchor.href=url;anchor.download="tickettreat-organizer-analytics.csv";
  document.body.appendChild(anchor);anchor.click();anchor.remove();URL.revokeObjectURL(url);
}
export function OrganizerAnalyticsClient(){
  const {language}=useLanguage(),t=WORDS[language],cm=CRM[language];
  const [data,setData]=useState<OrganizerAnalytics|null>(null);
  const [error,setError]=useState(""),[loading,setLoading]=useState(true);
  const [search,setSearch]=useState(""),[status,setStatus]=useState("all");
  const [shareSource,setShareSource]=useState("direct");
  const [customSource,setCustomSource]=useState("");
  const [marketingEvent,setMarketingEvent]=useState("");
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
  const publishedEvents=useMemo(()=>data?.events.filter(e=>e.publication==="published"&&!e.is_cancelled)||[],[data]);
  const campaignEvent=publishedEvents.find(e=>String(e.event_id)===marketingEvent)||publishedEvents[0];
  const tag=shareSource==="custom"?customSource.trim().toLowerCase():shareSource;
  const validTag=/^[a-z0-9_-]{1,40}$/.test(tag);
  const campaignLink=campaignEvent&&validTag?trackedLink(campaignEvent.event_id,tag):"";
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
  async function copyText(value:string){
    try{await navigator.clipboard.writeText(value);setNotice(t.copied);}
    catch{setNotice(value);}
  }
  async function copyEvent(event:OrganizerAnalyticsEvent){
    if(event.publication!=="published"||event.is_cancelled)return;
    if(!validTag){setNotice(cm.badSource);return;}
    await copyText(trackedLink(event.event_id,tag));
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
      {data.audience&&<section className="panel">
        <h2>{cm.title}</h2>
        <div className="tt-analytics-metrics">
          {([
            [cm.visitors,data.audience.visitors],
            [cm.first,data.audience.first_time],
            [cm.repeat,data.audience.returning],
            [cm.loyal,data.audience.loyal],
            [cm.active,data.audience.active_30d],
            [cm.inactive,data.audience.inactive_90d],
            [cm.repeatRate,data.audience.repeat_percent===null?t.notAvailable:`${data.audience.repeat_percent}%`]
          ] as [string,number|string][]).map(([name,value])=><div className="stat-card" key={name}><strong>{typeof value==="number"?COUNT(value):value}</strong><span>{name}</span></div>)}
        </div>
        <p className="form-note">{cm.note}</p>
      </section>}
      <section className="panel">
        <h2>{cm.marketing}</h2><p className="form-note">{cm.marketingNote}</p>
        {campaignEvent?<div className="tt-analytics-filter">
          <label>{cm.event}<select value={String(campaignEvent.event_id)} onChange={e=>setMarketingEvent(e.target.value)}>
            {publishedEvents.map(e=><option value={e.event_id} key={e.event_id}>{e.title}</option>)}
          </select></label>
          <label>{cm.source}<select value={shareSource} onChange={e=>setShareSource(e.target.value)}>
            {["direct","telegram","instagram","partner","newsletter","custom"].map(x=><option key={x} value={x}>{x==="custom"?cm.custom:x}</option>)}
          </select></label>
          {shareSource==="custom"&&<label>{cm.custom}<input value={customSource} maxLength={40} onChange={e=>setCustomSource(e.target.value)} placeholder="autumn_event_2026"/></label>}
        </div>:<p>{cm.noPublished}</p>}
        {campaignEvent&&<div>
          {!validTag&&<p className="form-note" role="alert">{cm.badSource}</p>}
          {campaignLink&&<p className="form-note" style={{overflowWrap:"anywhere"}}>{campaignLink}</p>}
          <div className="tt-analytics-actions">
            <button className="button button-outline" type="button" disabled={!campaignLink} onClick={()=>void copyText(campaignLink)}>{cm.copyLink}</button>
            <button className="button button-primary" type="button" disabled={!campaignLink} onClick={()=>void copyText(`${cm.postIntro} ${campaignEvent.title}!\n${campaignLink}`)}>{cm.copyPost}</button>
          </div>
          {(campaignEvent.channels??[]).length>0&&<div className="tt-analytics-scroll">
            <h3>{cm.sourceTitle} · {campaignEvent.title}</h3>
            <table className="tt-analytics-table">
              <thead><tr><th>{cm.sourceName}</th><th>{cm.bookings}</th><th>{cm.checked}</th><th>{cm.rate}</th></tr></thead>
              <tbody>{(campaignEvent.channels??[]).map(x=><tr key={x.source}><td>{x.source}</td><td>{x.registrations}</td><td>{typeof x.checked_in==="number"?x.checked_in:t.notAvailable}</td><td>{x.registrations&&typeof x.checked_in==="number"?`${(x.checked_in*100/x.registrations).toFixed(1)}%`:t.notAvailable}</td></tr>)}</tbody>
            </table>
          </div>}
        </div>}
      </section>
      <section className="panel">
        <h2>{cm.sourceTitle}</h2><p className="form-note">{cm.sourceNote}</p>
        {data.channels.length?<div className="tt-analytics-scroll"><table className="tt-analytics-table">
          <thead><tr><th>{cm.sourceName}</th><th>{cm.bookings}</th><th>{cm.checked}</th><th>{cm.rate}</th></tr></thead>
          <tbody>{data.channels.map(x=><tr key={x.source}><td>{x.source}</td><td>{x.registrations}</td><td>{typeof x.checked_in==="number"?x.checked_in:t.notAvailable}</td><td>{x.registrations&&typeof x.checked_in==="number"?`${(x.checked_in*100/x.registrations).toFixed(1)}%`:t.notAvailable}</td></tr>)}</tbody>
        </table></div>:<p>{t.noData}</p>}
      </section>
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
