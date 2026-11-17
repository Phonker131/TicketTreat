"use client";
import {useEffect,useRef,useState,type PointerEvent} from "react";
import Link from "next/link";
import {useMotionValue,useReducedMotion,useScroll,useSpring,useTransform,type MotionValue} from "motion/react";
import * as M from "motion/react-m";
import {WaveShader} from "@/components/premium/WaveShader";
import {Qr} from "@/components/premium/Qr";
import {dateParts} from "@/components/premium/EventLists";
import {formatPrice} from "@/lib/format";
import type {LanguageCode,TicketTreatEvent} from "@/lib/types";

const COPY={
 en:{line:"Game nights, quizzes and workshops in Prague",word:"TONIGHT",admit:"Admit one",book:"Book a spot",all:"All events",how:"How it works",soon:"Your next night out",soonText:"New events are coming soon."},
 cs:{line:"Herní večery, kvízy a workshopy v Praze",word:"DNES",admit:"Vstup pro 1",book:"Rezervovat",all:"Všechny akce",how:"Jak to funguje",soon:"Tvůj další večer",soonText:"Nové akce brzy přibudou."},
 ru:{line:"Игровые вечера, квизы и мастер-классы в Праге",word:"СЕГОДНЯ",admit:"Вход на 1",book:"Записаться",all:"Все ивенты",how:"Как это работает",soon:"Твой следующий вечер",soonText:"Новые ивенты скоро появятся."},
 uk:{line:"Ігрові вечори, квізи та майстер-класи у Празі",word:"СЬОГОДНІ",admit:"Вхід на 1",book:"Забронювати",all:"Усі події",how:"Як це працює",soon:"Твій наступний вечір",soonText:"Нові події незабаром."},
} as const;

/* A jagged vertical tear through the middle of the sheet, the same line for both halves. */
const TEAR=[[50,0],[48.6,6],[51.4,11],[49.2,17],[51.8,23],[48.4,29],[50.9,35],[49.1,41],[52.2,47],[48.8,53],[51.3,59],[49.4,65],[52,71],[48.5,77],[51.1,83],[49.3,89],[51.6,95],[50,100]];
const LEFT=`polygon(0 0, ${TEAR.map(([x,y])=>`${x}% ${y}%`).join(", ")}, 0 100%)`;
const RIGHT=`polygon(100% 0, ${TEAR.map(([x,y])=>`${x}% ${y}%`).join(", ")}, 100% 100%)`;

function Sheet({line,word,hidden}:{line:string;word:string;hidden?:boolean}){
 return <div className="tt-tear-sheet-inner" aria-hidden={hidden||undefined}>
  <span className="tt-tear-notch is-top"/><span className="tt-tear-notch is-bottom"/><span className="tt-tear-perf"/>
  <p className="tt-tear-line">{line}</p>
  {hidden?<p className="tt-tear-word">{word}</p>:<h1 id="tt-night-title" className="tt-tear-word">{word}</h1>}
 </div>;
}

function Ticket({event,language,rx,ry,shine}:{event:TicketTreatEvent|null;language:LanguageCode;rx:MotionValue<number>;ry:MotionValue<number>;shine:MotionValue<string>}){
 const c=COPY[language];
 const d=event?dateParts(event.starts_at,language):null;
 const code=event?`TT-${String(event.id).padStart(4,"0")}`:"TT-0000";
 const body=<>
  <div className="tt-tk-main">
   <span className="tt-tk-admit">{c.admit}</span>
   <strong className="tt-tk-title">{event?event.title:c.soon}</strong>
   {event?<span className="tt-tk-meta">{[d&&`${d.weekday} ${d.day} ${d.month}, ${d.time}`,event.location].filter(Boolean).join(", ")}</span>
    :<span className="tt-tk-meta">{c.soonText}</span>}
   {event&&<span className="tt-tk-price">{formatPrice(event,language)}</span>}
  </div>
  <div className="tt-tk-stub">
   <Qr value={"https://tickettreat.eu/events/"+(event?.id??"")} size={96} className="tt-tk-qr"/>
   <span className="tt-tk-code">{code}</span>
  </div>
  <M.span className="tt-tk-shine" style={{backgroundPosition:shine}} aria-hidden="true"/>
 </>;
 return <M.div className="tt-tk" style={{rotateX:rx,rotateY:ry}}>
  {event?<Link href={`/events/${event.id}`} className="tt-tk-card" aria-label={`${c.book}: ${event.title}`}>{body}</Link>:<div className="tt-tk-card">{body}</div>}
 </M.div>;
}

