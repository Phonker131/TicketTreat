import type {CSSProperties,ReactNode} from "react";
import {BrandIcon} from "@/components/BrandIcon";
import type {LanguageCode} from "@/lib/types";
import {premium} from "@/components/premium/copy";
import {Qr} from "@/components/premium/Qr";

/* Illustrative app screens, authored at 390x844 (phone) and 1280x800 (laptop). They are drawn in React so they stay
   crisp, follow the active theme and read in all four languages. They are examples, never real tickets or data. */

function PosterImg({name,w,h,priority=false}:{name:string;w:number;h:number;priority?:boolean}){
 const base="/brand/posters/"+name;
 const sizes="(max-width: 900px) 340px, 300px";
 // AVIF is about 60% lighter than WebP for these halftone posters; older browsers fall back to WebP.
 return <picture>
  <source type="image/avif" srcSet={base+"-480.avif 480w, "+base+"-720.avif 720w"} sizes={sizes}/>
  {/* eslint-disable-next-line @next/next/no-img-element */}
  <img src={base+"-480.webp"} srcSet={base+"-480.webp 480w, "+base+"-720.webp 720w"} sizes={sizes} alt="" width={w} height={h}
   loading={priority?"eager":"lazy"} decoding="async" {...(priority?{fetchPriority:"high" as const}:{})}/>
 </picture>;
}
const vars=(v:Record<string,string>)=>v as CSSProperties;
const ink=(c:string)=>c==="plum"?"var(--paper)":"var(--ink)";

function Wordmark(){
 return <span className="tp-wm"><img className="tp-wm-l" src="/tickettreat-wordmark.svg" alt="" width="148" height="30"/><img className="tp-wm-d" src="/tickettreat-wordmark-dark.svg" alt="" width="148" height="30"/></span>;
}
function StatusBar(){
 return <div className="tp-status"><b>9:41</b><span aria-hidden="true">
  <svg width="18" height="12" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>
  <svg width="17" height="12" viewBox="0 0 17 12"><path d="M8.5 2.4c2.2 0 4.2.9 5.7 2.3l1.2-1.3A10.3 10.3 0 0 0 8.5.6C5.8.6 3.3 1.7 1.6 3.4l1.2 1.3A8.2 8.2 0 0 1 8.5 2.4zm0 3.6c1.2 0 2.3.5 3.1 1.2l1.2-1.3a6.5 6.5 0 0 0-8.6 0l1.2 1.3c.8-.7 1.9-1.2 3.1-1.2zm0 3.4c.5 0 1 .2 1.4.6L8.5 11.5 7.1 10c.4-.4.9-.6 1.4-.6z"/></svg>
  <svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="22" height="12" rx="3.5" fill="none" stroke="currentColor" opacity=".45"/><rect x="2" y="2" width="17" height="9" rx="2"/><rect x="24" y="4.2" width="2" height="4.6" rx="1" opacity=".5"/></svg>
 </span></div>;
}
const TabIcon={
 0:<path d="M12 3l1.8 5.2L19 6l-2.2 5L21 12l-4.2 1L19 18l-5.2-2.2L12 21l-1.8-5.2L5 18l2.2-5L3 12l4.2-1L5 6l5.2 2.2z"/>,
 1:<><path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z"/><path d="M14.5 7v10" strokeDasharray="2 2"/></>,
 2:<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9L3.5 9.7l5.9-.8z"/>,
 3:<><circle cx="12" cy="8.5" r="3.6"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/></>
} as const;
function Chrome({language,tab,children,bar=true,className="",kind}:{language:LanguageCode;tab:0|1|2|3;children:ReactNode;bar?:boolean;className?:string;kind?:string}){
 const c=premium[language];
 return <div className={"tp-scr "+className} data-kind={kind}>
  <StatusBar/>
  <div className="tp-scr-body">{children}</div>
  {bar&&<nav className="tp-tabs">{c.tabs.map((name,i)=><span key={name} className={i===tab?"is-on":""}>
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{TabIcon[i as 0|1|2|3]}</svg>{name}</span>)}</nav>}
  <i className="tp-home-bar"/>
 </div>;
}
function AppBar({language}:{language:LanguageCode}){
 return <header className="tp-appbar"><Wordmark/><span className="tp-appbar-tg">TG ↗</span></header>;
}

