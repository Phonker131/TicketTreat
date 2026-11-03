"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import useEmblaCarousel from "embla-carousel-react";
import {AnimatePresence,useReducedMotion} from "motion/react";
import * as M from "motion/react-m";
import {PhoneFrame} from "@/components/premium/Device";
import {PhoneScreen} from "@/components/premium/Screens";
import {BrandIcon} from "@/components/BrandIcon";
import {premium} from "@/components/premium/copy";
import type {LanguageCode} from "@/lib/types";

const labels={
 ru:{how:"От ссылки до входа: три шага",howSub:"Без лишней переписки. Ваш билет хранится в TicketTreat.",ticket:"Билет, который хочется показать",ticketSub:"Нажмите на настоящий билет в «Моих билетах», чтобы увидеть QR.",levels:"Чаще приходите: больше открывается",levelsSub:"Визит засчитывается после подтверждённого check-in.",steps:["Выберите ивент","Запишитесь","Покажите QR"],details:["Найдите событие в свайпе или ленте.","Бесплатно: билет сразу. Платно: дождитесь подтверждения организатора.","Откройте билет и покажите QR на входе."],open:"Открыть мои билеты",passport:"Посмотреть награды",flipFront:"Показать QR",flipBack:"К билету",sample:"Пример"},
 cs:{how:"Od odkazu ke vstupu: tři kroky",howSub:"Bez zbytečných zpráv. Vaše vstupenka je v TicketTreat.",ticket:"Vstupenka, kterou chcete ukázat",ticketSub:"Otevřete skutečnou vstupenku v Moje vstupenky a zobrazte QR.",levels:"Více návštěv, další možnosti",levelsSub:"Návštěva se započítá až po skutečném odbavení.",steps:["Vyberte akci","Zarezervujte si místo","Ukažte QR"],details:["Najděte akci mezi kartami nebo v seznamu.","Zdarma: vstupenka ihned. Placené: čekejte na potvrzení pořadatele.","Otevřete vstupenku a u vstupu ukažte QR."],open:"Moje vstupenky",passport:"Otevřít odměny",flipFront:"Ukázat QR",flipBack:"Zpět na vstupenku",sample:"Příklad"},
 uk:{how:"Від посилання до входу: три кроки",howSub:"Без зайвих повідомлень. Квиток зберігається в TicketTreat.",ticket:"Квиток, який хочеться показати",ticketSub:"Відкрийте справжній квиток у «Моїх квитках», щоб побачити QR.",levels:"Більше відвідувань, більше можливостей",levelsSub:"Візит зараховується після справжнього check-in.",steps:["Оберіть подію","Забронюйте місце","Покажіть QR"],details:["Знайдіть подію у свайпі або стрічці.","Безкоштовно: квиток одразу. Платно: дочекайтесь підтвердження організатора.","Відкрийте квиток і покажіть QR на вході."],open:"Мої квитки",passport:"Переглянути нагороди",flipFront:"Показати QR",flipBack:"До квитка",sample:"Приклад"},
 en:{how:"From link to entry in three steps",howSub:"No long message threads. Your ticket stays in TicketTreat.",ticket:"A ticket worth showing",ticketSub:"Open an actual ticket in My tickets to display its QR.",levels:"More visits, more possibilities",levelsSub:"A visit counts only after a real check-in.",steps:["Choose an event","Reserve a spot","Show your QR"],details:["Find an event in the swipe deck or the feed.","Free: instant ticket. Paid: wait for organizer confirmation.","Open your ticket and show its QR at the door."],open:"Open my tickets",passport:"Explore rewards",flipFront:"Show QR",flipBack:"Back to ticket",sample:"Example"}
} as const;
const kinds=["discover","reserve","ticket"] as const;
const glows=["tom","yel","blu"] as const;
const glyphs=["plus","asterisk","burst","wave"] as const;
const lvlNames:Record<LanguageCode,string[]>={ru:["Новичок","Свой","Инсайдер","VIP"],en:["Newcomer","Regular","Insider","VIP"],cs:["Nováček","Stálý host","Insider","VIP"],uk:["Новачок","Свій","Інсайдер","VIP"]};
const thresholds=[0,3,6,12];