/** Home hero after the tiger tear reveal: a paper poster tears along its perforation on scroll,
 *  the halves pull apart and a ticket for the next event rises from the glowing night behind. */
export function TicketTearHero({event,language,storyReady}:{event:TicketTreatEvent|null;language:LanguageCode;storyReady:boolean}){
 const c=COPY[language];
 const ref=useRef<HTMLElement>(null);
 const reduce=useReducedMotion();
 // Server and first client render are the same; the still version switches in after mount.
 const [still,setStill]=useState(false);
 useEffect(()=>setStill(!!reduce),[reduce]);
 const {scrollYProgress}=useScroll({target:ref,offset:["start start","end end"]});
 const p=useSpring(scrollYProgress,{stiffness:140,damping:26,mass:.4});
 const lx=useTransform(p,[.04,.5],["0%","-88%"]),rxs=useTransform(p,[.04,.5],["0%","88%"]);
 const lr=useTransform(p,[.04,.5],[0,-6]),rr=useTransform(p,[.04,.5],[0,6]);
 const ty=useTransform(p,[.18,.62],["38%","0%"]),ts=useTransform(p,[.18,.62],[.82,1]),to=useTransform(p,[.14,.4],[0,1]);
 const co=useTransform(p,[.6,.8],[0,1]),cy=useTransform(p,[.6,.8],[16,0]);
 // The ticket turns towards the pointer, like the tiger's eyes following it.
 const px=useMotionValue(0),py=useMotionValue(0);
 const rx=useSpring(useTransform(py,[-.5,.5],[9,-9]),{stiffness:160,damping:18});
 const ry=useSpring(useTransform(px,[-.5,.5],[-12,12]),{stiffness:160,damping:18});
 const shine=useTransform(px,[-.5,.5],["0% 0%","100% 0%"]);
 const move=(e:PointerEvent<HTMLDivElement>)=>{if(reduce||e.pointerType!=="mouse")return;const r=e.currentTarget.getBoundingClientRect();
  px.set((e.clientX-r.left)/r.width-.5);py.set((e.clientY-r.top)/r.height-.5);};
 const leave=()=>{px.set(0);py.set(0);};
 const actions=<div className="tt-tear-actions">
  <a className="button button-primary" href="#events">{c.all}</a>
  <button type="button" className="button button-secondary" disabled={!storyReady} onClick={()=>window.dispatchEvent(new Event("tickettreat-open-story"))}>{c.how}</button>
 </div>;

 if(still){
  return <section ref={ref} className="tt-night-hero tt-tear is-still" aria-labelledby="tt-night-title">
   <div className="tt-tear-stage">
    <WaveShader className="tt-tear-bg"/>
    <div className="tt-tear-still-copy"><p className="tt-tear-line">{c.line}</p><h1 id="tt-night-title" className="tt-tear-word">{c.word}</h1></div>
    <div className="tt-tear-ticket-wrap"><Ticket event={event} language={language} rx={rx} ry={ry} shine={shine}/></div>
    {actions}
   </div>
  </section>;
 }
 return <section ref={ref} className="tt-night-hero tt-tear" aria-labelledby="tt-night-title">
  <div className="tt-tear-stage" onPointerMove={move} onPointerLeave={leave}>
   <WaveShader className="tt-tear-bg"/>
   <M.div className="tt-tear-ticket-wrap" style={{y:ty,scale:ts,opacity:to}}>
    <Ticket event={event} language={language} rx={rx} ry={ry} shine={shine}/>
   </M.div>
   <M.div className="tt-tear-actions-wrap" style={{opacity:co,y:cy}}>{actions}</M.div>
   <M.div className="tt-tear-half is-left" style={{x:lx,rotate:lr,clipPath:LEFT}}><Sheet line={c.line} word={c.word}/></M.div>
   <M.div className="tt-tear-half is-right" style={{x:rxs,rotate:rr,clipPath:RIGHT}}><Sheet line={c.line} word={c.word} hidden/></M.div>
  </div>
 </section>;
}
