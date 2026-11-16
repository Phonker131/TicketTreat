"use client";
import Link from "next/link";
import {AppHeader} from "@/components/AppHeader";
import {useLanguage} from "@/components/LanguageProvider";

const WORDS={
  en:{title:"Page not found",text:"This page does not exist or has moved. The events are still here.",events:"Explore events",tickets:"My tickets"},
  cs:{title:"Stránka nenalezena",text:"Tato stránka neexistuje nebo se přesunula. Akce tu ale pořád jsou.",events:"Najít akci",tickets:"Moje vstupenky"},
};

/** Branded 404: the usual header and tab bar, one sentence and a way back to the events. */
export function NotFoundClient(){
  const {language}=useLanguage();
  const t=language==="cs"?WORDS.cs:WORDS.en;
  return <div className="app-shell">
    <AppHeader/>
    <main className="page tt-notfound" id="main-content">
      <h1>{t.title}</h1>
      <p>{t.text}</p>
      <div className="tt-btn-row">
        <Link href="/" className="button button-primary">{t.events}</Link>
        <Link href="/tickets" className="button button-outline">{t.tickets}</Link>
      </div>
    </main>
  </div>;
}
