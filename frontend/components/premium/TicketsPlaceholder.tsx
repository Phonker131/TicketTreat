"use client";
import {useEffect,useState,type KeyboardEvent} from "react";
import Link from "next/link";
import useEmblaCarousel from "embla-carousel-react";
import {useMotionValue,useReducedMotion,useSpring,useTransform} from "motion/react";
import * as M from "motion/react-m";
import {BrandIcon} from "@/components/BrandIcon";
import {Qr} from "@/components/premium/Qr";
import {premium} from "@/components/premium/copy";
import type {LanguageCode} from "@/lib/types";

const samples=[
 {color:"tom",days:5,h:19,date:{ru:"14 ноя",en:"14 Nov",cs:"14. 11.",uk:"14 лис"},place:"Cafe Louvre, Praha 1",name:{ru:"Speed Dating",en:"Speed Dating",cs:"Speed Dating",uk:"Speed Dating"}},
 {color:"blu",days:12,h:19,date:{ru:"21 ноя",en:"21 Nov",cs:"21. 11.",uk:"21 лис"},place:"Bar Hemingway, Praha 2",name:{ru:"Квиз-ночь",en:"Quiz Night",cs:"Kvízový večer",uk:"Квіз-ніч"}},
 {color:"plum",days:33,h:22,date:{ru:"5 дек",en:"5 Dec",cs:"5. 12.",uk:"5 гру"},place:"Club 7, Praha 1",name:{ru:"Night Pass",en:"Night Pass",cs:"Night Pass",uk:"Night Pass"}}
] as const;

function useCountdown(days:number,hours:number){
 const [left,setLeft]=useState<[string,string,string,string]|null>(null);
 useEffect(()=>{
  const target=Date.now()+days*86400000+hours*3600000+1830000;
  const tick=()=>{
   const d=Math.max(0,target-Date.now()),p=(n:number)=>String(n).padStart(2,"0");
   setLeft([p(Math.floor(d/86400000)),p(Math.floor(d/3600000)%24),p(Math.floor(d/60000)%60),p(Math.floor(d/1000)%60)]);
  };
  tick();const id=window.setInterval(tick,1000);return()=>window.clearInterval(id);
 },[days,hours]);
 return left??["--","--","--","--"];
}

/** One sample ticket with pointer tilt and a Safari-safe, upright front/QR side switch. */
function SampleTicket({index,language,flipped,onToggle,interactive=true}:{index:number;language:LanguageCode;flipped:boolean;onToggle:()=>void;interactive?:boolean}){
 const s=samples[index],c=premium[language],reduce=useReducedMotion();
 const time=useCountdown(s.days,s.h);
 const px=useMotionValue(0),py=useMotionValue(0);
 const spring={stiffness:150,damping:18,mass:.6};
 const rx=useSpring(useTransform(py,[-.5,.5],[7,-7]),spring),ry=useSpring(useTransform(px,[-.5,.5],[-9,9]),spring);
 const foil=useTransform(px,[-.5,.5],["0% 0%","100% 100%"]);
 const name=s.name[language];
 const key=(e:KeyboardEvent)=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onToggle()}};
 return <M.div className={"tp-sample tp-ink-"+s.color+(flipped?" is-flipped":"")} style={reduce?undefined:{rotateX:rx,rotateY:ry}}
   onPointerMove={e=>{if(!interactive||reduce||e.pointerType==="touch")return;const r=e.currentTarget.getBoundingClientRect();px.set((e.clientX-r.left)/r.width-.5);py.set((e.clientY-r.top)/r.height-.5)}}
   onPointerLeave={()=>{px.set(0);py.set(0)}}>
  <div className="tp-flip" role="button" tabIndex={0} aria-pressed={flipped} aria-label={name+", "+c.tickets.count+", "+(flipped?c.tickets.back:c.tickets.flip)} onClick={onToggle} onKeyDown={key}>
   <article className="tp-face tp-face-front">
    <div className="tp-ticket tp-ticket-sample">
     <header><small>TICKETTREAT</small><small>TT-0000-XXXXXX</small></header>
     <h5>{name}</h5>
     <p>{s.date[language]}, 19:00</p><p className="tp-ticket-venue">{s.place}</p>
     <i className="tp-ticket-perf" aria-hidden="true"/>
     <div className="tp-count">{time.map((n,i)=><span key={i}><b>{n}</b><small>{c.ticket.countdown[i]}</small></span>)}</div>
     <M.i className="tp-foil" style={{backgroundPosition:foil}} aria-hidden="true"/>
    </div>
   </article>
   <article className="tp-face tp-face-back">
    <div className="tp-ticket tp-ticket-back tp-ticket-sample">
     <header><small>TICKETTREAT</small><small>TT-0000-XXXXXX</small></header>
     <h5>{name}</h5>
     <div className="tp-qr"><Qr size={176}/></div>
     <p className="tp-door">{c.tickets.note}</p>
     <i className="tp-barcode" aria-hidden="true"/>
    </div>
   </article>
  </div>
  <span className="tp-stamp">{c.example}</span>
 </M.div>;
}

