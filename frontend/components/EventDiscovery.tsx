"use client";
import {useEffect,useState} from "react";
import * as M from "motion/react-m";
import {EventCard} from "@/components/EventCard";
import {SwipeDeck} from "@/components/premium/SwipeDeck";
import {MoodEmpty} from "@/components/premium/EventsPlaceholders";
import {premium} from "@/components/premium/copy";
import {t} from "@/lib/i18n";
import {eventDisplayDate} from "@/lib/format";
import {EVENT_TAGS,TAG_LABELS,TagIcon,eventTags,type EventTag} from "@/lib/event-tags";
import {useWanted} from "@/lib/wanted";
import type {LanguageCode,TicketTreatEvent} from "@/lib/types";

type Mode="swipe"|"list"|"saved";
type Mood="all"|EventTag;
const copy={
 ru:{mood:"Настроение",mode:"Режим поиска",all:"Любое",swipe:"Свайп",list:"Лента",savedMode:"Избранное",want:"Хочу",pass:"Мимо",view:"Смотреть",saved:"Сохранено в избранное",done:"Афиши закончились",hint:"Свайп влево / вправо / вверх или стрелки клавиатуры. «Хочу» сохраняет ивент в избранное, но не бронирует билет.",noMatch:"Нет событий с выбранным настроением.",noSaved:"В избранном пока пусто",noSavedText:"Свайпни вправо или нажми сердечко на карточке: ивент появится здесь и на странице «Мои билеты».",toSwipe:"К свайпу",savedCount:"в избранном"},
 cs:{mood:"Nálada",mode:"Režim hledání",all:"Cokoliv",swipe:"Karty",list:"Seznam",savedMode:"Uložené",want:"Chci",pass:"Přeskočit",view:"Zobrazit",saved:"Uloženo",done:"Žádné další plakáty",hint:"Přejeď doleva / doprava / nahoru, nebo použij šipky na klávesnici. «Chci» akci uloží, neprovádí rezervaci.",noMatch:"Pro tuto náladu nemáme akce.",noSaved:"Zatím nic uloženého",noSavedText:"Přejeď doprava nebo klepni na srdíčko: akce se objeví tady a v «Moje vstupenky».",toSwipe:"Ke kartám",savedCount:"uložených"},
 uk:{mood:"Настрій",mode:"Режим пошуку",all:"Будь-який",swipe:"Свайп",list:"Стрічка",savedMode:"Обране",want:"Хочу",pass:"Пропустити",view:"Переглянути",saved:"Збережено в обране",done:"Афіші закінчилися",hint:"Свайп ліворуч / праворуч / угору або клавіші зі стрілками. «Хочу» зберігає подію, але не бронює квиток.",noMatch:"Немає подій з таким настроєм.",noSaved:"В обраному поки порожньо",noSavedText:"Свайпни праворуч або натисни сердечко: подія з'явиться тут і в «Мої квитки».",toSwipe:"До свайпу",savedCount:"в обраному"},
 en:{mood:"Mood",mode:"Browse mode",all:"Anything",swipe:"Swipe",list:"List",savedMode:"Saved",want:"Want",pass:"Pass",view:"View",saved:"Saved to your list",done:"No more posters",hint:"Swipe left / right / up or use arrow keys. Want saves an event to your list, it does not book a ticket.",noMatch:"No events match this mood.",noSaved:"Nothing saved yet",noSavedText:"Swipe right or tap the heart on a card: the event shows up here and under My tickets.",toSwipe:"Back to swipe",savedCount:"saved"}
} as const;

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
const MODE_ICON:Record<Mode,React.ReactNode>={
 swipe:<><rect x="6" y="5" width="12" height="15" rx="2.5"/><path d="M9 3h6"/></>,
 list:<><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></>,
 saved:<path d="M12 20s-7-4.6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.4-7 10-7 10z"/>
};

export function EventDiscovery({events,language}:{events:TicketTreatEvent[];language:LanguageCode}){
 const tr=copy[language];
 const [mode,setMode]=useState<Mode>("list");
 const [mood,setMood]=useState<Mood>("all");
 const [index,setIndex]=useState(0);
 const [feedback,setFeedback]=useState("");
 const [wanted,setWanted]=useWanted();
 const filtered=events.filter(e=>mood==="all"||eventTags(e).includes(mood));
 const saved=events.filter(e=>wanted.includes(e.id));
 const current=filtered[index];
 const advance=(action:"want"|"pass"|"view")=>{
   if(!current)return;
   if(action==="view"){window.location.assign("/events/"+current.id+"?lang="+language);return;}
   if(action==="want"){setWanted(current.id,true);setFeedback(tr.saved);}else setFeedback("");
   setIndex(i=>i+1);
 };
 useEffect(()=>{setIndex(0);setFeedback("");},[mood,mode]);
 const moodButtons:Mood[]=["all",...EVENT_TAGS];
 const modeButtons:Mode[]=["list","saved","swipe"];
 return <div className="tt-discovery">
   <div className="tt-discovery-controls tp-filterbar">
     <div className="tp-seg" role="group" aria-label={tr.mode}>
       {modeButtons.map(m=><button type="button" key={m} aria-pressed={mode===m} onClick={()=>setMode(m)}>
         {mode===m&&<M.span layoutId="tp-seg-pill" className="tp-seg-pill" transition={{type:"spring",stiffness:420,damping:34}}/>}
         <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{MODE_ICON[m]}</svg>
         <span>{m==="saved"?tr.savedMode:tr[m]}</span>
         {m==="saved"&&saved.length>0&&<b className="tp-seg-count" aria-label={`${saved.length} ${tr.savedCount}`}>{saved.length}</b>}
       </button>)}
     </div>
     {mode!=="saved"&&<div className="tp-moods" role="group" aria-label={tr.mood}>
       {moodButtons.map(m=><button type="button" key={m} className="tp-mood" aria-pressed={mood===m} onClick={()=>setMood(m)}>
         <TagIcon tag={m}/>
         <span>{m==="all"?tr.all:TAG_LABELS[language][m]}</span></button>)}
     </div>}
   </div>
   {mode==="saved"?(saved.length===0
     ?<MoodEmpty language={language} title={tr.noSaved} text={tr.noSavedText} action={tr.toSwipe} onReset={()=>setMode("swipe")}/>
     :<div className="event-grid tp-feed">{saved.map(event=><EventCard key={event.id} event={event}/>)}</div>):
   filtered.length===0?<MoodEmpty language={language} title={tr.noMatch} onReset={()=>setMood("all")}/>:
   mode==="list"?<div className="event-grid tp-feed">{filtered.map(event=><EventCard key={event.id} event={event}/>)}</div>:
   <div className="tt-swipe-area">
     <SwipeDeck events={filtered} index={index}
       labels={{want:tr.want,pass:tr.pass,view:tr.view,hint:tr.hint,done:tr.done,doneText:premium[language].empty.doneText,reset:premium[language].empty.reset}}
       dateOf={e=>dateLabel(e.starts_at,language)} priceOf={e=>priceText(e,language)}
       onAction={a=>advance(a)} onReset={()=>setIndex(0)}/>
     {feedback&&<p role="status" className="tp-deck-feedback">{feedback} · <button type="button" className="tp-linkbtn" onClick={()=>setMode("saved")}>{tr.savedMode}{saved.length?` (${saved.length})`:""}</button></p>}
   </div>}
 </div>;
}
