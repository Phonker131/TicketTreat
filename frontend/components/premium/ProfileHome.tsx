"use client";
import Link from "next/link";
import {useEffect,useState,type FormEvent} from "react";
import {createSupportTicket,getDemoTickets,getMyAttendance,type AttendanceHistory} from "@/lib/api";
import type {DemoTicket,LanguageCode,WebProfile} from "@/lib/types";
import {dateParts} from "@/components/premium/EventLists";
import {LEVELS,configuredLevels,levelIndex,levelName,progressLine,rewardsCopy} from "@/components/premium/RewardsTrack";
import type {LoyaltyStudio,OrganizerTierBenefit} from "@/lib/api";
import {useMyLoyalty} from "@/components/premium/useMyLoyalty";

const C:Record<LanguageCode,{
 since:string;visits:string;ahead:string;orgs:string;level:string;next:string;noTicket:string;find:string;qr:string;
 levels:string;noLevels:string;allRewards:string;been:string;noBeen:string;more:string;less:string;
 wish:string;wishLead:string;wishText:string;wishLink:string;send:string;sending:string;sent:string;openSupport:string;
 wishShort:string;wishSubject:string;linkLabel:string;nextPerk:string;topLevel:string;
}>={
 ru:{since:"С нами с {d}",visits:"Визитов",ahead:"Билетов впереди",orgs:"Организаторов",level:"Уровень",next:"Ближайший билет",noTicket:"Пока нет билетов на будущие ивенты.",find:"Смотреть ивенты",qr:"Показать QR",
  levels:"Ваши уровни",noLevels:"Сходите на первый ивент, и здесь появится ваш уровень у этого организатора.",allRewards:"Все награды",been:"Где вы были",noBeen:"Здесь появятся ивенты, на которых вы отметились на входе.",more:"Показать все",less:"Свернуть",
  wish:"Хочу такой ивент",wishLead:"Напишите, куда хотите сходить, или пришлите ссылку на похожий ивент. Команда TicketTreat прочитает и ответит вам в поддержке.",wishText:"Например: квиз по кино на английском в пятницу вечером",wishLink:"Ссылка на похожий ивент (необязательно)",send:"Отправить идею",sending:"Отправляем…",sent:"Спасибо, идея у нас. Ответ придёт в поддержку.",openSupport:"Открыть поддержку",
  wishShort:"Опишите идею чуть подробнее (от 15 символов) или добавьте ссылку.",wishSubject:"Хочу такой ивент",linkLabel:"Ссылка",nextPerk:"Дальше: {perk}",topLevel:"Все плюшки открыты"},
 en:{since:"With us since {d}",visits:"Visits",ahead:"Tickets ahead",orgs:"Organizers",level:"Level",next:"Next ticket",noTicket:"No tickets for upcoming events yet.",find:"Explore events",qr:"Show QR",
  levels:"Your levels",noLevels:"Go to your first event and your level with that organizer appears here.",allRewards:"All rewards",been:"Where you've been",noBeen:"Events where you checked in at the door will appear here.",more:"Show all",less:"Show less",
  wish:"I want an event like this",wishLead:"Tell us where you would like to go, or send a link to a similar event. The TicketTreat team reads every idea and replies in support.",wishText:"For example: a movie quiz in English on a Friday evening",wishLink:"Link to a similar event (optional)",send:"Send the idea",sending:"Sending…",sent:"Thank you, we have your idea. The reply will come to support.",openSupport:"Open support",
  wishShort:"Describe the idea a bit more (15 characters or more) or add a link.",wishSubject:"I want an event like this",linkLabel:"Link",nextPerk:"Next: {perk}",topLevel:"Every perk unlocked"},
 cs:{since:"S námi od {d}",visits:"Návštěvy",ahead:"Vstupenky předem",orgs:"Pořadatelé",level:"Úroveň",next:"Nejbližší vstupenka",noTicket:"Zatím nemáte vstupenky na nadcházející akce.",find:"Zobrazit akce",qr:"Ukázat QR",
  levels:"Vaše úrovně",noLevels:"Přijďte na první akci a tady se objeví vaše úroveň u daného pořadatele.",allRewards:"Všechny odměny",been:"Kde jste byli",noBeen:"Tady se objeví akce, na kterých vás odbavili u vstupu.",more:"Zobrazit vše",less:"Skrýt",
  wish:"Chci takovou akci",wishLead:"Napište, kam byste chtěli jít, nebo pošlete odkaz na podobnou akci. Tým TicketTreat každý nápad přečte a odpoví vám v podpoře.",wishText:"Například: filmový kvíz v angličtině v pátek večer",wishLink:"Odkaz na podobnou akci (nepovinné)",send:"Poslat nápad",sending:"Odesíláme…",sent:"Děkujeme, nápad máme. Odpověď přijde do podpory.",openSupport:"Otevřít podporu",
  wishShort:"Popište nápad trochu víc (aspoň 15 znaků) nebo přidejte odkaz.",wishSubject:"Chci takovou akci",linkLabel:"Odkaz",nextPerk:"Dále: {perk}",topLevel:"Všechny výhody odemčené"},
 uk:{since:"З нами з {d}",visits:"Візитів",ahead:"Квитків попереду",orgs:"Організаторів",level:"Рівень",next:"Найближчий квиток",noTicket:"Поки немає квитків на майбутні події.",find:"Переглянути події",qr:"Показати QR",
  levels:"Ваші рівні",noLevels:"Сходіть на першу подію, і тут з'явиться ваш рівень у цього організатора.",allRewards:"Усі нагороди",been:"Де ви були",noBeen:"Тут з'являться події, на яких вас відмітили на вході.",more:"Показати всі",less:"Згорнути",
  wish:"Хочу таку подію",wishLead:"Напишіть, куди хочете піти, або надішліть посилання на схожу подію. Команда TicketTreat прочитає і відповість вам у підтримці.",wishText:"Наприклад: квіз про кіно англійською в п'ятницю ввечері",wishLink:"Посилання на схожу подію (необов'язково)",send:"Надіслати ідею",sending:"Надсилаємо…",sent:"Дякуємо, ідея в нас. Відповідь прийде в підтримку.",openSupport:"Відкрити підтримку",
  wishShort:"Опишіть ідею трохи докладніше (від 15 символів) або додайте посилання.",wishSubject:"Хочу таку подію",linkLabel:"Посилання",nextPerk:"Далі: {perk}",topLevel:"Усі бонуси відкриті"},
};
const LOCALE:Record<LanguageCode,string>={ru:"ru-RU",en:"en-GB",cs:"cs-CZ",uk:"uk-UA"};

