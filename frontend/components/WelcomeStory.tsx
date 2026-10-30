"use client";
import {useEffect,useRef,useState} from "react";
import type {LanguageCode} from "@/lib/types";

const KEY="tt4-story";
type Slide={ink:"ink"|"tom"|"paper"|"blu"|"yel";title:string;text:string;step:string};
const scripts:Record<LanguageCode,Slide[]>={
 ru:[
  {ink:"ink",step:"Пример ситуации · 1/5",title:"Пятница. Вы хотите на квиз",text:"Вы нашли вечер для друзей. Осталось узнать, есть ли места."},
  {ink:"tom",step:"Пример ситуации · 2/5",title:"Вы пишете организатору",text:"Сообщения, ожидание ответа и уточнения легко теряются."},
  {ink:"paper",step:"Пример ситуации · 3/5",title:"У организатора таблица",text:"Имена, ответы и подтверждения приходится сверять вручную."},
  {ink:"blu",step:"Пример ситуации · 4/5",title:"На входе очередь",text:"Гости ищут переписку. Организатор проверяет каждого."},
  {ink:"yel",step:"Пример ситуации · 5/5",title:"Всё в одном месте",text:"В TicketTreat регистрация и QR-билет связаны с мероприятием."},
  {ink:"ink",step:"Как это работает · 1/3",title:"Выберите вечер",text:"Свайп, лента или карта: найдите событие и откройте его страницу."},
  {ink:"blu",step:"Как это работает · 2/3",title:"Запишитесь",text:"На бесплатный ивент получите билет сразу. Для платного следуйте инструкции организатора и дождитесь подтверждения."},
  {ink:"tom",step:"Как это работает · 3/3",title:"Покажите QR",text:"Откройте «Мои билеты», выберите билет и нажмите «Показать QR» у входа."},
  {ink:"ink",step:"Готово",title:"Просто приходите",text:"После настоящей отметки на входе посещение появится в паспорте гостя."}
 ],
 en:[
  {ink:"ink",step:"Example situation · 1/5",title:"Friday. Quiz night",text:"You found an evening with friends. Are there spots left?"},
  {ink:"tom",step:"Example situation · 2/5",title:"Message the organizer",text:"Messages and confirmations can get lost in a busy inbox."},
  {ink:"paper",step:"Example situation · 3/5",title:"A guest spreadsheet",text:"The organizer has to reconcile every name and confirmation."},
  {ink:"blu",step:"Example situation · 4/5",title:"A queue at the door",text:"Guests look for messages while staff check the list."},
  {ink:"yel",step:"Example situation · 5/5",title:"One place for tickets",text:"TicketTreat links your registration and QR ticket to the event."},
  {ink:"ink",step:"How it works · 1/3",title:"Pick your night",text:"Find an event by swiping, browsing the feed or looking at the map."},
  {ink:"blu",step:"How it works · 2/3",title:"Reserve your place",text:"Free events issue a ticket immediately. For paid events, follow the organizer's instructions and await confirmation."},
  {ink:"tom",step:"How it works · 3/3",title:"Show your QR",text:"Open My tickets, choose the ticket and tap Show QR at the entrance."},
  {ink:"ink",step:"You're all set",title:"Enjoy your night",text:"An actual check-in counts toward your guest passport."}
 ],
 cs:[
  {ink:"ink",step:"Příklad situace · 1/5",title:"Pátek. Kvízový večer",text:"Našli jste akci s přáteli. Jsou ještě volná místa?"},
  {ink:"tom",step:"Příklad situace · 2/5",title:"Píšete pořadateli",text:"Zprávy a potvrzení se mohou v konverzacích ztratit."},
  {ink:"paper",step:"Příklad situace · 3/5",title:"Tabulka se jmény",text:"Pořadatel ručně kontroluje jména a potvrzení."},
  {ink:"blu",step:"Příklad situace · 4/5",title:"Fronta u vstupu",text:"Hosté hledají zprávy a personál ověřuje seznam."},
  {ink:"yel",step:"Příklad situace · 5/5",title:"Vše na jednom místě",text:"TicketTreat propojuje registraci a QR vstupenku s akcí."},
  {ink:"ink",step:"Jak to funguje · 1/3",title:"Vyberte si akci",text:"Najděte večer pomocí karet, seznamu nebo mapy."},
  {ink:"blu",step:"Jak to funguje · 2/3",title:"Rezervujte si místo",text:"U akce zdarma dostanete vstupenku ihned. U placené akce postupujte podle pokynů pořadatele a počkejte na potvrzení."},
  {ink:"tom",step:"Jak to funguje · 3/3",title:"Ukažte QR kód",text:"Otevřete Moje vstupenky, vyberte vstupenku a u vstupu klepněte na Zobrazit QR."},
  {ink:"ink",step:"Hotovo",title:"Užijte si večer",text:"Skutečné odbavení se započítá do vašeho pasu hosta."}
 ],
 uk:[
  {ink:"ink",step:"Приклад ситуації · 1/5",title:"П'ятниця. Квіз",text:"Ви знайшли вечір для друзів. Чи залишилися місця?"},
  {ink:"tom",step:"Приклад ситуації · 2/5",title:"Пишете організатору",text:"Повідомлення та підтвердження легко губляться в чатах."},
  {ink:"paper",step:"Приклад ситуації · 3/5",title:"Таблиця гостей",text:"Організатор вручну звіряє імена та підтвердження."},
  {ink:"blu",step:"Приклад ситуації · 4/5",title:"Черга на вході",text:"Гості шукають листування, а персонал перевіряє список."},
  {ink:"yel",step:"Приклад ситуації · 5/5",title:"Усе в одному місці",text:"TicketTreat пов'язує реєстрацію та QR-квиток із подією."},
  {ink:"ink",step:"Як це працює · 1/3",title:"Оберіть вечір",text:"Знайдіть подію картками, у стрічці або на мапі."},
  {ink:"blu",step:"Як це працює · 2/3",title:"Забронюйте місце",text:"На безкоштовну подію квиток надійде одразу. Для платної виконайте інструкції організатора й дочекайтеся підтвердження."},
  {ink:"tom",step:"Як це працює · 3/3",title:"Покажіть QR",text:"Відкрийте «Мої квитки», оберіть квиток і натисніть «Показати QR» на вході."},
  {ink:"ink",step:"Готово",title:"Насолоджуйтесь вечором",text:"Справжня відмітка на вході зараховується до паспорта гостя."}
 ]
};
const labels={
 ru:{name:"Знакомство с TicketTreat",skip:"Пропустить",back:"Назад",next:"Дальше",again:"Ещё раз",finish:"Выбрать вечер",hint:"Свайп или стрелки для навигации"},
 en:{name:"TicketTreat welcome",skip:"Skip",back:"Back",next:"Next",again:"Replay",finish:"Explore events",hint:"Swipe or use arrow keys"},
 cs:{name:"Vítejte v TicketTreat",skip:"Přeskočit",back:"Zpět",next:"Dále",again:"Znovu",finish:"Vybrat akci",hint:"Přejeďte nebo použijte šipky"},
 uk:{name:"Знайомство з TicketTreat",skip:"Пропустити",back:"Назад",next:"Далі",again:"Ще раз",finish:"Обрати подію",hint:"Свайп або клавіші зі стрілками"}
};
export function WelcomeStory({language}:{language:LanguageCode}){
 const [open,setOpen]=useState(false),[page,setPage]=useState(0),[paused,setPaused]=useState(false);
 const root=useRef<HTMLDivElement>(null),previous=useRef<HTMLElement|null>(null),startX=useRef<number|null>(null);
 const slides=scripts[language],t=labels[language],last=page===slides.length-1;
 useEffect(()=>{
  const params=new URLSearchParams(location.search);
  if(params.has("nostory"))return;
  let seen=false;try{seen=localStorage.getItem(KEY)==="1"}catch{}
  if(params.has("story")||!seen)setOpen(true);
  const show=()=>{setPage(0);setOpen(true)};
  window.addEventListener("tickettreat-open-story",show);
  return()=>window.removeEventListener("tickettreat-open-story",show);
 },[]);
 function close(){
  try{localStorage.setItem(KEY,"1")}catch{}
  setOpen(false);
  previous.current?.focus();
 }
 useEffect(()=>{
  if(!open)return;
  previous.current=document.activeElement as HTMLElement;
  const old=document.body.style.overflow;document.body.style.overflow="hidden";
  root.current?.focus();
  const onKey=(e:KeyboardEvent)=>{
   if(e.key==="Escape"){e.preventDefault();close()}
   if(e.key==="ArrowRight"){e.preventDefault();setPage(p=>Math.min(8,p+1))}
   if(e.key==="ArrowLeft"){e.preventDefault();setPage(p=>Math.max(0,p-1))}
   if(e.key==="Tab"){
    const focusable=Array.from(root.current?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href]')||[]);
    if(!focusable.length)return;
    const first=focusable[0],end=focusable[focusable.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();end.focus()}
    else if(!e.shiftKey&&document.activeElement===end){e.preventDefault();first.focus()}
   }
  };
  document.addEventListener("keydown",onKey);
  return()=>{document.removeEventListener("keydown",onKey);document.body.style.overflow=old};
 },[open]);
 useEffect(()=>{
  if(!open||paused||last||window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  const timeout=window.setTimeout(()=>setPage(p=>Math.min(8,p+1)),6000);
  return()=>window.clearTimeout(timeout);
 },[page,paused,open,last]);
 if(!open)return null;
 const slide=slides[page];
 return <div ref={root} className="tt-story" role="dialog" aria-modal="true" aria-label={t.name}
  tabIndex={-1} data-ink={slide.ink} onPointerDown={e=>{startX.current=e.clientX;setPaused(true)}}
  onPointerUp={e=>{const x=startX.current;startX.current=null;setPaused(false);if(x===null||(e.target as HTMLElement).closest("button,a"))return;
   const delta=e.clientX-x;if(Math.abs(delta)>55)setPage(p=>Math.min(8,Math.max(0,p+(delta<0?1:-1))));}}>
   <div className="tt-story-content">
    <div className="tt-story-progress" aria-label={String(page+1)+"/9"}>{slides.map((_,i)=><span key={i} className={i<=page?"done":""}/>)}</div>
    <button type="button" className="tt-story-close" onClick={close} aria-label={t.skip}>× <span>{t.skip}</span></button>
    <div className="tt-story-illustration" aria-hidden="true">
      <span className="tt-story-print-num">{String(page+1).padStart(2,"0")}</span>
      <div className="tt-story-device"><img src={page===0||page===8?"/brand/glyph-burst.svg":page===3?"/brand/glyph-stairs.svg":page===4||page===7?"/brand/glyph-ticket.svg":page===5?"/brand/glyph-arrow.svg":"/brand/glyph-dots.svg"} alt="" /></div>
      <span className="tt-story-stamp">TICKETTREAT</span>
    </div>
    <div className="tt-story-copy"><p>{slide.step}</p><h2>{slide.title}</h2><p>{slide.text}</p></div>
    <nav className="tt-story-nav" aria-label={t.name}>
      <button type="button" disabled={page===0} onClick={()=>setPage(p=>Math.max(0,p-1))}>{t.back}</button>
      {last?<><button type="button" onClick={()=>setPage(0)}>{t.again}</button><button type="button" className="tt-story-primary" onClick={()=>{close();document.getElementById("events")?.scrollIntoView({behavior:"smooth"})}}>{t.finish}</button></>:
       <button type="button" className="tt-story-primary" onClick={()=>setPage(p=>Math.min(8,p+1))}>{t.next} →</button>}
    </nav>
   </div>
 </div>;
}