/* ---------- phone screens ---------- */

export function ScreenDiscover({language,photo="sd",color="blu",priority=false}:{language:LanguageCode;photo?:string;color?:string;priority?:boolean}){
 const c=premium[language].discover;
 return <Chrome language={language} tab={0} kind="discover">
  <AppBar language={language}/>
  <div className="tp-sc-head"><small>{c.kicker}</small><h4>{c.title}</h4></div>
  <div className="tp-chips">{c.moods.map((m,i)=><span key={m} className={i===0?"is-on":""}>{m}</span>)}</div>
  <div className="tp-print" style={vars({"--c":"var(--"+color+")"})}>
   <div className="tp-print-img"><PosterImg name={photo} w={280} h={373} priority={priority}/><span className="tp-datebadge">{c.dateLabel}</span></div>
   <h5>Speed Dating</h5><p>Cafe Louvre, Praha 1</p>
   <div className="tp-meta"><b>{c.price}</b><span>{c.left}</span></div>
  </div>
  <div className="tp-actions"><i><BrandIcon name="cross" size={24}/></i><i className="is-want"><BrandIcon name="heart" size={28}/></i><i><BrandIcon name="arr-up" size={24}/></i></div>
 </Chrome>;
}

export function ScreenEvent({language,photo="quiz",color="blu",priority=false}:{language:LanguageCode;photo?:string;color?:string;priority?:boolean}){
 const c=premium[language].event;
 return <Chrome language={language} tab={0} className="tp-flush" kind="event">
  <div className="tp-hero" style={vars({"--c":"var(--"+color+")"})}>
   <PosterImg name={photo} w={390} h={400} priority={priority}/>
   <span className="tp-hero-back"><BrandIcon name="back" size={20}/></span>
   <span className="tp-datebadge">21 NOV</span>
  </div>
  <div className="tp-sheet">
   <h5 className="tp-big">{premium[language].qr.title}</h5>
   <p className="tp-by">{c.organizer}: {c.by}</p>
   <ul className="tp-facts">
    <li><BrandIcon name="clock" size={20}/>{c.when}</li>
    <li><BrandIcon name="pin" size={20}/>{c.where}</li>
    <li><BrandIcon name="user" size={20}/>{c.spots}</li>
   </ul>
   <div className="tp-bar"><i style={{width:"90%"}}/></div>
   <div className="tp-org-row"><i>AE</i><span><b>{c.by}</b><small>{c.organizer}, Praha</small></span></div>
   <div className="tp-cta"><span><small>{premium[language].discover.price}</small><b>{c.about}</b></span><em>{c.reserve}<BrandIcon name="arr" size={20}/></em></div>
  </div>
 </Chrome>;
}

export function ScreenReserve({language,color="blu"}:{language:LanguageCode;color?:string}){
 const c=premium[language].reserve;
 return <Chrome language={language} tab={1} kind="reserve">
  <AppBar language={language}/>
  <div className="tp-done"><span className="tp-done-check"><BrandIcon name="chk" size={28}/></span><h4>{c.title}</h4><p>{c.sub}</p></div>
  <ol className="tp-steps">
   {c.steps.map((s,i)=><li key={s} className={i===0?"is-done":i===1?"is-now":""}>
    <i>{i===0?<BrandIcon name="chk" size={16}/>:i+1}</i><span><b>{s}</b><small>{c.stepNotes[i]}</small></span></li>)}
  </ol>
  <div className="tp-mini-ticket" style={vars({"--c":"var(--"+color+")","--t":ink(color)})}><small>TICKETTREAT</small><b>{premium[language].qr.title}</b><span className="tp-badge">{c.badge}</span></div>
  <div className="tp-cta tp-cta-solo"><em>{c.open}<BrandIcon name="arr" size={20}/></em></div>
 </Chrome>;
}