/* The pass card and the overview share one request each; signing in or out drops them. */
let ticketsReq:Promise<DemoTicket[]>|null=null,historyReq:Promise<AttendanceHistory|null>|null=null;
if(typeof window!=="undefined")window.addEventListener("tickettreat-auth-change",()=>{ticketsReq=null;historyReq=null;});

function useProfileData(profile:WebProfile){
 const [tickets,setTickets]=useState<DemoTicket[]|null>(null);
 const [history,setHistory]=useState<AttendanceHistory|null>(null);
 useEffect(()=>{
  let live=true;
  ticketsReq??=getDemoTickets(profile.guest.access_token).catch(()=>[]);
  historyReq??=getMyAttendance().catch(()=>null);
  ticketsReq.then(t=>{if(live)setTickets(t)});
  historyReq.then(h=>{if(live)setHistory(h)});
  return()=>{live=false};
 },[profile.guest.access_token]);
 const upcoming=(tickets||[])
  .filter(t=>t.ticket_status==="active"&&!t.checked_in_at&&t.event&&!t.event.is_cancelled&&t.event.starts_at&&new Date(t.event.starts_at).getTime()>Date.now()-3*3600e3)
  .sort((a,b)=>String(a.event!.starts_at).localeCompare(String(b.event!.starts_at)));
 return {tickets,upcoming,history};
}

/** The card at the top of the profile: who you are, your best level and three numbers. */
/** How far the visits go towards the next step, 0..100. */
/** How far the visits go towards the next step of this organizer, 0..100. */
function toNext(visits:number,rewards?:OrganizerTierBenefit[]){
 const i=levelIndex(visits,rewards),next=configuredLevels(rewards)[i+1];
 return next?Math.min(100,Math.round(100*visits/Math.max(1,next.at))):100;
}
/** The organizer where the guest stands highest (each organizer has its own steps). */
function bestStudio(studios:LoyaltyStudio[]):LoyaltyStudio|null{
 return [...studios].sort((a,b)=>levelIndex(b.season_visits,b.tier_rewards)-levelIndex(a.season_visits,a.tier_rewards)||b.season_visits-a.season_visits)[0]||null;
}
function perkAt(language:LanguageCode,i:number,rewards?:OrganizerTierBenefit[]){
 const b=rewards?.find(r=>r.tier===LEVELS[i]?.key);
 return b?(language==="cs"?b.label_cs:b.label_en):rewardsCopy[language].perks[i];
}

