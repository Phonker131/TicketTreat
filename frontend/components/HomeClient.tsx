"use client";

import {useEffect,useState} from "react";
import {AppHeader} from "@/components/AppHeader";
import {EventDiscovery} from "@/components/EventDiscovery";
import {WelcomeStory} from "@/components/WelcomeStory";
import {EventsSkeleton,EventsEmpty} from "@/components/premium/EventsPlaceholders";
import {TicketTearHero} from "@/components/premium/TicketTearHero";
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

  const copy={
    ru:{city:"ВСЕ ИВЕНТЫ"},
    cs:{city:"VŠECHNY AKCE"},
    uk:{city:"УСІ ПОДІЇ"},
    en:{city:"ALL EVENTS"}
  }[language];
  // Soonest first: the hero ticket is for the next night out.
  const upcoming=[...events].sort((a,b)=>String(a.starts_at||"").localeCompare(String(b.starts_at||"")));
  return <div className="app-shell tt-night-home">
    <AppHeader/>
    <WelcomeStory language={language}/>
    <main className="page tt-night-home-page" lang={language} id="main-content">
      <TicketTearHero event={upcoming[0]||null} language={language} storyReady={storyReady}/>
      <section className="section tt-v12-screen tt-night-events" id="events" aria-labelledby="tt-events-heading">
        <div className="section-heading"><div>
          <h2 id="tt-events-heading">{copy.city}</h2>
        </div></div>
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
