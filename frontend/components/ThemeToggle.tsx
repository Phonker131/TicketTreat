"use client";
import {useEffect,useState} from "react";
import {useLanguage} from "@/components/LanguageProvider";
type Mode="dark"|"light";
const KEY="tt4-theme";
function applyTheme(mode:Mode){
 document.documentElement.dataset.theme=mode;
 let meta=document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
 if(!meta){meta=document.createElement("meta");meta.name="theme-color";document.head.appendChild(meta);}
 meta.content=mode==="dark"?"#15141F":"#F0EBE1";
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
 onClick={()=>{const next=mode==="dark"?"light":"dark";try{localStorage.setItem(KEY,next)}catch{}applyTheme(next);setMode(next)}}>
 {mode==="dark"?
   <svg width="23" height="23" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M20 4l-2 2M6 18l-2 2"/></svg>:
   <svg width="23" height="23" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"><path d="M20 16a9 9 0 0 1-12-12 9 9 0 1 0 12 12z"/></svg>}
 </button>;
}
