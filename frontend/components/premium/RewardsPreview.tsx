"use client";
import Link from "next/link";
import {useReducedMotion} from "motion/react";
import * as M from "motion/react-m";
import {BrandIcon} from "@/components/BrandIcon";
import {premium} from "@/components/premium/copy";
import type {LanguageCode} from "@/lib/types";

const tiers=[
 {key:"newcomer",at:0,glyph:"plus",ink:"paper"},
 {key:"regular",at:3,glyph:"asterisk",ink:"yel"},
 {key:"insider",at:6,glyph:"burst",ink:"tom"},
 {key:"vip",at:12,glyph:"wave",ink:"plum"}
] as const;
const names:Record<LanguageCode,string[]>={
 ru:["Новичок","Свой","Инсайдер","VIP"],en:["Newcomer","Regular","Insider","VIP"],cs:["Nováček","Stálý host","Insider","VIP"],uk:["Новачок","Свій","Інсайдер","VIP"]
};

function Ring({value,max}:{value:number;max:number}){
 const reduce=useReducedMotion();
 return <div className="tp-ring tp-ring-lg" role="img" aria-label={value+" / "+max}>
  <svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="50"/>
   <M.circle className="v" cx="60" cy="60" r="50" pathLength={100} strokeDasharray="100 100"
    initial={{strokeDashoffset:100}} animate={{strokeDashoffset:100-(value/max)*100}} transition={reduce?{duration:0}:{duration:1.1,ease:[.32,.72,0,1],delay:.2}}/>
  </svg>
  <b>{value}<small>/{max}</small></b>
 </div>;
}

/** What a guest gets, shown before any real data exists: passport, stamps and the level ladder. Everything is labelled as an example. */
export function RewardsPreview({language,mode}:{language:LanguageCode;mode:"guest"|"empty"}){
 const c=premium[language].rewards,ex=premium[language].example,reduce=useReducedMotion();
 const lvl=names[language];
 const reveal=(i:number)=>reduce?{}:{initial:{opacity:0,y:26},whileInView:{opacity:1,y:0},viewport:{once:true,margin:"-40px"},transition:{type:"spring" as const,stiffness:200,damping:24,delay:i*.06}};
 return <section className="tp-rewards" aria-labelledby="tp-rewards-title">
  <div className="tp-rw-left">
   <p className="tp-kicker">{premium[language].tabs[2]} · {ex}</p>
   <h2 id="tp-rewards-title">{c.headline}</h2>
   <p className="tp-te-intro">{c.intro}</p>
   <article className="tp-passcard" aria-label={c.title+" · "+ex}>
    <span className="tp-stamp">{ex}</span>
    <header><small>TICKETTREAT / PASSPORT</small><small>LV.1</small></header>
    <div className="tp-passcard-main">
     <Ring value={0} max={3}/>
     <div><h3>{lvl[0]}</h3><p>{c.progress}</p></div>
    </div>
    <div className="tp-stamps-lg" aria-label={c.stampsTitle}>
     {Array.from({length:6},(_,i)=><span key={i} className={i===0?"is-sample":""}>
      {i===0?<><img src="/brand/glyph-burst.svg" alt="" width="40" height="40"/><small>{c.stampSample}</small></>:<><b>{String(i+1).padStart(2,"0")}</b><small>{c.stampEmpty}</small></>}
     </span>)}
    </div>
   </article>
   <div className="tp-rw-actions">
    {mode==="guest"
     ?<><Link href="/profile" className="button button-primary">{c.signin} ↗</Link><Link href="/" className="button button-secondary">{c.find}</Link></>
     :<><Link href="/" className="button button-primary">{c.find} ↗</Link></>}
   </div>
   <p className="tp-te-note">{c.note}</p>
  </div>
  <div className="tp-rw-right">
   <h3 className="tp-rw-h">{c.ladder}</h3>
   <ol className="tp-ladder">
    {tiers.map((t,i)=><M.li key={t.key} className={"tp-tier tp-tier-"+t.ink+(i===0?" is-you":"")} {...reveal(i)}>
     <i className="tp-tier-glyph"><img src={"/brand/glyph-"+t.glyph+".svg"} alt="" width="46" height="46" loading="lazy"/></i>
     <div className="tp-tier-body">
      <small>LV.{i+1} · {i===0?c.you:c.locked+" "+t.at+" "+c.visits}</small>
      <strong>{lvl[i]}</strong>
      <span>{c.perks[i]}</span>
     </div>
     <em className={"tp-tier-badge "+(i===1?"is-active":i===0?"is-you":"is-soon")}>
      {i===0?<BrandIcon name="chk" size={16}/>:i===1?<BrandIcon name="chk" size={16}/>:<BrandIcon name="lock" size={16}/>}{i===0?c.you:i===1?c.active:c.soon}
     </em>
    </M.li>)}
   </ol>
   <h3 className="tp-rw-h">{c.how}</h3>
   <ol className="tp-how-steps">{c.howSteps.map((s,i)=><M.li key={s} {...reveal(i)}><b>{i+1}</b><span>{s}</span></M.li>)}</ol>
  </div>
 </section>;
}
