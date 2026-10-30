"use client";
import {useState} from "react";
import Link from "next/link";
import type {LanguageCode} from "@/lib/types";
const copy={
 ru:{title:"Здесь будут ваши билеты",intro:"Так выглядят билеты TicketTreat. Листайте примеры и нажмите на билет, чтобы увидеть оборот.",sample:"Пример",note:"Недействительный пример. Не даёт права входа.",show:"Показать оборот",hide:"Назад к билету",find:"Найти ивент",place:"Прага"},
 cs:{title:"Tady budou vaše vstupenky",intro:"Takto vypadají vstupenky TicketTreat. Projděte si příklady a otočte vstupenku.",sample:"Příklad",note:"Neplatný příklad. Neopravňuje ke vstupu.",show:"Otočit vstupenku",hide:"Zpět na vstupenku",find:"Najít akci",place:"Praha"},
 uk:{title:"Тут будуть ваші квитки",intro:"Так виглядатимуть квитки TicketTreat. Гортайте приклади й натисніть на квиток, щоб побачити зворот.",sample:"Приклад",note:"Недійсний приклад. Не надає права входу.",show:"Показати зворот",hide:"Назад до квитка",find:"Знайти подію",place:"Прага"},
 en:{title:"Your tickets will appear here",intro:"This is how TicketTreat tickets look. Browse the examples and flip a ticket to see the back.",sample:"Example",note:"Illustration only. Not a valid admission ticket.",show:"Flip ticket",hide:"Back to ticket",find:"Find an event",place:"Prague"}
};
const demos=[
 {title:"Speed Dating",date:"14.11.2026",color:"tom"},
 {title:"Quiz Night",date:"21.11.2026",color:"blu"},
 {title:"Night Pass",date:"05.12.2026",color:"yel"}
] as const;
function SampleTicket({item,language,index}:{item:(typeof demos)[number];language:LanguageCode;index:number}){
 const t=copy[language];
 const [back,setBack]=useState(false);
 return <article className={"tt-example-ticket tt-example-"+item.color+(back?" is-flipped":"")} aria-label={item.title+" — "+t.sample}>
  <span className="tt-example-stamp">{t.sample}</span>
  <div className="tt-example-ticket-body">
   <small>TICKETTREAT / TT-0000-XXXXXX</small>
   {back?<div className="tt-example-ticket-reverse">
     <strong>{t.note}</strong><div className="tt-example-not-qr" aria-hidden="true">QR</div>
     <small>TT-0000-XXXXXX</small>
   </div>:<><h3>{item.title}</h3><div className="tt-example-ticket-symbol">✳</div><p>{item.date} · {t.place}</p></>}
   <span className="tt-example-perforation" aria-hidden="true"/>
   <div className="tt-example-ticket-bottom"><small>{t.sample} / {index+1}</small><button type="button" aria-pressed={back} onClick={()=>setBack(v=>!v)}>{back?t.hide:t.show} ↗</button></div>
  </div>
 </article>
}
export function ExampleTickets({language}:{language:LanguageCode}){
 const t=copy[language];
 return <section className="tt-empty-tickets" aria-label={t.title}>
  <h2>{t.title}</h2><p>{t.intro}</p>
  <div className="tt-example-ticket-tray" role="list" aria-label={t.title}>
    {demos.map((item,i)=><div role="listitem" key={item.title}><SampleTicket item={item} language={language} index={i}/></div>)}
  </div>
  <p className="tt-example-disclaimer">{t.note}</p>
  <Link href="/" className="button button-primary">{t.find} ↗</Link>
 </section>;
}