/** The card at the top of the profile, drawn as a ticket: who you are and three numbers on the left,
 *  a dark stub on the right with your best level and how close the next one is. */
export function ProfilePass({profile,roleLabel,language}:{profile:WebProfile;roleLabel:string;language:LanguageCode}){
 const c=C[language],{passport}=useMyLoyalty(),{upcoming}=useProfileData(profile);
 const best=bestStudio(passport?.studios||[]);
 const since=profile.account.created_at?new Intl.DateTimeFormat(LOCALE[language],{month:"long",year:"numeric"}).format(new Date(profile.account.created_at)):"";
 const name=[profile.account.first_name,profile.account.last_name].filter(Boolean).join(" ");
 return <section className="tt-ph-pass" aria-label={name}>
  <div className="tt-ph-main">
   <div className="tt-ph-id">
    <b className="tt-ph-avatar" aria-hidden="true">{profile.account.first_name.charAt(0).toUpperCase()}</b>
    <div>
     <h1>{name}</h1>
     <p>{profile.account.email||"Telegram, @TicketTreatBot"}</p>
    </div>
   </div>
   <div className="tt-ph-meta"><span className="tt-ph-role">{roleLabel}</span>{since&&<span>{c.since.replace("{d}",since)}</span>}</div>
   <dl className="tt-ph-stats">
    <div><dt>{c.visits}</dt><dd>{profile.guest.visits}</dd></div>
    <div><dt>{c.ahead}</dt><dd>{upcoming.length}</dd></div>
    <div><dt>{c.orgs}</dt><dd>{passport?.studios.length??0}</dd></div>
   </dl>
  </div>
  <div className={"tt-ph-stub is-"+LEVELS[levelIndex(best?.season_visits??0,best?.tier_rewards)].key}>
   <small>{c.level}</small>
   <strong>{levelName(language,best?.season_visits??0,best?.tier_rewards)}</strong>
   <span className="tt-ph-bar" aria-hidden="true"><i style={{width:toNext(best?.season_visits??0,best?.tier_rewards)+"%"}}/></span>
   <p>{best?(passport&&passport.studios.length>1?best.organizer_name+": ":"")+progressLine(language,best.season_visits,best.tier_rewards):progressLine(language,0)}</p>
  </div>
 </section>;
}

function Poster({src,title}:{src:string|null;title:string}){
 const [failed,setFailed]=useState(false);
 return <span className="tt-ph-poster">{src&&!failed?<img src={src} alt="" loading="lazy" onError={()=>setFailed(true)}/>:<i>{title.slice(0,2).toUpperCase()}</i>}</span>;
}

