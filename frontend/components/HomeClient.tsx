"use client";

import {useEffect,useState} from "react";
import Link from "next/link";
import {AppHeader} from "@/components/AppHeader";
import {EventDiscovery} from "@/components/EventDiscovery";
import {WelcomeStory} from "@/components/WelcomeStory";
import {EventsSkeleton,EventsEmpty} from "@/components/premium/EventsPlaceholders";
import dynamic from "next/dynamic";
import {useLanguage} from "@/components/LanguageProvider";
import {getEvents} from "@/lib/api";
import {t} from "@/lib/i18n";
import type {TicketTreatEvent} from "@/lib/types";

const PageFaq=dynamic(()=>import("@/components/premium/PageFaq").then(mod=>mod.PageFaq));

/** Czech pilot: all published events in one catalogue. No location profiling. */
export function HomeClient({initialEvents=null,forcedLanguage}:{initialEvents?:TicketTreatEvent[]|null;forcedLanguage?: "ru"|"cs"|"en"|"uk"}){
  const {language:contextLanguage}=useLanguage();
  const language=forcedLanguage??contextLanguage;
  const [events,setEvents]=useState<TicketTreatEvent[]>(initialEvents||[]);
  const [loading,setLoading]=useState(initialEvents===null);
  const [storyReady,setStoryReady]=useState(false);
  useEffect(()=>setStoryReady(true),[]);
  const [error,setError]=useState<string|null>(null);

  useEffect(()=>{
    const controller=new AbortController();
    getEvents(controller.signal)
      .then(items=>setEvents(items.filter(event=>!event.is_cancelled)))
      .catch(e=>{
        if(e instanceof DOMException&&e.name==="AbortError")return;
        // A temporary client refresh error must not erase server-rendered events.
        if(initialEvents===null)setError(e instanceof Error?e.message:"Unknown error");
      }).finally(()=>{if(!controller.signal.aborted)setLoading(false)});
    return()=>controller.abort();
  },[]);

  const copy = {
    en: {title:"Upcoming events", intro:"Choose an event to see the time, place and how to book.", tickets:"My tickets", help:"How booking works"},
    cs: {title:"Nadcházející akce", intro:"Vyber si akci. Najdeš u ní čas, místo i možnost rezervace.", tickets:"Moje vstupenky", help:"Jak rezervace funguje"},
    ru: {title:"Ближайшие события", intro:"Выбери событие, чтобы узнать время, место и условия записи.", tickets:"Мои билеты", help:"Как записаться"},
    uk: {title:"Найближчі події", intro:"Обери подію, щоб дізнатися час, місце та умови реєстрації.", tickets:"Мої квитки", help:"Як зареєструватися"}
  }[language];
  return <div className="app-shell tt-night-home">
    <AppHeader/>
    <WelcomeStory language={language}/>
    <main className="page tt-night-home-page" lang={language} id="main-content">
      <section className="section" id="events" aria-labelledby="tt-events-heading">
        <div className="section-heading" style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:"1rem",marginBlock:"1.5rem"}}>
          <div><h1 id="tt-events-heading">{copy.title}</h1><p>{copy.intro}</p></div>
          <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:".75rem"}}>
            <Link className="button button-primary" href="/tickets">{copy.tickets}</Link>
            <button type="button" className="button button-secondary" disabled={!storyReady}
              onClick={()=>window.dispatchEvent(new Event("tickettreat-open-story"))}>{copy.help}</button>
          </div>
        </div>
        {loading&&<EventsSkeleton/>}
        {!loading&&error&&<div className="state-card state-error" role="alert">{t(language,"loadError")}<small>{error}</small></div>}
        {!loading&&!error&&events.length===0&&<EventsEmpty language={language}/>}
        {!loading&&!error&&events.length>0&&
          <EventDiscovery events={events} language={language}/>}
      </section>
      <PageFaq topic="home" language={language}/>
    </main>
  </div>;
}