function StepCard({i,language,t}:{i:number;language:LanguageCode;t:(typeof labels)[LanguageCode]}){
 return <article className="tp-step">
  <PhoneFrame glow={glows[i]} className="tp-step-phone"><PhoneScreen kind={kinds[i]} language={language}/></PhoneFrame>
  <div className="tp-step-copy"><b>{String(i+1).padStart(2,"0")}</b><h3>{t.steps[i]}</h3><p>{t.details[i]}</p></div>
 </article>;
}

export function GuidedSections({language}:{language:LanguageCode}){
 const t=labels[language],c=premium[language].rewards,reduce=useReducedMotion();
 const [back,setBack]=useState(false),[active,setActive]=useState(0),[hold,setHold]=useState(false);
 useEffect(()=>{
  if(hold||reduce)return;
  const id=window.setInterval(()=>setActive(a=>(a+1)%3),5200);
  return()=>window.clearInterval(id);
 },[hold,reduce,active]);
 const [ref,embla]=useEmblaCarousel({align:"center",containScroll:false});
 const [snap,setSnap]=useState(0);
 const [lref,lembla]=useEmblaCarousel({align:"start",containScroll:"trimSnaps",dragFree:true});
 useEffect(()=>{
  if(!embla)return;
  const s=()=>setSnap(embla.selectedScrollSnap());s();embla.on("select",s).on("reInit",s);
  return()=>{embla.off("select",s).off("reInit",s)};
 },[embla]);
 useEffect(()=>{lembla?.reInit()},[lembla]);
 const reveal=(i=0)=>reduce?{}:{initial:{opacity:0,y:30},whileInView:{opacity:1,y:0},viewport:{once:true,margin:"-60px"},transition:{type:"spring" as const,stiffness:190,damping:24,delay:i*.08}};
 const spring={type:"spring" as const,stiffness:200,damping:24};
 return <>
  <section className="tt-v12-screen tt-v12-how tp-how" id="how" aria-labelledby="tt-how-title">
   <div className="tt-v12-screen-content">
    <div className="tt-v12-intro"><span>02 / HOW</span><h2 id="tt-how-title">{t.how}</h2><p>{t.howSub}</p></div>
    <ol className="tp-how-list" onMouseEnter={()=>setHold(true)} onMouseLeave={()=>setHold(false)} onFocus={()=>setHold(true)} onBlur={()=>setHold(false)}>
     {kinds.map((_,i)=><li key={i}><button type="button" className={active===i?"is-on":""} aria-pressed={active===i} onClick={()=>setActive(i)}>
       <b>{String(i+1).padStart(2,"0")}</b><span><strong>{t.steps[i]}</strong><small>{t.details[i]}</small></span><i className="tp-how-bar" aria-hidden="true"/></button></li>)}
    </ol>
    <div className="tp-how-phone" aria-hidden="true">
     <AnimatePresence mode="wait" initial={false}>
      <M.div key={active} initial={reduce?false:{opacity:0,y:30,scale:.97}} animate={{opacity:1,y:0,scale:1}} exit={reduce?undefined:{opacity:0,y:-16,scale:.98,transition:{duration:.16}}} transition={spring}>
       <PhoneFrame glow={glows[active]} className="tp-how-frame"><PhoneScreen kind={kinds[active]} language={language}/></PhoneFrame>
      </M.div>
     </AnimatePresence>
    </div>
    <div className="tp-steps-mobile">
     <div className="tp-embla" ref={ref}><div className="tp-embla-track">{kinds.map((_,i)=><div className="tp-embla-slide tp-embla-step" key={i}><StepCard i={i} language={language} t={t}/></div>)}</div></div>
     <div className="tp-dots" role="tablist" aria-label={t.how}>{kinds.map((_,i)=><button key={i} type="button" role="tab" aria-selected={snap===i} aria-label={t.steps[i]} className={snap===i?"is-on":""} onClick={()=>embla?.scrollTo(i)}/>)}</div>
    </div>
   </div>
  </section>

  <section className="tt-v12-screen tt-v12-ticket tp-ticket-sec" id="ticket-preview" aria-labelledby="tt-ticket-preview-title">
   <div className="tt-v12-screen-content tp-ticket-grid">
    <M.div className="tt-v12-intro tp-ticket-copy" {...reveal()}><span>03 / TICKET</span><h2 id="tt-ticket-preview-title">{t.ticket}</h2><p>{t.ticketSub}</p>
     <div className="tp-ticket-actions"><Link href="/tickets" className="button button-primary">{t.open} ↗</Link>
      <button type="button" className="button button-secondary" aria-pressed={back} onClick={()=>setBack(v=>!v)}>{back?t.flipBack:t.flipFront} ↻</button></div>
     <small className="tp-ticket-note">{premium[language].tickets.note}</small>
    </M.div>
    <div className="tp-pair-single" aria-hidden="true">
     <AnimatePresence mode="wait" initial={false}>
      <M.div key={back?"qr":"ticket"} initial={reduce?false:{opacity:0,y:22,scale:.97}} animate={{opacity:1,y:0,scale:1}} exit={reduce?undefined:{opacity:0,y:-14,transition:{duration:.15}}} transition={spring}>
       <PhoneFrame glow={back?"tom":"blu"} tilt={false}><PhoneScreen kind={back?"qr":"ticket"} language={language}/></PhoneFrame>
      </M.div>
     </AnimatePresence>
    </div>
    <div className="tp-ticket-pair">
     <M.div className="tp-pair-item" initial={false} animate={{x:back?118:-70,rotate:back?5:-3,scale:back?.92:1,zIndex:back?1:2}} transition={reduce?{duration:0}:spring}>
      <PhoneFrame glow="blu" className="tp-pair-phone"><PhoneScreen kind="ticket" language={language}/></PhoneFrame></M.div>
     <M.div className="tp-pair-item tp-pair-back" initial={false} animate={{x:back?-70:118,rotate:back?-3:5,scale:back?1:.92,zIndex:back?2:1}} transition={reduce?{duration:0}:spring}>
      <PhoneFrame glow="tom" className="tp-pair-phone"><PhoneScreen kind="qr" language={language}/></PhoneFrame></M.div>
    </div>
   </div>
  </section>

  <section className="tt-v12-screen tt-v12-levels tp-levels" id="levels-preview" aria-labelledby="tt-levels-title">
   <div className="tt-v12-screen-content">
    <div className="tt-v12-intro"><span>04 / REWARDS</span><h2 id="tt-levels-title">{t.levels}</h2><p>{t.levelsSub}</p></div>
    <div className="tp-embla tp-levels-embla" ref={lref}><ol className="tp-levels-track">
     {glyphs.map((g,i)=><M.li key={g} className={"tp-level tp-level-"+i} {...reveal(i)}>
      <span className="tp-level-tag">{t.sample} · LV.{i+1}</span>
      <i className="tp-level-glyph"><img src={"/brand/glyph-"+g+".svg"} alt="" width="64" height="64" loading="lazy"/></i>
      <strong>{lvlNames[language][i]}</strong>
      <small>{i===0?c.perks[0]:c.perks[i]}</small>
      <em>{i===0?"START":thresholds[i]+" "+c.visits}</em>
     </M.li>)}
    </ol></div>
    <Link href="/loyalty" className="button button-primary">{t.passport} <BrandIcon name="arr" size={20}/></Link>
   </div>
  </section>
 </>;
}
