"use client";
import {useEffect,useState} from "react";
import {flushSync} from "react-dom";
import {useLanguage} from "@/components/LanguageProvider";
type Mode="dark"|"light";
const KEY="tt4-theme";
function applyTheme(mode:Mode){
 document.documentElement.dataset.theme=mode;
 let meta=document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
 if(!meta){meta=document.createElement("meta");meta.name="theme-color";document.head.appendChild(meta);}
 meta.content=mode==="dark"?"#02070A":"#F0EBE1";
 window.dispatchEvent(new Event("tickettreat-theme-change"));
}
export function ThemeToggle(){
 const {language}=useLanguage();
 const [mode,setMode]=useState<Mode>("dark");
 useEffect(()=>{
  const sync=()=>setMode(document.documentElement.dataset.theme==="light"?"light":"dark");
  sync();
  const query=window.matchMedia("(prefers-color-scheme: dark)");
  const system=()=>{try{if(!localStorage.getItem(KEY))applyTheme(query.matches?"dark":"light");}catch{}sync()};
  query.addEventListener("change",system);
  window.addEventListener("tickettreat-theme-change",sync);
  return()=>{query.removeEventListener("change",system);window.removeEventListener("tickettreat-theme-change",sync)};
 },[]);
 const label=mode==="dark"?
  {ru:"Включить светлую тему",cs:"Zapnout světlý režim",uk:"Увімкнути світлу тему",en:"Switch to light theme"}[language]:
  {ru:"Включить тёмную тему",cs:"Zapnout tmavý režim",uk:"Увімкнути темну тему",en:"Switch to dark theme"}[language];
 return <button type="button" className="tt-theme-toggle" aria-label={label} title={label} aria-pressed={mode==="dark"}
 onClick={e=>{
  const next=mode==="dark"?"light":"dark";
  const commit=()=>{try{localStorage.setItem(KEY,next)}catch{}applyTheme(next);setMode(next)};
  const doc=document as Document&{startViewTransition?:(cb:()=>void)=>{ready:Promise<void>}};
  if(!doc.startViewTransition||window.matchMedia("(prefers-reduced-motion: reduce)").matches){commit();return}
  /* the new theme grows out of the button as a circle */
  const r=e.currentTarget.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
  const radius=Math.hypot(Math.max(cx,innerWidth-cx),Math.max(cy,innerHeight-cy));
  doc.startViewTransition(()=>flushSync(commit)).ready.then(()=>document.documentElement.animate(
   {clipPath:["circle(0px at "+cx+"px "+cy+"px)","circle("+radius+"px at "+cx+"px "+cy+"px)"]},
   {duration:640,easing:"cubic-bezier(.22,1,.36,1)",pseudoElement:"::view-transition-new(root)"})).catch(()=>{});
 }}>
 <svg width="23" height="23" viewBox="0 0 52 52" aria-hidden="true" fill="none"><use href={mode==="dark"?"/brand/icons.svg#sun":"/brand/icons.svg#moon"}/></svg>
 </button>;
}
