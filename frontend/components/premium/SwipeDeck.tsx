"use client";
import {useEffect,useRef,useState,type KeyboardEvent} from "react";
import {animate,useMotionValue,useReducedMotion,useTransform} from "motion/react";
import * as M from "motion/react-m";
import {BrandIcon} from "@/components/BrandIcon";
import {PosterArt} from "@/components/premium/PosterArt";
import type {TicketTreatEvent} from "@/lib/types";

export type DeckAction="want"|"pass"|"view";
type Labels={want:string;pass:string;view:string;done:string;doneText:string;reset:string;hint:string};

function Poster({event}:{event:TicketTreatEvent}){
 const [failed,setFailed]=useState(false);
 const img=useRef<HTMLImageElement>(null);
 // A photo that failed before hydration never reaches onError, so the fallback is also checked on mount.
 useEffect(()=>{const el=img.current;setFailed(!!el&&el.complete&&el.naturalWidth===0)},[event.image_url]);
 if(!event.image_url||failed)return <PosterArt seed={event.id} className="tp-deck-art"/>;
 // eslint-disable-next-line @next/next/no-img-element
 return <img ref={img} src={event.image_url} alt="" draggable={false} loading="lazy" decoding="async" onError={()=>setFailed(true)}/>;
}

function Face({event,date,price}:{event:TicketTreatEvent;date:string;price:string}){
 return <>
  <div className="tp-deck-img"><Poster event={event}/><span className="tp-datebadge">{date}</span></div>
  <h3>{event.title}</h3>
  <p>{event.location||"Praha"}</p>
  <div className="tp-meta"><b>{price}</b>{event.spots_left!=null&&event.spots_left>0&&<span>{event.spots_left}</span>}</div>
 </>;
}

/** Spring-physics swipe deck: drag right to save, left to pass, up to open. Keys and buttons mirror every gesture. */
export function SwipeDeck({events,index,labels,dateOf,priceOf,onAction,onReset}:{events:TicketTreatEvent[];index:number;labels:Labels;dateOf:(e:TicketTreatEvent)=>string;priceOf:(e:TicketTreatEvent)=>string;onAction:(a:DeckAction)=>void;onReset:()=>void}){
 const reduce=useReducedMotion();
 const x=useMotionValue(0),y=useMotionValue(0);
 const rotate=useTransform(x,[-260,0,260],[-13,0,13]);
 const wantOp=useTransform(x,[24,130],[0,1]),passOp=useTransform(x,[-130,-24],[1,0]),viewOp=useTransform(y,[-120,-30],[1,0]);
 const [busy,setBusy]=useState(false);
 const [burst,setBurst]=useState(0);
 const current=events[index];
 const behind=events.slice(index+1,index+3);

 const fly=async(a:DeckAction)=>{
  if(busy||!current)return;
  setBusy(true);
  if(a==="view"){onAction(a);setBusy(false);return}
  if(a==="want")setBurst(n=>n+1);
  try{navigator.vibrate?.(a==="want"?14:8)}catch{/* haptics are optional */}
  const spring={type:"spring" as const,stiffness:170,damping:22};
  if(reduce){x.set(a==="want"?600:-600)}
  else await Promise.all([animate(x,a==="want"?640:-640,spring),animate(y,a==="want"?-30:20,spring)]);
  onAction(a);x.set(0);y.set(0);setBusy(false);
 };
 const keys=(e:KeyboardEvent)=>{
  if(e.key==="ArrowLeft"){e.preventDefault();void fly("pass")}
  if(e.key==="ArrowRight"){e.preventDefault();void fly("want")}
  if(e.key==="ArrowUp"){e.preventDefault();void fly("view")}
 };

 if(!current){
  return <div className="tp-deck-empty" role="status">
   <PosterArt seed={7} className="tp-deck-empty-art"/>
   <h3>{labels.done}</h3><p>{labels.doneText}</p>
   <button type="button" className="button button-primary" onClick={onReset}>{labels.reset}</button>
  </div>;
 }
 return <div className="tp-deck">
  <p className="tp-deck-hint">{labels.hint}</p>
  <div className="tp-deck-stage">
   {behind.map((e,i)=><div key={e.id} className="tp-deck-card tp-deck-ghost" style={{transform:`translateY(${(i+1)*16}px) scale(${1-(i+1)*.05})`,zIndex:-i-1,opacity:1-(i+1)*.25}} aria-hidden="true">
     <Face event={e} date={dateOf(e)} price={priceOf(e)}/></div>)}
   <M.div key={current.id} className="tp-deck-card" tabIndex={0} role="group" aria-label={current.title+". "+labels.hint}
     style={{x,y,rotate}} drag dragSnapToOrigin dragElastic={.9} dragMomentum={false}
     whileDrag={{scale:1.025,cursor:"grabbing"}} initial={{opacity:0,scale:.94,y:28}} animate={{opacity:1,scale:1}} transition={{type:"spring",stiffness:230,damping:24}}
     onKeyDown={keys}
     onDragEnd={(_,info)=>{
      if(info.offset.y<-90||info.velocity.y<-650){x.set(0);y.set(0);void fly("view")}
      else if(info.offset.x>90||info.velocity.x>650){void fly("want")}
      else if(info.offset.x<-90||info.velocity.x<-650){void fly("pass")}
     }}>
    <Face event={current} date={dateOf(current)} price={priceOf(current)}/>
    <M.span className="tp-deck-stamp is-want" style={{opacity:wantOp}}>{labels.want}</M.span>
    <M.span className="tp-deck-stamp is-pass" style={{opacity:passOp}}>{labels.pass}</M.span>
    <M.span className="tp-deck-stamp is-view" style={{opacity:viewOp}}>{labels.view}</M.span>
   </M.div>
  </div>
  <div className="tp-deck-actions">
   <button type="button" className="tp-round" onClick={()=>void fly("pass")} aria-label={labels.pass}><BrandIcon name="cross" size={24}/></button>
   <button type="button" className="tp-round is-want" onClick={()=>void fly("want")} aria-label={labels.want}><BrandIcon name="heart" size={28}/>{burst>0&&!reduce&&<span key={burst} className="tp-burst" aria-hidden="true">{Array.from({length:8},(_,i)=><i key={i} style={{"--a":i*45+"deg"} as React.CSSProperties}/>)}</span>}</button>
   <button type="button" className="tp-round" onClick={()=>void fly("view")} aria-label={labels.view}><BrandIcon name="arr-up" size={24}/></button>
  </div>
 </div>;
}
