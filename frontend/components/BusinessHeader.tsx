"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {useLanguage} from "@/components/LanguageProvider";
import {LanguageSwitcher} from "@/components/LanguageSwitcher";
import {ThemeToggle} from "@/components/ThemeToggle";

const labels={
 ru:{flag:"ДЛЯ ОРГАНИЗАТОРОВ",how:"Как работает",sides:"Глазами гостя",features:"Возможности",faq:"Вопросы",guest:"Сайт для гостей",signin:"Войти",open:"Открыть меню",close:"Закрыть меню"},
 uk:{flag:"ДЛЯ ОРГАНІЗАТОРІВ",how:"Як працює",sides:"Очима гостя",features:"Можливості",faq:"Питання",guest:"Сайт для гостей",signin:"Увійти",open:"Відкрити меню",close:"Закрити меню"},
 cs:{flag:"PRO POŘADATELE",how:"Jak to funguje",sides:"Očima hosta",features:"Funkce",faq:"Otázky",guest:"Web pro hosty",signin:"Přihlásit se",open:"Otevřít menu",close:"Zavřít menu"},
 en:{flag:"FOR ORGANIZERS",how:"How it works",sides:"Guest view",features:"Features",faq:"Questions",guest:"Guest website",signin:"Sign in",open:"Open menu",close:"Close menu"}
} as const;
export function BusinessHeader(){
 const {language}=useLanguage(),t=labels[language];
 const [open,setOpen]=useState(false);
 useEffect(()=>{
  const onKey=(e:KeyboardEvent)=>{if(e.key==="Escape")setOpen(false)};
  document.addEventListener("keydown",onKey);
  return()=>document.removeEventListener("keydown",onKey);
 },[]);
 return <header className="tt-business-header">
   <div className="tt-business-header-content">
     <Link href="/" aria-label="TicketTreat" className="tt-business-logo">
       <img src="/tickettreat-wordmark.svg" className="wordmark-logo-light" width="148" height="32" alt="TicketTreat"/>
       <img src="/tickettreat-wordmark-dark.svg" className="wordmark-logo-dark" width="148" height="32" alt="" aria-hidden="true"/>
     </Link>
     <span className="tt-business-header-tag">{t.flag}</span>
     <nav id="tt-business-menu" aria-label={t.flag} className={"tt-business-nav"+(open?" is-open":"")}>
       <a href="#business-how" onClick={()=>setOpen(false)}>{t.how}</a>
       <a href="#business-sides" onClick={()=>setOpen(false)}>{t.sides}</a>
       <a href="#business-features" onClick={()=>setOpen(false)}>{t.features}</a>
       <a href="#business-faq" onClick={()=>setOpen(false)}>{t.faq}</a>
     </nav>
     <Link href="/" className="tt-business-guest-link">{t.guest}</Link>
     <div className="tt-business-header-actions">
       <ThemeToggle/><LanguageSwitcher/>
       <Link href="/admin" className="tt-business-signin">{t.signin} <span aria-hidden="true">↗</span></Link>
       <button type="button" className="tt-business-menu-toggle" aria-expanded={open} aria-controls="tt-business-menu" onClick={()=>setOpen(v=>!v)} aria-label={open?t.close:t.open}>{open?"×":"☰"}</button>
     </div>
   </div>
 </header>;
}