/** Overview tab: next ticket, levels per organizer, where you've been, and the "I want an event like this" form. */
export function ProfileHome({profile,language}:{profile:WebProfile;language:LanguageCode}){
 const c=C[language],{passport}=useMyLoyalty(),{tickets,upcoming,history}=useProfileData(profile);
 const [all,setAll]=useState(false);
 const next=upcoming[0],d=next?.event?dateParts(next.event.starts_at,language):null;
 const been=history?.history||[];
 const studios=[...(passport?.studios||[])].sort((a,b)=>levelIndex(b.season_visits,b.tier_rewards)-levelIndex(a.season_visits,a.tier_rewards)||b.season_visits-a.season_visits).slice(0,3);
 return <div className="tt-ph">
  <div className="tt-ph-col">
  <section className="tt-ph-card tt-ph-next">
   <h2>{c.next}</h2>
   {tickets===null?<p className="tt-ph-muted">…</p>:next&&next.event?<div className="tt-ph-ticket">
    <Poster src={next.event.image_url} title={next.event.title}/>
    <div className="tt-ph-ticket-body">
     {d&&<p className="tt-ph-date"><b>{d.day}</b><span>{d.month}<br/>{d.weekday}, {d.time}</span></p>}
     <strong>{next.event.title}</strong>
     {next.event.location&&<span>{next.event.location}</span>}
    </div>
    <Link href={`/tickets/${next.id}?show=qr`} className="button button-primary">{c.qr}</Link>
   </div>:<div className="tt-ph-empty"><p>{c.noTicket}</p><Link href="/" className="button button-outline">{c.find}</Link></div>}
  </section>

  <section className="tt-ph-card tt-ph-been">
   <h2>{c.been}{been.length>0&&<small>{been.length}</small>}</h2>
   {been.length===0?<p className="tt-ph-muted">{c.noBeen}</p>:<>
    <ul>{(all?been:been.slice(0,6)).map(h=>{
     const p=dateParts(h.checked_in_at,language);
     return <li key={h.event_id+":"+h.checked_in_at}>
      <Poster src={`/api/gateway/demo/events/${h.event_id}/poster`} title={h.title}/>
      <strong>{h.title}</strong>
      <span>{p?`${p.day} ${p.month}`:""}{h.location?`, ${h.location}`:""}</span>
     </li>;})}</ul>
    {been.length>6&&<button type="button" className="button button-outline" onClick={()=>setAll(v=>!v)}>{all?c.less:c.more}</button>}
   </>}
  </section>

  </div>
  <div className="tt-ph-col">
  <section className="tt-ph-card tt-ph-levels">
   <div className="tt-ph-card-head"><h2>{c.levels}</h2><Link href="/loyalty">{c.allRewards}</Link></div>
   {studios.length===0?<p className="tt-ph-muted">{c.noLevels}</p>:<ul>{studios.map(s=>{
    const r=s.tier_rewards,i=levelIndex(s.season_visits,r),next=configuredLevels(r)[i+1];
    return <li key={s.organizer_id} className={"is-"+LEVELS[i].key}>
     <div className="tt-ph-lv-top"><strong>{s.organizer_name}</strong><em>{levelName(language,s.season_visits,r)}</em></div>
     <span className="tt-ph-lv-bar" aria-hidden="true"><i style={{width:toNext(s.season_visits,r)+"%"}}/></span>
     <div className="tt-ph-lv-foot">
      <b>{s.season_visits}{next?" / "+next.at:""}</b>
      <span>{next?c.nextPerk.replace("{perk}",perkAt(language,i+1,r)):c.topLevel}</span>
     </div>
    </li>;})}</ul>}
  </section>

  <WishForm language={language}/>
  </div>
 </div>;
}

function WishForm({language}:{language:LanguageCode}){
 const c=C[language];
 const [text,setText]=useState(""),[link,setLink]=useState("");
 const [state,setState]=useState<"idle"|"sending"|"sent">("idle"),[error,setError]=useState("");
 async function send(e:FormEvent){
  e.preventDefault();setError("");
  const body=[text.trim(),link.trim()?c.linkLabel+": "+link.trim():""].filter(Boolean).join("\n\n");
  if(body.length<15){setError(c.wishShort);return;}
  setState("sending");
  try{await createSupportTicket("event",c.wishSubject,body.slice(0,4000));setState("sent");setText("");setLink("");}
  catch{setState("idle");setError(language==="ru"?"Не получилось отправить. Попробуйте ещё раз.":language==="cs"?"Odeslání se nepovedlo. Zkuste to znovu.":language==="uk"?"Не вдалося надіслати. Спробуйте ще раз.":"Could not send. Please try again.");}
 }
 return <form className="tt-ph-card tt-ph-wish" onSubmit={send}>
  <h2>{c.wish}</h2>
  <p className="tt-ph-muted">{c.wishLead}</p>
  {state==="sent"?<div className="tt-ph-sent" role="status"><p>{c.sent}</p><Link href="/support" className="button button-outline">{c.openSupport}</Link></div>:<>
   <label className="sr-only" htmlFor="tt-wish-text">{c.wish}</label>
   <textarea id="tt-wish-text" rows={3} maxLength={1500} placeholder={c.wishText} value={text} onChange={e=>setText(e.target.value)}/>
   <label className="sr-only" htmlFor="tt-wish-link">{c.wishLink}</label>
   <input id="tt-wish-link" type="text" inputMode="url" autoComplete="url" placeholder={c.wishLink} value={link} onChange={e=>setLink(e.target.value)}/>
   {error&&<p className="tt-ph-error" role="alert">{error}</p>}
   <button type="submit" className="button button-primary" disabled={state==="sending"}>{state==="sending"?c.sending:c.send}</button>
  </>}
 </form>;
}
