"use client";
import {EventTitle} from "@/lib/use-event-translation";
import {useEffect,useRef,useState} from "react";
import Link from "next/link";
import {PosterArt} from "@/components/premium/PosterArt";
import {eventDisplayDate,formatPrice} from "@/lib/format";
import {localeForLanguage,t} from "@/lib/i18n";
import {useWanted} from "@/lib/wanted";
import type {LanguageCode,TicketTreatEvent} from "@/lib/types";

const WORDS={
 en:{left:"left",few:"Few spots left",sold:"Sold out",save:"Save",unsave:"Remove from saved",free:"Free"},
 cs:{left:"volných",few:"Posledních pár míst",sold:"Vyprodáno",save:"Uložit",unsave:"Odebrat z uložených",free:"Zdarma"},
 ru:{left:"мест",few:"Осталось мало мест",sold:"Мест нет",save:"Сохранить",unsave:"Убрать из сохранённых",free:"Бесплатно"},
 uk:{left:"місць",few:"Залишилось мало місць",sold:"Місць немає",save:"Зберегти",unsave:"Прибрати зі збережених",free:"Безкоштовно"},
} as const;

/** Day, month, weekday and time of an event in venue time, for the big date block. */
export function dateParts(value:string|null,language:LanguageCode){
 if(!value)return null;
 const {date,timeZone}=eventDisplayDate(value);
 if(Number.isNaN(date.getTime()))return null;
 const loc=localeForLanguage(language);
 const part=(o:Intl.DateTimeFormatOptions)=>new Intl.DateTimeFormat(loc,{timeZone,...o}).format(date);
 return {day:part({day:"numeric"}),month:part({month:"short"}).replace(".",""),weekday:part({weekday:"short"}).replace(".",""),time:part({hour:"2-digit",minute:"2-digit"})};
}

function Poster({event,eager=false}:{event:TicketTreatEvent;eager?:boolean}){
 const [failed,setFailed]=useState(false);
 const img=useRef<HTMLImageElement>(null);
 // A photo that failed before hydration never reaches onError, so it is also checked on mount.
 useEffect(()=>{const el=img.current;setFailed(!!el&&el.complete&&el.naturalWidth===0)},[event.image_url]);
 if(!event.image_url||failed)return <PosterArt seed={event.id} className="tt-poster-art" label={event.title}/>;
 // eslint-disable-next-line @next/next/no-img-element
 return <img ref={img} src={event.image_url} alt="" loading={eager?"eager":"lazy"} decoding="async" onError={()=>setFailed(true)}/>;
}

function status(event:TicketTreatEvent,language:LanguageCode){
 const w=WORDS[language];
 if(event.spots_left===0)return {text:w.sold,tone:"sold"};
 if(event.spots_left!=null&&event.max_participants&&event.spots_left<=Math.max(3,Math.ceil(Number(event.max_participants)*.2)))return {text:w.few,tone:"few"};
 if(event.spots_left!=null)return {text:`${event.spots_left} ${w.left}`,tone:"open"};
 return null;
}

/** Poster-first row at the top of the home page: every poster whole, in its own 4:5 format. */
export function PosterRail({events,language}:{events:TicketTreatEvent[];language:LanguageCode}){
 return <ul className="tt-rail" aria-label={language==="cs"?"Nejbližší akce":"Upcoming events"}>
  {events.map((event,i)=>{
   const d=dateParts(event.starts_at,language);
   return <li key={event.id}>
    <Link href={`/events/${event.id}`} className="tt-rail-card">
     <span className="tt-rail-poster"><Poster event={event} eager={i<2}/></span>
     {d&&<span className="tt-rail-date">{d.weekday} {d.day} {d.month}, {d.time}</span>}
     <strong className="tt-rail-title"><EventTitle event={event}/></strong>
     <span className="tt-rail-meta">{[event.location,formatPrice(event,language)].filter(Boolean).join(", ")}</span>
    </Link>
   </li>;
  })}
 </ul>;
}

/** The listing as a departure board: big date, small poster, title, place and time, price and how many spots are left. */
export function EventBoard({events,language}:{events:TicketTreatEvent[];language:LanguageCode}){
 const [wanted,setWanted]=useWanted();
 const w=WORDS[language];
 return <ol className="tt-board">
  {events.map(event=>{
   const d=dateParts(event.starts_at,language);
   const s=status(event,language);
   const on=wanted.includes(event.id);
   return <li key={event.id} className="tt-board-row">
    <Link href={`/events/${event.id}`} className="tt-board-link">
     <span className="tt-board-date" aria-hidden={!d}>{d?<><b>{d.day}</b><small>{d.month}</small></>:<b>-</b>}</span>
     <span className="tt-board-thumb"><Poster event={event}/></span>
     <span className="tt-board-main">
      <strong><EventTitle event={event}/></strong>
      <span>{[d&&`${d.weekday} ${d.time}`,event.location].filter(Boolean).join(", ")}</span>
     </span>
     <span className="tt-board-side">
      <span className="tt-board-price">{Number(event.price||0)>0?formatPrice(event,language):t(language,"free")}</span>
      {s&&<span className={`tt-board-status is-${s.tone}`}>{s.text}</span>}
     </span>
    </Link>
    <button type="button" className="tt-board-save" aria-pressed={on} aria-label={`${on?w.unsave:w.save}: ${event.title}`} onClick={()=>setWanted(event.id,!on)}>
     <svg width="20" height="20" viewBox="0 0 24 24" fill={on?"currentColor":"none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20s-7-4.6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.4-7 10-7 10z"/></svg>
    </button>
   </li>;
  })}
 </ol>;
}
