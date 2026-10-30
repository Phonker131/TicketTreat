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
 {mode==="dark"?"☀":"☾"}
 </button>;
}
