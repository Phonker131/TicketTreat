"use client";
import {useEffect,useRef,useState,type PointerEvent} from "react";
import Link from "next/link";
import {useMotionValue,useMotionValueEvent,useReducedMotion,useScroll,useSpring,useTransform,type MotionValue} from "motion/react";
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

const BACK={
 en:{show:"Show this QR at the door",open:"Open the event",flip:"Turn the ticket",date:"Date",time:"Time",price:"Price",entry:"Entry"},
 cs:{show:"U vstupu ukaž tento QR",open:"Otevřít akci",flip:"Otočit vstupenku",date:"Datum",time:"Čas",price:"Cena",entry:"Vstup"},
 ru:{show:"Покажи этот QR на входе",open:"Открыть ивент",flip:"Перевернуть билет",date:"Дата",time:"Время",price:"Цена",entry:"Вход"},
 uk:{show:"Покажи цей QR на вході",open:"Відкрити подію",flip:"Перевернути квиток",date:"Дата",time:"Час",price:"Ціна",entry:"Вхід"},
} as const;

/** The hero ticket: a bright gradient front (after a boarding-pass poster) and a paper back with the QR.
 *  It turns over as the page scrolls on, and on a tap. */
function Ticket({event,language,rx,ry,shine,turned,onTurn}:{event:TicketTreatEvent|null;language:LanguageCode;rx:MotionValue<number>;ry:MotionValue<number>;shine:MotionValue<string>;turned:boolean;onTurn:()=>void}){
 const c=COPY[language],k=BACK[language];
 const d=event?dateParts(event.starts_at,language):null;
 const code=event?`TT-${String(event.id).padStart(4,"0")}`:"TT-0000";
 const no=event?String(event.id).padStart(6,"0"):"000000";
 return <M.div className="tt-tk3" style={{rotateX:rx,rotateY:ry}}>
  <div className="tt-tk3-face is-front" aria-hidden={turned||undefined}>
   <div className="tt-tk3-top">
    <span className="tt-tk3-brand">TICKETTREAT</span>
    <span className="tt-tk3-vbar" aria-hidden="true"><i/><small>{no}</small></span>
   </div>
   <span className="tt-tk3-no">#{no}</span>
   <strong className="tt-tk3-title">{event?event.title:c.soon}</strong>
   <span className="tt-tk3-rule"><b>{d?new Date().getFullYear():""}</b></span>
   <span className="tt-tk3-sub">{event?(event.location||"Praha"):c.soonText}</span>
   <dl className="tt-tk3-fields">
    <div><dt>{k.date}</dt><dd>{d?`${d.day} ${d.month}`:"-"}</dd></div>
    <div><dt>{k.time}</dt><dd>{d?d.time:"-"}</dd></div>
    <div><dt>{k.price}</dt><dd>{event?formatPrice(event,language):"-"}</dd></div>
    <div><dt>{k.entry}</dt><dd>{c.admit}</dd></div>
   </dl>
   <span className="tt-tk3-perf" aria-hidden="true"/>
   <span className="tt-tk3-hbar" aria-hidden="true"/>
   <M.span className="tt-tk-shine" style={{backgroundPosition:shine}} aria-hidden="true"/>
  </div>
  <div className="tt-tk3-face is-back" aria-hidden={!turned||undefined}>
   <span className="tt-tk3-brand">TICKETTREAT</span>
   <div className="tt-tk3-qr">
    <Qr value={"https://tickettreat.eu/events/"+(event?.id??"")} size={200} className="tt-tk3-qrsvg"/>
    <span className="tt-tk3-scan" aria-hidden="true"/>
   </div>
   <strong className="tt-tk3-code">{code}</strong>
   <span className="tt-tk3-show">{k.show}</span>
   {event&&<Link href={`/events/${event.id}`} className="tt-tk3-open">{k.open}</Link>}
  </div>
  <button type="button" className="tt-tk3-turn" onClick={onTurn} aria-pressed={turned} aria-label={k.flip}/>
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
 // The header waits until the ticket is fully up (desktop only, see polish-v3.css).
 useEffect(()=>{const root=document.documentElement;root.dataset.hero=still?"open":"closed";return()=>{delete root.dataset.hero;};},[still]);
 useMotionValueEvent(scrollYProgress,"change",v=>{if(!still)document.documentElement.dataset.hero=v>=.62?"open":"closed";});
 // The ticket turns towards the pointer, like the tiger's eyes following it.
 const px=useMotionValue(0),py=useMotionValue(0);
 const rx=useSpring(useTransform(py,[-.5,.5],[9,-9]),{stiffness:160,damping:18});
 const ry=useSpring(useTransform(px,[-.5,.5],[-12,12]),{stiffness:160,damping:18});
 const shine=useTransform(px,[-.5,.5],["0% 0%","100% 0%"]);
 const [tapped,setTapped]=useState(false);
 // Once the ticket is fully up it turns over by itself once to show the QR; after that every tap turns it.
 const tapTurn=useSpring(0,{stiffness:110,damping:15});
 useEffect(()=>{tapTurn.set(tapped?180:0)},[tapped,tapTurn]);
 const turnY=useTransform(()=>ry.get()+tapTurn.get());
 const turned=tapped;
 const shown=useRef(false);
 useMotionValueEvent(scrollYProgress,"change",v=>{
  if(v>=.66&&!shown.current){shown.current=true;window.setTimeout(()=>setTapped(true),450);}
  if(v<.2&&shown.current){shown.current=false;setTapped(false);}
 });
 const stillTurn=useSpring(0,{stiffness:120,damping:16});
 useEffect(()=>{stillTurn.set(tapped?180:0)},[tapped,stillTurn]);
 const move=(e:PointerEvent<HTMLDivElement>)=>{if(reduce||e.pointerType!=="mouse")return;const r=e.currentTarget.getBoundingClientRect();
  px.set((e.clientX-r.left)/r.width-.5);py.set((e.clientY-r.top)/r.height-.5);};
 const leave=()=>{px.set(0);py.set(0);};
 const actions=<div className="tt-tear-actions">
  <a className="button button-primary tt-island" href="#events">{c.all}<span className="tt-island-dot" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 12h8M8 15h5"/></svg></span></a>
  <button type="button" className="button button-secondary" disabled={!storyReady} onClick={()=>window.dispatchEvent(new Event("tickettreat-open-story"))}>{c.how}</button>
 </div>;

 if(still){
  return <section ref={ref} className="tt-night-hero tt-tear is-still" aria-labelledby="tt-night-title">
   <div className="tt-tear-stage">
    <WaveShader className="tt-tear-bg"/>
    <div className="tt-tear-still-copy"><p className="tt-tear-line">{c.line}</p><h1 id="tt-night-title" className="tt-tear-word">{c.word}</h1></div>
    <div className="tt-tear-ticket-wrap"><Ticket event={event} language={language} rx={rx} ry={stillTurn} shine={shine} turned={tapped} onTurn={()=>setTapped(v=>!v)}/></div>
    {actions}
   </div>
  </section>;
 }
 return <section ref={ref} className="tt-night-hero tt-tear" aria-labelledby="tt-night-title">
  <div className="tt-tear-stage" onPointerMove={move} onPointerLeave={leave}>
   <WaveShader className="tt-tear-bg"/>
   <M.div className="tt-tear-ticket-wrap" style={{y:ty,scale:ts,opacity:to}}>
    <Ticket event={event} language={language} rx={rx} ry={turnY} shine={shine} turned={turned} onTurn={()=>setTapped(v=>!v)}/>
   </M.div>
   <M.div className="tt-tear-actions-wrap" style={{opacity:co,y:cy}}>{actions}</M.div>
   <M.div className="tt-tear-half is-left" style={{x:lx,rotate:lr,clipPath:LEFT}}><Sheet line={c.line} word={c.word}/></M.div>
   <M.div className="tt-tear-half is-right" style={{x:rxs,rotate:rr,clipPath:RIGHT}}><Sheet line={c.line} word={c.word} hidden/></M.div>
  </div>
 </section>;
}
