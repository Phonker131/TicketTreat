"use client";
import {useEffect,useRef,useState} from "react";
import Link from "next/link";
import {EventCard} from "@/components/EventCard";
import {BrandIcon} from "@/components/BrandIcon";
import {eventDisplayDate} from "@/lib/format";
import type {LanguageCode,TicketTreatEvent} from "@/lib/types";

type Mode="swipe"|"map"|"list";
type Mood="all"|"meet"|"friends"|"listen"|"dance";
const copy={
 ru:{label:"Найди свой ивент",mood:"Настроение",mode:"Режим поиска",all:"Любое",meet:"Познакомиться",friends:"С друзьями",listen:"Послушать",dance:"Потанцевать",swipe:"Свайп",map:"Карта",list:"Лента",want:"Хочу",pass:"Мимо",view:"Смотреть",saved:"В избранном этого браузера",done:"Афиши закончились",reset:"Посмотреть снова",hint:"Свайп влево / вправо / вверх или стрелки клавиатуры. «Хочу» сохраняет интерес, но не бронирует билет.",schematic:"Схема Праги. Не навигационная карта.",noMatch:"Нет событий с выбранным настроением.",details:"Открыть ивент",mapNote:"Точное расположение смотри в описании ивента."},
 cs:{label:"Najdi svou akci",mood:"Nálada",mode:"Režim hledání",all:"Cokoliv",meet:"Seznámit se",friends:"S přáteli",listen:"Poslechnout",dance:"Zatančit",swipe:"Karty",map:"Mapa",list:"Seznam",want:"Chci",pass:"Přeskočit",view:"Zobrazit",saved:"Uloženo v tomto prohlížeči",done:"Žádné další plakáty",reset:"Začít znovu",hint:"Přejeď doleva / doprava / nahoru, nebo použij šipky na klávesnici. «Chci» neprovádí rezervaci.",schematic:"Schéma Prahy, ne navigační mapa.",noMatch:"Pro tuto náladu nemáme akce.",details:"Otevřít akci",mapNote:"Přesné místo najdeš v detailu akce."},
 uk:{label:"Знайди свою подію",mood:"Настрій",mode:"Режим пошуку",all:"Будь-який",meet:"Познайомитися",friends:"З друзями",listen:"Послухати",dance:"Потанцювати",swipe:"Свайп",map:"Мапа",list:"Стрічка",want:"Хочу",pass:"Пропустити",view:"Переглянути",saved:"Збережено в цьому браузері",done:"Афіші закінчилися",reset:"Переглянути знову",hint:"Свайп ліворуч / праворуч / угору або клавіші зі стрілками. «Хочу» не бронює квиток.",schematic:"Схема Праги, не навігаційна мапа.",noMatch:"Немає подій з таким настроєм.",details:"Відкрити подію",mapNote:"Точне місце вказано в описі події."},
 en:{label:"Find your event",mood:"Mood",mode:"Browse mode",all:"Anything",meet:"Meet people",friends:"With friends",listen:"Listen",dance:"Dance",swipe:"Swipe",map:"Map",list:"Feed",want:"Want",pass:"Pass",view:"View",saved:"Saved in this browser",done:"No more posters",reset:"See again",hint:"Swipe left / right / up or use arrow keys. Want saves an event, it does not book a ticket.",schematic:"Prague schematic, not a navigation map.",noMatch:"No events match this mood.",details:"View event",mapNote:"Find the precise venue on the event details page."}
} as const;
const terms:Record<Exclude<Mood,"all">,RegExp>={
 meet:/dating|знаком|знайом|seznam|singles|rande|speed.date/i,
 friends:/quiz|квиз|квіз|kvíz|trivia|board.game|друз|přátel|friends|hospoda|pub/i,
 listen:/music|музык|музик|koncert|concert|open.mic|stand.up|комед|комеді|послуш|poslech/i,
 dance:/dance|танц|танцю|taneč|party|dj|klub|club|disco/i
};
function saveInterest(id:number){
 try{const key="tickettreat_wanted_events";const saved=JSON.parse(localStorage.getItem(key)||"[]");const ids=Array.isArray(saved)?saved.filter(x=>typeof x==="number"):[];localStorage.setItem(key,JSON.stringify([...new Set([...ids,id])]));}catch{/* Browsing works without storage. */}
}
function dateLabel(value:string|null,lang:LanguageCode){
 if(!value)return "—";
 const {date,timeZone}=eventDisplayDate(value);
 return Number.isNaN(date.getTime())?"—":new Intl.DateTimeFormat(lang==="cs"?"cs-CZ":lang==="uk"?"uk-UA":lang==="en"?"en-GB":"ru-RU",{day:"2-digit",month:"short",timeZone}).format(date);
}
export function EventDiscovery({events,language}:{events:TicketTreatEvent[];language:LanguageCode}){
 const tr=copy[language];
 const [mode,setMode]=useState<Mode>("list");
 const [mood,setMood]=useState<Mood>("all");
 const [index,setIndex]=useState(0);
 const [feedback,setFeedback]=useState("");
 const [drag,setDrag]=useState({x:0,y:0});
 const start=useRef<{x:number;y:number}|null>(null);
 const filtered=events.filter(e=>mood==="all"||terms[mood].test([e.title,e.description||""].join(" ")));
 const current=filtered[index];
 const advance=(action:"want"|"pass"|"view")=>{
   if(!current)return;
   if(action==="view"){window.location.assign("/events/"+current.id+"?lang="+language);return;}
   if(action==="want"){saveInterest(current.id);setFeedback(tr.saved);}else setFeedback("");
   setIndex(i=>i+1);setDrag({x:0,y:0});
 };
 useEffect(()=>{setIndex(0);setFeedback("");},[mood,mode]);
 const moodButtons: Mood[]=["all","meet","friends","listen","dance"];
 const modeButtons:Mode[]=["swipe","map","list"];
 return <div className="tt-discovery">
   <div className="tt-discovery-controls">
     <div><span className="tt-discovery-label">{tr.mood}</span><div className="tt-discovery-pills" role="group" aria-label={tr.mood}>
       {moodButtons.map(m=><button type="button" key={m} className={"tt-discovery-chip"+(mood===m?" is-selected":"")} aria-pressed={mood===m} onClick={()=>setMood(m)}>{tr[m]}</button>)}
     </div></div>
     <div><span className="tt-discovery-label">{tr.mode}</span><div className="tt-discovery-pills" role="group" aria-label={tr.mode}>
       {modeButtons.map(m=><button type="button" key={m} className={"tt-discovery-chip"+(mode===m?" is-selected":"")} aria-pressed={mode===m} onClick={()=>setMode(m)}>{tr[m]}</button>)}
     </div></div>
   </div>
   {filtered.length===0?<div className="state-card" role="status">{tr.noMatch}</div>:
   mode==="list"?<div className="event-grid">{filtered.map(event=><EventCard key={event.id} event={event}/>)}</div>:
   mode==="map"?<div className="tt-discovery-map-grid">
     <div className="tt-prague-sketch" role="img" aria-label={tr.schematic}>
       <svg viewBox="0 0 560 420" aria-hidden="true"><rect width="560" height="420" fill="#1E1D2B"/>
         <path d="M0 122 Q135 60 228 168 T560 234 M0 155 Q135 92 219 199 T560 261" fill="none" stroke="#3B4CF0" strokeWidth="19" strokeLinecap="round"/>
         <path d="M13 300 L130 320 L148 415 L0 417 Z M390 14 L559 2 L552 101 L455 133 Z M351 309 L550 312 L559 420 L378 420 Z" fill="#F4B400" opacity=".8"/>
         <g stroke="#A9A6B3" strokeWidth="2" fill="none" opacity=".65"><path d="M44 0L220 420M165 0L351 420M335 0L544 420M0 67L560 93M0 265L560 310M0 358L560 359"/><path d="M75 0L18 420M468 0L290 420"/></g>
         <g fill="#F0EBE1" fontSize="14" fontFamily="monospace" fontWeight="700"><text x="165" y="116">PRAHA 1</text><text x="290" y="242">VLTAVA</text><text x="75" y="377">PETŘÍN</text><text x="415" y="70">LETNÁ</text></g>
         <path d="M287 153 Q267 153 267 174 Q267 190 287 212 Q307 190 307 174 Q307 153 287 153Z" fill="#FF5533" stroke="#15141F" strokeWidth="3"/>
         <circle cx="287" cy="173" r="7" fill="#15141F"/>
       </svg>
       <small>{tr.schematic}</small>
     </div>
     <div className="tt-map-events"><p>{tr.mapNote}</p>{filtered.map(e=><Link href={"/events/"+e.id+"?lang="+language} key={e.id} className="tt-map-event"><strong>{e.title}</strong><span>{dateLabel(e.starts_at,language)} · {e.location||"Praha"}</span><span className="tt-map-link">{tr.details} ↗</span></Link>)}</div>
   </div>:
   <div className="tt-swipe-area">
     <p className="tt-swipe-hint">{tr.hint}</p>
     {current?<div className="tt-swipe-stack">
       <div className="tt-swipe-card" tabIndex={0} role="group" aria-label={current.title}
         style={{transform:`translate3d(${drag.x}px,${drag.y}px,0) rotate(${drag.x/25}deg)`}}
         onKeyDown={e=>{if(e.key==="ArrowLeft"){e.preventDefault();advance("pass");}if(e.key==="ArrowRight"){e.preventDefault();advance("want");}if(e.key==="ArrowUp"){e.preventDefault();advance("view");}}}
         onPointerDown={e=>{if(e.pointerType==="mouse"&&e.button!==0)return;start.current={x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);}}
         onPointerMove={e=>{if(start.current)setDrag({x:e.clientX-start.current.x,y:e.clientY-start.current.y});}}
         onPointerUp={e=>{if(!start.current)return;const dx=e.clientX-start.current.x,dy=e.clientY-start.current.y;start.current=null;if(dy< -85)advance("view");else if(dx>85)advance("want");else if(dx< -85)advance("pass");else setDrag({x:0,y:0});}}
         onPointerCancel={()=>{start.current=null;setDrag({x:0,y:0});}}>
         <div className="tt-swipe-print">{current.image_url?<img src={current.image_url} alt="" draggable={false}/>:<img className="tt-swipe-placeholder" src="/brand/glyph-burst.svg" alt="" draggable={false}/>}
           <span className="tt-swipe-date">{dateLabel(current.starts_at,language)}</span>
           <span className="tt-swipe-mark" style={{opacity:Math.min(1,Math.abs(drag.x)/120)}}>{drag.x>=0?tr.want:tr.pass}</span>
         </div>
         <h3>{current.title}</h3><p>{current.location||"Praha"}</p>
       </div>
       <div className="tt-swipe-actions">
         <button type="button" className="tt-discovery-chip" onClick={()=>advance("pass")}><BrandIcon name="cross" size={16}/> {tr.pass}</button>
         <button type="button" className="tt-discovery-chip is-selected" onClick={()=>advance("want")}><BrandIcon name="heart" size={16}/> {tr.want}</button>
         <button type="button" className="tt-discovery-chip" onClick={()=>advance("view")}><BrandIcon name="arr-up" size={16}/> {tr.view}</button>
       </div>
       {feedback&&<p role="status">{feedback}</p>}
     </div>:<div className="state-card" role="status">{tr.done} <button type="button" className="button button-secondary" onClick={()=>setIndex(0)}>{tr.reset}</button></div>}
   </div>}
 </div>;
}
