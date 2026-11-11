"use client";
import {useEffect} from "react";
import {createPortal} from "react-dom";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {useReducedMotion} from "motion/react";
import * as M from "motion/react-m";
import {useLanguage} from "@/components/LanguageProvider";
import {premium} from "@/components/premium/copy";

const icons=[
 <path key="e" d="M12 3l1.8 5.2L19 6l-2.2 5L21 12l-4.2 1L19 18l-5.2-2.2L12 21l-1.8-5.2L5 18l2.2-5L3 12l4.2-1L5 6l5.2 2.2z"/>,
 <g key="t"><path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z"/><path d="M14.5 7v10" strokeDasharray="2 2"/></g>,
 <g key="p"><circle cx="12" cy="8.5" r="3.6"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/></g>
];

/** Phone-only bottom navigation for the website and the Telegram Mini App. Three destinations, one sliding indicator. */
export function MobileTabBar({homepage}:{homepage:string}){
 const {language}=useLanguage(),pathname=usePathname()||"/",reduce=useReducedMotion();
 const hidden=/^\/(admin|checkout|security|organizer)(\/|$)/.test(pathname)||/^\/business/.test(pathname);
 useEffect(()=>{
  if(hidden)return;
  document.body.classList.add("has-tabbar");
  return()=>document.body.classList.remove("has-tabbar");
 },[hidden]);
 if(hidden)return null;
 const [events,tickets,,profile]=premium[language].tabs;
 const labels=[events,tickets,profile];
 const links=[homepage,"/tickets","/profile"];
 const active=(i:number)=>i===0?(pathname==="/"||/^\/(cs|en|uk)$/.test(pathname)||pathname.startsWith("/events")):pathname===links[i]||pathname.startsWith(links[i]+"/");
 // The header uses backdrop-filter; fixed-position descendants then become
 // anchored to the header on iOS Safari. A body-level portal keeps this nav
 // truly fixed to the visual viewport while preserving React events.
 if(typeof document==="undefined")return null;
 return createPortal(<nav className="tp-tabbar" style={{gridTemplateColumns:"repeat(3,minmax(0,1fr))"}} aria-label={language==="ru"?"Нижняя навигация":language==="cs"?"Dolní navigace":language==="uk"?"Нижня навігація":"Bottom navigation"}>
  {links.map((href,i)=><Link key={href} href={href} aria-current={active(i)?"page":undefined} className={active(i)?"is-on":""}>
   {active(i)&&<M.span layoutId="tp-tab-pill" className="tp-tab-pill" transition={reduce?{duration:0}:{type:"spring",stiffness:420,damping:34}}/>}
   <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[i]}</svg>
   <span>{labels[i]}</span>
  </Link>)}
 </nav>,document.body);
}