export function TicketsPlaceholder({language}:{language:LanguageCode}){
 const c=premium[language].tickets,reduce=useReducedMotion();
 const [order,setOrder]=useState([0,1,2]); // last item is on top of the stack
 const [flip,setFlip]=useState<Record<number,boolean>>({});
 const [emblaRef,embla]=useEmblaCarousel({align:"center",containScroll:false,dragFree:false,skipSnaps:false});
 const [snap,setSnap]=useState(0);
 useEffect(()=>{
  if(!embla)return;
  const sync=()=>setSnap(embla.selectedScrollSnap());
  sync();embla.on("select",sync).on("reInit",sync);
  return()=>{embla.off("select",sync).off("reInit",sync)};
 },[embla]);
 const top=order[order.length-1];
 const toggleTop=(i:number)=>{
  if(i!==top){setOrder(o=>[...o.filter(x=>x!==i),i]);return}
  setFlip(f=>({...f,[i]:!f[i]}));
 };
 const slots=[{x:0,y:0,r:0,s:1},{x:-186,y:30,r:-8,s:.86},{x:186,y:30,r:8,s:.86}];
 const icons:("scan"|"clock"|"chk")[]=["scan","clock","chk"];
 return <section className="tp-tickets-empty" aria-labelledby="tp-tickets-title">
  <div className="tp-te-copy">
   <div className="tp-te-summary">
    <h2 id="tp-tickets-title">{c.title}</h2>
    <p className="tp-te-intro">{c.intro}</p>
   </div>
   <div className="tp-te-details">
    <ul className="tp-te-points">{c.points.map((p,i)=><li key={p}><i><BrandIcon name={icons[i]} size={20}/></i>{p}</li>)}</ul>
    <div className="tp-te-actions"><Link href="/" className="button button-primary">{c.find}</Link></div>
    <p className="tp-te-note">{c.note}</p>
   </div>
  </div>
  <div className="tp-te-stage">
   <div className="tp-wallet" aria-label={c.title}>
    {samples.map((_,i)=>{
     const rank=order.length-1-order.indexOf(i);   // 0 = top
     const p=slots[rank];
     return <M.div key={i} className="tp-wallet-item" style={{zIndex:10-rank}} initial={false}
       animate={reduce?{x:p.x,y:p.y,rotate:p.r,scale:p.s}:{x:p.x,y:p.y,rotate:p.r,scale:p.s}}
       transition={reduce?{duration:0}:{type:"spring",stiffness:230,damping:26}}>
      <SampleTicket index={i} language={language} flipped={!!flip[i]} onToggle={()=>toggleTop(i)} interactive={rank===0}/>
     </M.div>;
    })}
   </div>
   <div className="tp-wallet-mobile">
    <div className="tp-embla" ref={emblaRef}><div className="tp-embla-track">
     {samples.map((_,i)=><div className="tp-embla-slide" key={i}><SampleTicket index={i} language={language} flipped={!!flip[i]} onToggle={()=>setFlip(f=>({...f,[i]:!f[i]}))} interactive={false}/></div>)}
    </div></div>
    <div className="tp-dots" role="tablist" aria-label={c.title}>{samples.map((_,i)=><button key={i} type="button" role="tab" aria-selected={snap===i} aria-label={String(i+1)} className={snap===i?"is-on":""} onClick={()=>embla?.scrollTo(i)}/>)}</div>
   </div>
  </div>
 </section>;
}
