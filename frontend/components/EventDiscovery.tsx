"use client";
import {useEffect,useRef,useState} from "react";
import * as M from "motion/react-m";
import {EventCard} from "@/components/EventCard";
import {SwipeDeck} from "@/components/premium/SwipeDeck";
import {MoodEmpty} from "@/components/premium/EventsPlaceholders";
import {premium} from "@/components/premium/copy";
import {t} from "@/lib/i18n";
import {eventDisplayDate} from "@/lib/format";
import type {LanguageCode,TicketTreatEvent} from "@/lib/types";

type Mode="swipe"|"list";
type Mood="all"|"meet"|"friends"|"listen"|"dance";
const copy={
 ru:{label:"Найди свой ивент",mood:"Настроение",mode:"Режим поиска",all:"Любое",meet:"Познакомиться",friends:"С друзьями",listen:"Послушать",dance:"Потанцевать",swipe:"Свайп",list:"Лента",want:"Хочу",pass:"Мимо",view:"Смотреть",saved:"В избранном этого браузера",done:"Афиши закончились",reset:"Посмотреть снова",hint:"Свайп влево / вправо / вверх или стрелки клавиатуры. «Хочу» сохраняет интерес, но не бронирует билет.",noMatch:"Нет событий с выбранным настроением.",details:"Открыть ивент"},
 cs:{label:"Najdi svou akci",mood:"Nálada",mode:"Režim hledání",all:"Cokoliv",meet:"Seznámit se",friends:"S přáteli",listen:"Poslechnout",dance:"Zatančit",swipe:"Karty",list:"Seznam",want:"Chci",pass:"Přeskočit",view:"Zobrazit",saved:"Uloženo v tomto prohlížeči",done:"Žádné další plakáty",reset:"Začít znovu",hint:"Přejeď doleva / doprava / nahoru, nebo použij šipky na klávesnici. «Chci» neprovádí rezervaci.",noMatch:"Pro tuto náladu nemáme akce.",details:"Otevřít akci"},
 uk:{label:"Знайди свою подію",mood:"Настрій",mode:"Режим пошуку",all:"Будь-який",meet:"Познайомитися",friends:"З друзями",listen:"Послухати",dance:"Потанцювати",swipe:"Свайп",list:"Стрічка",want:"Хочу",pass:"Пропустити",view:"Переглянути",saved:"Збережено в цьому браузері",done:"Афіші закінчилися",reset:"Переглянути знову",hint:"Свайп ліворуч / праворуч / угору або клавіші зі стрілками. «Хочу» не бронює квиток.",noMatch:"Немає подій з таким настроєм.",details:"Відкрити подію"},
 en:{label:"Find your event",mood:"Mood",mode:"Browse mode",all:"Anything",meet:"Meet people",friends:"With friends",listen:"Listen",dance:"Dance",swipe:"Swipe",list:"Feed",want:"Want",pass:"Pass",view:"View",saved:"Saved in this browser",done:"No more posters",reset:"See again",hint:"Swipe left / right / up or use arrow keys. Want saves an event, it does not book a ticket.",noMatch:"No events match this mood.",details:"View event"}
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
function priceText(e:TicketTreatEvent,lang:LanguageCode){
 const n=Number(e.price||0);
 if(!Number.isFinite(n)||n<=0)return t(lang,"free");
 const cur=/^[A-Za-z]{3}$/.test(e.currency||"")?(e.currency as string).toUpperCase():"CZK";
 return new Intl.NumberFormat(lang==="cs"?"cs-CZ":lang==="uk"?"uk-UA":lang==="en"?"en-GB":"ru-RU",{maximumFractionDigits:Number.isInteger(n)?0:2}).format(n)+" "+cur;
}
const MOOD_ICON:Record<Mood,React.ReactNode>={
 all:<><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 3v4M17 5h4"/></>,
 meet:<path d="M12 20s-7-4.6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.4-7 10-7 10z"/>,
 friends:<><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9.5" r="2.4"/><path d="M3.5 19c.5-3.2 2.6-5 5.5-5s5 1.8 5.5 5M15 14.2c2.8-.4 4.9 1 5.5 4.3"/></>,
 listen:<path d="M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v5H5a1 1 0 0 1-1-1zm16 0h-3v5h2a1 1 0 0 0 1-1z"/>,
 dance:<path d="M13 3L5 13h6l-1 8 8-10h-6z"/>
};
export function EventDiscovery({events,language}:{events:TicketTreatEvent[];language:LanguageCode}){
 const tr=copy[language];
 const [mode,setMode]=useState<Mode>("swipe");
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
 const modeButtons:Mode[]=["swipe","list"];
 return <div className="tt-discovery">
   <div className="tt-discovery-controls tp-filterbar">
     <div className="tp-seg" role="group" aria-label={tr.mode}>
       {modeButtons.map(m=><button type="button" key={m} aria-pressed={mode===m} onClick={()=>setMode(m)}>
         {mode===m&&<M.span layoutId="tp-seg-pill" className="tp-seg-pill" transition={{type:"spring",stiffness:420,damping:34}}/>}
         <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{m==="swipe"?<><rect x="6" y="5" width="12" height="15" rx="2.5"/><path d="M9 3h6"/></>:<><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></>}</svg>
         <span>{tr[m]}</span></button>)}
     </div>
     <div className="tp-moods" role="group" aria-label={tr.mood}>
       {moodButtons.map(m=><button type="button" key={m} className="tp-mood" aria-pressed={mood===m} onClick={()=>setMood(m)}>
         <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{MOOD_ICON[m]}</svg>
         <span>{tr[m]}</span></button>)}
     </div>
   </div>
   {filtered.length===0?<MoodEmpty language={language} title={tr.noMatch} onReset={()=>setMood("all")}/>:
   mode==="list"?<div className="event-grid tp-feed">{filtered.map(event=><EventCard key={event.id} event={event}/>)}</div>:
   <div className="tt-swipe-area">
     <SwipeDeck events={filtered} index={index}
       labels={{want:tr.want,pass:tr.pass,view:tr.view,hint:tr.hint,done:tr.done,doneText:premium[language].empty.doneText,reset:premium[language].empty.reset}}
       dateOf={e=>dateLabel(e.starts_at,language)} priceOf={e=>priceText(e,language)}
       onAction={a=>advance(a)} onReset={()=>setIndex(0)}/>
     {feedback&&<p role="status" className="tp-deck-feedback">{feedback}</p>}
   </div>}
 </div>;
}