export function ScreenTicket({language,color="blu"}:{language:LanguageCode;color?:string}){
 const c=premium[language].ticket;
 return <Chrome language={language} tab={1} kind="ticket">
  <AppBar language={language}/>
  <article className="tp-ticket" style={vars({"--c":"var(--"+color+")","--t":ink(color)})}>
   <header><small>TICKETTREAT</small><small>{c.code}</small></header>
   <h5>{premium[language].qr.title}</h5>
   <p>{premium[language].event.when}</p><p className="tp-ticket-venue">{c.venue}</p>
   <i className="tp-ticket-perf" aria-hidden="true"/>
   <div className="tp-count">{[["04",c.countdown[0]],["11",c.countdown[1]],["32",c.countdown[2]],["08",c.countdown[3]]].map(([n,l])=><span key={l}><b>{n}</b><small>{l}</small></span>)}</div>
  </article>
  <div className="tp-cta tp-cta-solo"><em>{c.showQr}<BrandIcon name="scan" size={20}/></em></div>
 </Chrome>;
}

export function ScreenQr({language}:{language:LanguageCode}){
 const c=premium[language].qr;
 return <Chrome language={language} tab={1} kind="qr">
  <AppBar language={language}/>
  <article className="tp-ticket tp-ticket-back">
   <header><small>TICKETTREAT</small><small>{premium[language].ticket.code}</small></header>
   <h5>{c.title}</h5>
   <div className="tp-qr"><Qr size={200}/></div>
   <p className="tp-door">{c.door}</p>
   <dl><div><dt>{c.guest}</dt><dd>Anna Nováková</dd></div><div><dt>{c.guests}</dt><dd>{c.status}: {c.ok}</dd></div></dl>
   <i className="tp-barcode" aria-hidden="true"/>
  </article>
 </Chrome>;
}

export function ScreenPassport({language}:{language:LanguageCode}){
 const c=premium[language].passport;
 return <Chrome language={language} tab={2} kind="passport">
  <AppBar language={language}/>
  <div className="tp-sc-head"><small>{c.level} 2 / 4</small><h4>{c.title}</h4></div>
  <div className="tp-pass">
   <div className="tp-ring"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="50"/><circle className="v" cx="60" cy="60" r="50" pathLength="100" strokeDasharray="67 100"/></svg><b>4<small>/6</small></b></div>
   <div><strong>{c.levels[1]}</strong><p>{c.toNext}</p></div>
  </div>
  <div className="tp-stamps">{[0,1,2,3,4,5].map(i=><span key={i} className={i<4?"is-on":""} style={vars({"--r":(i%2?"-4deg":"3deg")})}>{i<4?<BrandIcon name="chk" size={24}/>:i+1}</span>)}</div>
  <ul className="tp-perks">{c.perkItems.map((p,i)=><li key={p} className={i===0?"is-on":""}><i><BrandIcon name={i===0?"chk":"lock"} size={16}/></i>{p}</li>)}</ul>
 </Chrome>;
}

export type PhoneScreen="discover"|"event"|"reserve"|"ticket"|"qr"|"passport";
export function PhoneScreen({kind,language,photo,color,priority}:{kind:PhoneScreen;language:LanguageCode;photo?:string;color?:string;priority?:boolean}){
 switch(kind){
  case "event":return <ScreenEvent language={language} photo={photo} color={color} priority={priority}/>;
  case "reserve":return <ScreenReserve language={language} color={color}/>;
  case "ticket":return <ScreenTicket language={language} color={color}/>;
  case "qr":return <ScreenQr language={language}/>;
  case "passport":return <ScreenPassport language={language}/>;
  default:return <ScreenDiscover language={language} photo={photo} color={color} priority={priority}/>;
 }
}

/* ---------- laptop screens ---------- */

function Side({language,active}:{language:LanguageCode;active:number}){
 const c=premium[language].lap;
 return <aside className="tp-lap-side"><Wordmark/><nav>{c.nav.map((n,i)=><span key={n} className={i===active?"is-on":""}>{n}</span>)}</nav>
  <div className="tp-org"><i>AE</i><span><b>Amber Events</b><small>Praha</small></span></div></aside>;
}
const guests:[string,number,string][]=[["Lukáš Beránek",0,"TT-7747-X1A0M"],["Marie Kovaleva",1,"TT-3882-X1V70"],["Tomáš Černý",1,"TT-3836-XK0L9"],["Olena Melnyk",2,"TT-1204-X9K2P"],["Jan Dvořák",2,"TT-5518-X4M8Q"]];
function GuestTable({language,rows=5}:{language:LanguageCode;rows?:number}){
 const c=premium[language].lap;
 return <div className="tp-table"><div className="tp-th"><span>{c.name}</span><span>{c.code}</span><span/></div>
  {guests.slice(0,rows).map(([n,s,code])=><div className="tp-tr" key={code}><span><i>{n.split(" ").map(w=>w[0]).join("")}</i>{n}</span><code>{code}</code><em className={"st-"+s}>{c.status[s]}</em></div>)}</div>;
}

