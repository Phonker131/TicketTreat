"use client";
import {useEffect,useState} from "react";
import {WaveShader} from "@/components/premium/WaveShader";
import {dateParts} from "@/components/premium/EventLists";
import {levelName,progressLine,rewardsCopy} from "@/components/premium/RewardsTrack";
import {getEvents} from "@/lib/api";
import type {LanguageCode,TicketTreatEvent} from "@/lib/types";

const COPY={
 en:{line:"One account for every ticket",sub:"Email, Google or Telegram. Your QR tickets and rewards stay in one place.",preview:"Your profile after sign-in",role:"Participant",visits:"4 check-ins",tickets:"My tickets",next:"Your next event"},
 cs:{line:"Jeden účet pro všechny vstupenky",sub:"E-mail, Google nebo Telegram. QR vstupenky i odměny máte na jednom místě.",preview:"Takhle vypadá váš profil",role:"Účastník",visits:"4 návštěvy",tickets:"Moje vstupenky",next:"Vaše další akce"},
 ru:{line:"Один аккаунт для всех билетов",sub:"Email, Google или Telegram. QR-билеты и награды в одном месте.",preview:"Так выглядит ваш профиль",role:"Участник",visits:"4 визита",tickets:"Мои билеты",next:"Ваш следующий ивент"},
 uk:{line:"Один акаунт для всіх квитків",sub:"Email, Google або Telegram. QR-квитки й нагороди в одному місці.",preview:"Так виглядає ваш профіль",role:"Учасник",visits:"4 візити",tickets:"Мої квитки",next:"Ваша наступна подія"},
} as const;
const SAMPLE_VISITS=4;

/** The picture beside the sign-in form: a small copy of the profile the guest gets after signing in
 *  (their tickets with QR, their rewards level), drawn over the night glow. Real upcoming events fill it. */
export function LoginArt({language}:{language:LanguageCode}){
 const c=COPY[language];
 const [events,setEvents]=useState<TicketTreatEvent[]>([]);
 useEffect(()=>{
  const ctrl=new AbortController();
  getEvents(ctrl.signal).then(list=>setEvents(list
   .filter(e=>!e.is_cancelled&&e.starts_at&&new Date(e.starts_at).getTime()>Date.now())
   .sort((a,b)=>String(a.starts_at).localeCompare(String(b.starts_at))).slice(0,2))).catch(()=>{});
  return()=>ctrl.abort();
 },[]);
 const rows:(TicketTreatEvent|null)[]=events.length?events:[null,null];
 return <aside className="tt-login-art" aria-hidden="true">
  <WaveShader className="tt-login-wave"/>
  <div className="tt-lp">
   <p className="tt-lp-label">{c.preview}</p>
   <div className="tt-lp-user">
    <b>A</b>
    <div><strong>Anna</strong><small>{c.role}</small></div>
    <em>{c.visits}</em>
   </div>
   <p className="tt-lp-h">{c.tickets}</p>
   {rows.map((e,i)=>{
    const d=e?dateParts(e.starts_at,language):null;
    return <div className="tt-lp-ticket" key={e?.id??i}>
     <span className="tt-lp-thumb">{e?.image_url&&<img src={e.image_url} alt="" loading="lazy"/>}</span>
     <div><strong>{e?.title||c.next}</strong><small>{d?`${d.weekday} ${d.day} ${d.month}, ${d.time}`:" "}</small></div>
     <span className="tt-lp-qr"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/></svg>QR</span>
    </div>;
   })}
   <p className="tt-lp-h">{rewardsCopy[language].title}</p>
   <div className="tt-lp-level">
    <div><strong>{levelName(language,SAMPLE_VISITS)}</strong><small>{progressLine(language,SAMPLE_VISITS)}</small></div>
    <span className="tt-lp-track"><i className="on"/><i className="on"/><i/><i/></span>
   </div>
  </div>
  <div className="tt-login-art-copy"><p>{c.line}</p><span>{c.sub}</span></div>
 </aside>;
}
