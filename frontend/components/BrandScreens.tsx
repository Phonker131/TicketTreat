import type {LanguageCode,TicketTreatEvent} from "@/lib/types";

type PhoneKind="discover"|"event"|"reserve"|"ticket"|"qr"|"passport";
const phrases={
 ru:{sample:"ПРИМЕР",events:"ИВЕНТЫ",tickets:"МОИ БИЛЕТЫ",book:"ЗАПИСАТЬСЯ",ticket:"КВИЗ-НОЧЬ",free:"БЕСПЛАТНО",view:"БИЛЕТ",pending:"ПОДТВЕРЖДЕНИЕ",valid:"ДЕМО — НЕ БИЛЕТ",level:"НОВИЧОК",checkin:"ПОСЛЕ CHECK-IN"},
 uk:{sample:"ПРИКЛАД",events:"ПОДІЇ",tickets:"МОЇ КВИТКИ",book:"ЗАПИСАТИСЯ",ticket:"КВІЗ-НІЧ",free:"БЕЗКОШТОВНО",view:"КВИТОК",pending:"ПІДТВЕРДЖЕННЯ",valid:"ДЕМО — НЕ КВИТОК",level:"НОВАЧОК",checkin:"ПІСЛЯ CHECK-IN"},
 cs:{sample:"PŘÍKLAD",events:"AKCE",tickets:"MOJE VSTUPENKY",book:"REZERVOVAT",ticket:"KVÍZOVÝ VEČER",free:"ZDARMA",view:"VSTUPENKA",pending:"POTVRZENÍ",valid:"UKÁZKA — NE VSTUPENKA",level:"NOVÁČEK",checkin:"PO ODBAVENÍ"},
 en:{sample:"EXAMPLE",events:"EVENTS",tickets:"MY TICKETS",book:"RESERVE",ticket:"QUIZ NIGHT",free:"FREE",view:"TICKET",pending:"CONFIRMATION",valid:"DEMO — NOT A TICKET",level:"NEWCOMER",checkin:"AFTER CHECK-IN"}
} as const;

export function BrandPhone({kind,language,event,compact=false}:{kind:PhoneKind;language:LanguageCode;event?:TicketTreatEvent|null;compact?:boolean}){
 const tr=phrases[language],title=event?.title||tr.ticket,photo=event?.image_url;
 return <div className={"tt-device-phone"+(compact?" tt-device-compact":"")} aria-hidden="true">
  <span className="tt-device-camera"/>
  <div className="tt-device-screen">
   <div className="tt-device-top"><b>TICKET<span>TREAT</span></b><small>•••</small></div>
   <span className="tt-device-demo">{tr.sample}</span>
   {kind==="passport"?<div className="tt-device-passport">
     <small>LV.1 / 0</small><strong>{tr.level}</strong><div className="tt-device-stamp">✳</div>
     <span>0 / 3</span><div className="tt-device-progress"><i/><i/><i/></div><small>{tr.checkin}</small>
    </div>:kind==="qr"?<div className="tt-device-ticket tt-device-ticket-back">
       <small>{tr.view} / {tr.sample}</small><div className="tt-device-qr"><span>QR</span></div>
       <strong>{tr.valid}</strong><small>TT-0000-XXXXXX</small>
     </div>:kind==="ticket"?<div className="tt-device-ticket">
      <small>{tr.view} / {tr.sample}</small><strong>{title}</strong>
      <div className="tt-device-ticket-symbol">✳</div><span>{tr.valid}</span>
      <small>TT-0000-XXXXXX</small>
     </div>:<div className="tt-device-event">
      <small>{kind==="discover"?tr.events:kind==="reserve"?tr.pending:tr.events}</small>
      <div className="tt-device-event-poster">{photo?<img src={photo} alt="" loading="lazy"/>:<span>✳</span>}</div>
      <strong>{title}</strong><small>{event?.location||"PRAHA"} / TICKETTREAT</small>
      <div className="tt-device-event-price">{tr.free}</div>
      <div className="tt-device-event-button">{kind==="reserve"?tr.pending:tr.book} <span>↗</span></div>
     </div>}
   <div className="tt-device-bottom"><span>✳<small>{tr.events}</small></span><span>▤<small>{tr.tickets}</small></span><span>＋<small>ME</small></span></div>
  </div>
 </div>
}

export function BrandLaptop({language,kind="guests",event}:{language:LanguageCode;kind?:"guests"|"create"|"checkin"|"overview";event?:TicketTreatEvent|null}){
 const t={
  ru:{sample:"ПРИМЕР ИНТЕРФЕЙСА",title:"КАБИНЕТ ОРГАНИЗАТОРА",events:"Ивенты",guests:"Гости",checkin:"Вход",settings:"Настройки",new:"Новый ивент",name:"Название",date:"Дата",where:"Площадка",save:"Создать",registered:"Регистрации",tickets:"Билеты",marked:"Отметка"},
  cs:{sample:"UKÁZKA ROZHRANÍ",title:"KABINET POŘADATELE",events:"Akce",guests:"Hosté",checkin:"Vstup",settings:"Nastavení",new:"Nová akce",name:"Název",date:"Datum",where:"Místo",save:"Vytvořit",registered:"Registrace",tickets:"Vstupenky",marked:"Odbaveno"},
  uk:{sample:"ПРИКЛАД ІНТЕРФЕЙСУ",title:"КАБІНЕТ ОРГАНІЗАТОРА",events:"Події",guests:"Гості",checkin:"Вхід",settings:"Налаштування",new:"Нова подія",name:"Назва",date:"Дата",where:"Місце",save:"Створити",registered:"Реєстрації",tickets:"Квитки",marked:"Відмічено"},
  en:{sample:"INTERFACE EXAMPLE",title:"ORGANIZER DASHBOARD",events:"Events",guests:"Guests",checkin:"Check-in",settings:"Settings",new:"New event",name:"Title",date:"Date",where:"Venue",save:"Create",registered:"Registrations",tickets:"Tickets",marked:"Checked in"}
 }[language];
 return <div className="tt-device-laptop" aria-hidden="true">
  <div className="tt-device-laptop-screen">
    <div className="tt-device-laptop-sidebar"><b>T<span>T</span></b><small>{t.events}</small><small>{t.guests}</small><small>{t.checkin}</small></div>
    <div className="tt-device-laptop-content">
      <small className="tt-device-demo-label">{t.sample}</small>
      <strong>{kind==="create"?t.new:kind==="checkin"?t.checkin:kind==="overview"?t.title:t.guests}</strong>
      {kind==="create"?<div className="tt-device-form">
        {[t.name,t.date,t.where].map((v,i)=><label key={v}>{v}<span>{i===0?(event?.title||"TICKETTREAT"):i===1?"2026 / PRAHA":"PRAHA"}</span></label>)}
        <div className="tt-device-submit">{t.save} ↗</div>
       </div>:<><div className="tt-device-metrics">
        {[t.registered,t.tickets,t.marked].map((v,i)=><div key={v}><b>{i===0?"—":i===1?"—":"—"}</b><span>{v}</span></div>)}
       </div><div className="tt-device-rows">
        {Array.from({length:3},(_,i)=><div key={i}><span>{i+1}. {event?.title||"TICKETTREAT EVENT"}</span><i>{kind==="checkin"?"✓":kind==="guests"?"—":"↗"}</i></div>)}
       </div></>}
    </div>
  </div><div className="tt-device-laptop-base"/>
 </div>
}