export function LaptopOverview({language}:{language:LanguageCode}){
 const c=premium[language].lap;
 return <div className="tp-lap-scr"><Side language={language} active={0}/>
  <main><header><h4>{c.greet}</h4><span className="tp-appbar-tg">TG ↗</span></header>
   <div className="tp-stats">{c.stats.map((s,i)=><div key={s}><small>{s}</small><b>{["30","28","3","3"][i]}</b></div>)}</div>
   <div className="tp-lap-cols">
    <section className="tp-next" style={vars({"--c":"var(--blu)"})}><PosterImg name={"quiz"} w={120} h={160}/><div><small>{c.nextEvent}</small><h5>{premium[language].qr.title}</h5><p>{premium[language].event.when}</p><div className="tp-bar"><i style={{width:"90%"}}/></div></div></section>
    <section className="tp-lap-card"><h6>{c.guests}</h6><GuestTable language={language} rows={4}/></section>
   </div>
  </main></div>;
}
export function LaptopGuests({language}:{language:LanguageCode}){
 const c=premium[language].lap;
 return <div className="tp-lap-scr"><Side language={language} active={2}/>
  <main><header><h4>{c.guests}</h4><span className="tp-search"><BrandIcon name="search" size={20}/>{c.search}</span></header>
   <div className="tp-stats">{c.stats.map((s,i)=><div key={s}><small>{s}</small><b>{["30","28","3","3"][i]}</b></div>)}</div>
   <section className="tp-lap-card"><GuestTable language={language} rows={5}/></section>
  </main></div>;
}
export function LaptopCreate({language}:{language:LanguageCode}){
 const c=premium[language].lap;
 const vals=[premium[language].qr.title,premium[language].event.when,"Bar Hemingway, Praha 2","350","30"];
 return <div className="tp-lap-scr"><Side language={language} active={1}/>
  <main><header><h4>{c.create}</h4></header>
   <div className="tp-form-grid">
    <div className="tp-form">{c.form.map((f,i)=><label key={f}><small>{f}</small><span className={i===0?"is-focus":""}>{vals[i]}</span></label>)}
     <em className="tp-btn-solid">{c.save}<BrandIcon name="arr" size={20}/></em></div>
    <div className="tp-live"><small>{c.preview}</small>
     <div className="tp-print" style={vars({"--c":"var(--blu)"})}><div className="tp-print-img"><PosterImg name={"quiz"} w={280} h={373}/><span className="tp-datebadge">21 NOV</span></div><h5>{vals[0]}</h5><p>{vals[2]}</p><div className="tp-meta"><b>350 CZK</b><span>{premium[language].event.spots}</span></div></div>
    </div>
   </div>
  </main></div>;
}
export function LaptopCheckin({language}:{language:LanguageCode}){
 const c=premium[language].lap;
 return <div className="tp-lap-scr"><Side language={language} active={3}/>
  <main><header><h4>{c.scan}</h4></header>
   <div className="tp-scan-grid">
    <div className="tp-scanner"><i className="tc tl"/><i className="tc tr"/><i className="tc bl"/><i className="tc br"/><span className="tp-scanline"/><p>{c.scanHint}</p></div>
    <div className="tp-scan-side">
     <label><small>{c.enter}</small><span className="is-focus">TT-3882-X1V70</span></label>
     <em className="tp-btn-solid">{c.accept}<BrandIcon name="scan" size={20}/></em>
     <p className="tp-accepted"><BrandIcon name="chk" size={20}/>{c.accepted}: Marie Kovaleva</p>
     <GuestTable language={language} rows={3}/>
    </div>
   </div>
  </main></div>;
}
export type LaptopScreen="overview"|"guests"|"create"|"checkin";
export function LaptopScreenView({kind,language}:{kind:LaptopScreen;language:LanguageCode}){
 return kind==="create"?<LaptopCreate language={language}/>:kind==="guests"?<LaptopGuests language={language}/>:kind==="checkin"?<LaptopCheckin language={language}/>:<LaptopOverview language={language}/>;
}
