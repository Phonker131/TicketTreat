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
export function ExampleTickets({language}:{language:LanguageCode}){
 const t=copy[language];
 const [selected,setSelected]=useState(0);
 const [back,setBack]=useState(false);
 const select=(index:number)=>{setSelected(index);setBack(false)};
 return <section className="tt-empty-tickets" aria-label={t.title}>
  <h2>{t.title}</h2><p>{t.intro}</p>
  <div className="tt-example-ticket-picker" role="tablist" aria-label={t.title}>
   {demos.map((item,i)=><button key={item.title} type="button" role="tab" id={"tt-example-tab-"+i} aria-controls="tt-example-ticket" aria-selected={selected===i}
    onClick={()=>select(i)}>{i+1}. {item.title}</button>)}
  </div>
  <div className={"tt-example-ticket tt-example-"+demos[selected].color} id="tt-example-ticket" role="tabpanel" aria-labelledby={"tt-example-tab-"+selected}>
   <span className="tt-example-stamp">{t.sample}</span>
   {!back?<><small>TICKETTREAT / TT-0000-XXXXXX</small><h3>{demos[selected].title}</h3><p>{demos[selected].date} · {t.place}</p>
       <div className="tt-example-glyph"><img src="/brand/glyph-burst.svg" alt=""/></div></>:
      <><small>TICKETTREAT / TT-0000-XXXXXX</small><div className="tt-example-glyph"><img src="/brand/glyph-cross.svg" alt=""/></div><p>{t.note}</p></>}
   <button type="button" onClick={()=>setBack(v=>!v)}>{back?t.hide:t.show} ↗</button>
  </div>
  <p>{t.note}</p>
  <Link href="/" className="button button-primary">{t.find} ↗</Link>
 </section>;
}
