"use client";
import Link from "next/link";
import {useState} from "react";
import {AppHeader} from "@/components/AppHeader";
import {useLanguage} from "@/components/LanguageProvider";
import type {LanguageCode} from "@/lib/types";
import {faqCopy} from "@/lib/faq-content";

const copy=faqCopy;

export function FaqClient({forcedLanguage}:{forcedLanguage?:LanguageCode}={}){
  const {language:contextLanguage}=useLanguage();
  const language=forcedLanguage??contextLanguage;
  const t=copy[language];
  const [search,setSearch]=useState("");
  const needle=search.trim().toLocaleLowerCase(language);
  const sections=t.sections.map(section=>({...section,items:section.items.filter(item=>
    !needle || (item.q+" "+item.a).toLocaleLowerCase(language).includes(needle))})).filter(section=>section.items.length>0);
  return <div className="app-shell">
    <AppHeader/>
    <main className="page tt-faq-page" lang={language}>
      <Link href="/" className="back-link">← TicketTreat</Link>
      <p className="eyebrow">TICKETTREAT / FAQ</p>
      <h1>{t.title}</h1>
      <p className="tt-faq-intro">{t.intro}</p>
      <nav className="tt-faq-languages" aria-label="FAQ languages">
        <Link href="/faq" hrefLang="ru" lang="ru">Русский</Link>
        <Link href="/cs/faq" hrefLang="cs" lang="cs">Čeština</Link>
        <Link href="/en/faq" hrefLang="en" lang="en">English</Link>
        <Link href="/uk/faq" hrefLang="uk" lang="uk">Українська</Link>
      </nav>
      <div className="tt-faq-search">
        <label htmlFor="tt-faq-search">{t.search}</label>
        <input id="tt-faq-search" type="search" value={search} onChange={event=>setSearch(event.target.value)}
          placeholder={t.search} autoComplete="off"/>
      </div>
      {sections.length===0?<p className="state-card" role="status">{t.empty}</p>:
        <div className="tt-faq-groups">
          {sections.map((section,i)=><section className="tt-faq-group" key={section.title} aria-labelledby={`faq-group-${i}`}>
            <h2 id={`faq-group-${i}`}>{section.title}</h2>
            <div className="tt-faq-items">{section.items.map(item=><details className="tt-faq-item" key={item.q}>
              <summary>{item.q}<span className="tt-faq-toggle" aria-hidden="true">+</span></summary>
              <p>{item.a}</p>
            </details>)}</div>
          </section>)}
        </div>}
      <section className="tt-faq-help" aria-labelledby="faq-help-title">
        <div><h2 id="faq-help-title">{t.supportTitle}</h2><p>{t.supportIntro}</p></div>
        <Link className="button button-primary" href="/support">{t.supportLink}</Link>
      </section>
      <nav className="tt-faq-quicklinks" aria-label="TicketTreat">
        <Link href="/tickets">{t.ticketLink}</Link>
        <Link href="/profile">{t.profileLink}</Link>
        <Link href="/privacy-policy">{t.privacyLink}</Link>
      </nav>
    </main>
  </div>;
}
