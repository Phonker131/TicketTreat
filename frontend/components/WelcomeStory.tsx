"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {AnimatePresence,useReducedMotion} from "motion/react";
import * as M from "motion/react-m";
import {PhoneFrame} from "@/components/premium/Device";
import {PhoneScreen} from "@/components/premium/Screens";
import {BrandIcon} from "@/components/BrandIcon";
import {premium} from "@/components/premium/copy";
import type {LanguageCode} from "@/lib/types";

const KEY="tt4-story";
const GLOW=["blu","yel","tom"] as const;

/** Three-slide welcome tour for guests: find, reserve, arrive. It explains what TicketTreat gives a guest, not an organizer. */
export function WelcomeStory({language}:{language:LanguageCode}){
 const c=premium[language].tour,slides=c.slides;
 const reduce=useReducedMotion();
 const [open,setOpen]=useState(false),[[page,dir],setState]=useState<[number,number]>([0,1]);
 const root=useRef<HTMLDivElement>(null),previous=useRef<HTMLElement|null>(null);
 const last=page===slides.length-1;
 const go=useCallback((d:number)=>setState(([p])=>{const n=Math.min(slides.length-1,Math.max(0,p+d));return [n,d===0?1:d]}),[slides.length]);

 useEffect(()=>{
  const params=new URLSearchParams(location.search);
  const show=()=>{setState([0,1]);setOpen(true)};
  window.addEventListener("tickettreat-open-story",show);
  if(!params.has("nostory")){
   let seen=false;try{seen=localStorage.getItem(KEY)==="1"}catch{}
   if(params.has("story")||!seen)setOpen(true);
  }
  return()=>window.removeEventListener("tickettreat-open-story",show);
 },[]);

 const close=useCallback(()=>{
  try{localStorage.setItem(KEY,"1")}catch{}
  setOpen(false);
  previous.current?.focus();
 },[]);

 useEffect(()=>{
  if(!open)return;
  previous.current=document.activeElement as HTMLElement;
  const old=document.body.style.overflow;document.body.style.overflow="hidden";
  root.current?.focus();
  const onKey=(e:KeyboardEvent)=>{
   if(e.key==="Escape"){e.preventDefault();close()}
   if(e.key==="ArrowRight"){e.preventDefault();go(1)}
   if(e.key==="ArrowLeft"){e.preventDefault();go(-1)}
   if(e.key==="Tab"){
    const focusable=Array.from(root.current?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href]')||[]);
    if(!focusable.length)return;
    const first=focusable[0],end=focusable[focusable.length-1];
    if(e.shiftKey&&(document.activeElement===first||document.activeElement===root.current)){e.preventDefault();end.focus()}
    else if(!e.shiftKey&&document.activeElement===end){e.preventDefault();first.focus()}
   }
  };
  document.addEventListener("keydown",onKey);
  return()=>{document.removeEventListener("keydown",onKey);document.body.style.overflow=old};
 },[open,close,go]);

 if(!open)return null;
 const slide=slides[page];
 const move=reduce?0:1;
 const spring={type:"spring" as const,stiffness:210,damping:26,mass:.9};
 return <div ref={root} className="tp-tour" role="dialog" aria-modal="true" aria-label={c.name} tabIndex={-1} data-i={page}>
  <div className="tp-tour-top">
   <div className="tp-tour-bars" aria-hidden="true">{slides.map((_,i)=><i key={i}><b style={{width:i<=page?"100%":"0%"}}/></i>)}</div>
   <button type="button" className="tp-tour-skip" onClick={close}><span>{c.skip}</span><BrandIcon name="cross" size={16}/></button>
  </div>
  <M.div className="tp-tour-main" drag={reduce?false:"x"} dragConstraints={{left:0,right:0}} dragElastic={.22} dragDirectionLock
    onDragEnd={(_,info)=>{if(info.offset.x<-70||info.velocity.x<-420)go(1);else if(info.offset.x>70||info.velocity.x>420)go(-1)}}>
   <AnimatePresence mode="wait" initial={false} custom={dir}>
    <M.div key={"v"+page} className="tp-tour-visual" custom={dir}
      initial={{opacity:0,y:34*move,rotate:dir*2.5*move,scale:.96}} animate={{opacity:1,y:0,rotate:0,scale:1}}
      exit={{opacity:0,y:-18*move,scale:.97,transition:{duration:.18}}} transition={spring}>
     <div className={"tp-tour-duo"+(page===2?" is-duo":"")}>
      {page===2&&<PhoneFrame glow="yel" className="tp-tour-back" tilt={false}><PhoneScreen kind="passport" language={language}/></PhoneFrame>}
      <PhoneFrame glow={GLOW[page]} className="tp-tour-phone"><PhoneScreen kind={page===0?"discover":page===1?"reserve":"qr"} language={language}/></PhoneFrame>
     </div>
    </M.div>
   </AnimatePresence>
   <AnimatePresence mode="wait" initial={false} custom={dir}>
    <M.div key={"t"+page} className="tp-tour-copy" aria-live="polite"
      initial={{opacity:0,x:40*dir*move}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-30*dir*move,transition:{duration:.16}}} transition={{...spring,delay:.04}}>
     <p className="tp-tour-kicker"><b>{String(page+1).padStart(2,"0")}</b> / 03 · {slide.kicker}</p>
     <h2>{slide.title}</h2>
     <p className="tp-tour-text">{slide.text}</p>
     <ul className="tp-tour-chips">{slide.chips.map(x=><li key={x}>{x}</li>)}</ul>
    </M.div>
   </AnimatePresence>
  </M.div>
  <nav className="tp-tour-nav" aria-label={c.name}>
   <button type="button" className="tp-tour-back-btn" disabled={page===0} onClick={()=>go(-1)}><BrandIcon name="back" size={20}/><span>{c.back}</span></button>
   <span className="tp-tour-step">{c.steps} {page+1}/{slides.length}</span>
   {last
    ?<button type="button" className="tp-tour-next is-final" onClick={()=>{close();document.getElementById("events")?.scrollIntoView({behavior:reduce?"auto":"smooth"})}}>{c.start}<BrandIcon name="arr" size={20}/></button>
    :<button type="button" className="tp-tour-next" onClick={()=>go(1)}>{c.next}<BrandIcon name="arr" size={20}/></button>}
  </nav>
 </div>;
}
