"use client";

import {useEffect,useState} from "react";
import {AppHeader} from "@/components/AppHeader";
import {EventCard} from "@/components/EventCard";
import {useLanguage} from "@/components/LanguageProvider";
import {getEvents,getSiteLanding,type SiteLanding} from "@/lib/api";
import {t} from "@/lib/i18n";
import type {TicketTreatEvent} from "@/lib/types";

/** Czech pilot: all published events in one catalogue. No location profiling. */
export function HomeClient(){
  const {language}=useLanguage();
  const [events,setEvents]=useState<TicketTreatEvent[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [landing,setLanding]=useState<SiteLanding|null>(null);

  useEffect(()=>{
    const controller=new AbortController();
    getEvents(controller.signal)
      .then(items=>setEvents(items.filter(event=>!event.is_cancelled)))
      .catch(e=>{
        if(e instanceof DOMException&&e.name==="AbortError")return;
        setError(e instanceof Error?e.message:"Unknown error");
      }).finally(()=>{if(!controller.signal.aborted)setLoading(false)});
    void getSiteLanding().then(setLanding).catch(()=>{});
    return()=>controller.abort();
  },[]);

  const title = language==="ru"?"Все мероприятия":language==="uk"?"Усі події":
    language==="cs"?"Všechny akce":"All events";
  const subtitle = language==="ru"?"Мероприятия по всей Чехии":language==="uk"?"Події по всій Чехії":
    language==="cs"?"Akce po celém Česku":"Events across Czechia";

  return <div className="app-shell">
    <AppHeader/>
    <main className="page">
      <section className="hero" style={landing?.hero_image_url?{
        backgroundImage:`linear-gradient(105deg,rgba(15,12,35,.88),rgba(15,12,35,.62)),url(${landing.hero_image_url})`,
        backgroundSize:"cover",backgroundPosition:"center"
      }:undefined}>
        <div className="hero-pattern"><span className="hero-you"/></div>
        <div className="hero-copy">
          <p className="eyebrow">TICKETTREAT</p>
          <h1>{landing?.headline?.replace(/Crowdly/gi,"TicketTreat")||t(language,"upcoming")}</h1>
          <p>{landing?.subtitle?.replace(/Crowdly/gi,"TicketTreat")||t(language,"tagline")}</p>
        </div>
      </section>
      <section className="section">
        <div className="section-heading"><div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div></div>
        {loading&&<div className="state-card">{t(language,"loading")}</div>}
        {!loading&&error&&<div className="state-card state-error">{t(language,"loadError")}<small>{error}</small></div>}
        {!loading&&!error&&events.length===0&&<div className="state-card">{t(language,"noEvents")}</div>}
        {!loading&&!error&&events.length>0&&
          <div className="event-grid">{events.map(event=><EventCard key={event.id} event={event}/>)}</div>}
      </section>
    </main>
  </div>;
}
