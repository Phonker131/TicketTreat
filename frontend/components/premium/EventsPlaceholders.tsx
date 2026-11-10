"use client";
import Link from "next/link";
import {PosterArt} from "@/components/premium/PosterArt";
import {BrandPhoto} from "@/components/premium/BrandPhoto";
import {premium} from "@/components/premium/copy";
import type {LanguageCode} from "@/lib/types";

/** Loading skeleton that keeps the shape of the poster cards it will become. */
export function EventsSkeleton({count=3}:{count?:number}){
 return <div className="tp-skel-grid" role="status" aria-busy="true" aria-live="polite">
  {Array.from({length:count},(_,i)=><div className="tp-skel-card" key={i} aria-hidden="true"><i className="tp-skel-img"/><i className="tp-skel-line w60"/><i className="tp-skel-line w90"/><i className="tp-skel-line w40"/></div>)}
  <span className="tp-sr">…</span>
 </div>;
}

/** Shown when no event is published yet: three photos of the kind of nights that appear here, a calm message and two ways forward. */
export function EventsEmpty({language}:{language:LanguageCode}){
 const c=premium[language].empty;
 return <div className="tp-events-empty" role="status">
  <div className="tp-ee-fan" aria-hidden="true">
   <BrandPhoto name="quiz" sizes="180px" className="tp-ee-p tp-ee-p1"/><BrandPhoto name="sd" sizes="200px" className="tp-ee-p tp-ee-p2"/><BrandPhoto name="night" sizes="180px" className="tp-ee-p tp-ee-p3"/>
  </div>
  <div className="tp-ee-copy">
   <h3>{c.title}</h3><p>{c.text}</p>
   <div className="tp-ee-actions">
    <button type="button" className="button button-primary" onClick={()=>window.dispatchEvent(new Event("tickettreat-open-story"))}>{c.cta}</button>
    <Link href="/organizers" className="button button-secondary">{c.organizers}</Link>
   </div>
  </div>
 </div>;
}

export function MoodEmpty({language,title,text,action,onReset}:{language:LanguageCode;title?:string;text?:string;action?:string;onReset:()=>void}){
 const c=premium[language].empty;
 return <div className="tp-events-empty is-compact" role="status">
  <div className="tp-ee-fan" aria-hidden="true"><PosterArt seed={3} className="tp-ee-p tp-ee-p2"/></div>
  <div className="tp-ee-copy"><h3>{title||c.noMatchTitle}</h3>{text&&<p>{text}</p>}
   <button type="button" className="button button-secondary" onClick={onReset}>{action||c.resetMood}</button></div>
 </div>;
}
