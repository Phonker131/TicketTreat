"use client";

import {useEffect,useState} from "react";
import {AppHeader} from "@/components/AppHeader";
import {EventDiscovery} from "@/components/EventDiscovery";
import {WelcomeStory} from "@/components/WelcomeStory";
import {EventsSkeleton,EventsEmpty} from "@/components/premium/EventsPlaceholders";
import {PosterRail} from "@/components/premium/EventLists";
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
    ru:{headline:["ЧТО ИДЁТ","В ПРАГЕ"],intro:"Игровые вечера, квизы и мастер-классы. Запишись и покажи QR на входе.",browse:"Все ивенты",city:"ВСЕ ИВЕНТЫ"},
    cs:{headline:["CO SE DĚJE","V PRAZE"],intro:"Herní večery, kvízy a workshopy. Zarezervuj si místo a u vstupu ukaž QR.",browse:"Všechny akce",city:"VŠECHNY AKCE"},
    uk:{headline:["ЩО ВІДБУВАЄТЬСЯ","У ПРАЗІ"],intro:"Ігрові вечори, квізи та майстер-класи. Забронюй місце та покажи QR на вході.",browse:"Усі події",city:"УСІ ПОДІЇ"},
    en:{headline:["WHAT'S ON","IN PRAGUE"],intro:"Game nights, quizzes and workshops. Book a spot and show the QR at the door.",browse:"All events",city:"ALL EVENTS"}
  }[language];
  // Soonest first; the rail shows the next eight nights.
  const upcoming=[...events].sort((a,b)=>String(a.starts_at||"").localeCompare(String(b.starts_at||""))).slice(0,8);
  return <div className="app-shell tt-night-home">
    <AppHeader/>
    <WelcomeStory language={language}/>
    <main className="page tt-night-home-page" lang={language} id="main-content">
      <section className="tt-night-hero tt-hero2" aria-labelledby="tt-night-title">
        <div className="tt-night-hero-copy">
          <h1 id="tt-night-title"><span>{copy.headline[0]}</span><span>{copy.headline[1]}</span></h1>
          <p className="tt-night-intro">{copy.intro}</p>
          <div className="tt-night-actions">
            <a className="button button-primary tt-night-action" href="#events">{copy.browse}</a>
            <button type="button" className="button button-secondary tt-night-action-secondary" disabled={!storyReady}
              onClick={()=>window.dispatchEvent(new Event("tickettreat-open-story"))}>
              {language==="ru"?"Как это работает":language==="cs"?"Jak to funguje":language==="uk"?"Як це працює":"How it works"}
            </button>
          </div>
        </div>
        {loading?<ul className="tt-rail is-loading" aria-hidden="true">{[0,1,2,3].map(i=><li key={i}><span className="tt-rail-card"><span className="tt-rail-poster"/></span></li>)}</ul>:
          upcoming.length>0&&<PosterRail events={upcoming} language={language}/>}
      </section>
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
