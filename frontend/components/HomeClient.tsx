"use client";

import {useEffect,useState} from "react";
import Link from "next/link";
import {AppHeader} from "@/components/AppHeader";
import {EventDiscovery} from "@/components/EventDiscovery";
import {WelcomeStory} from "@/components/WelcomeStory";
import {GuidedSections} from "@/components/GuidedSections";
import {useLanguage} from "@/components/LanguageProvider";
import {getEvents,getSiteLanding,type SiteLanding} from "@/lib/api";
import {t} from "@/lib/i18n";
import type {TicketTreatEvent} from "@/lib/types";

/** Czech pilot: all published events in one catalogue. No location profiling. */
export function HomeClient({initialEvents=null,forcedLanguage}:{initialEvents?:TicketTreatEvent[]|null;forcedLanguage?: "ru"|"cs"|"en"|"uk"}){
  const {language:contextLanguage}=useLanguage();
  const language=forcedLanguage??contextLanguage;
  const [events,setEvents]=useState<TicketTreatEvent[]>(initialEvents||[]);
  const [loading,setLoading]=useState(initialEvents===null);
  const [error,setError]=useState<string|null>(null);
  const [landing,setLanding]=useState<SiteLanding|null>(null);

  useEffect(()=>{
    const controller=new AbortController();
    getEvents(controller.signal)
      .then(items=>setEvents(items.filter(event=>!event.is_cancelled)))
      .catch(e=>{
        if(e instanceof DOMException&&e.name==="AbortError")return;
        // A temporary client refresh error must not erase server-rendered events.
        if(initialEvents===null)setError(e instanceof Error?e.message:"Unknown error");
      }).finally(()=>{if(!controller.signal.aborted)setLoading(false)});
    void getSiteLanding().then(setLanding).catch(()=>{});
    return()=>controller.abort();
  },[]);

  const copy={
    ru:{eyebrow:"PRAHA / TICKETTREAT",headline:["БИЛЕТ ЗА","ТРИ КАСАНИЯ"],intro:"Выбери ивент, запишись и покажи QR на входе. Все билеты в одном месте.",browse:"Смотреть ивенты",tickets:"Мои билеты",city:"БЛИЖАЙШИЕ В ЧЕХИИ",subtitle:"Живые встречи, настоящие места. Выбирай свой вечер.",empty:"Афиши скоро появятся",steps:["ВЫБЕРИ","ЗАПИШИСЬ","ПОКАЖИ QR"],poster:"АФИША / СКОРО",details:"Подробнее",help:"Вопросы о билетах?",faq:"Частые вопросы"},
    cs:{eyebrow:"PRAHA / TICKETTREAT",headline:["VSTUPENKA NA","TŘI KROKY"],intro:"Vyber si akci, zarezervuj místo a u vstupu ukaž QR. Vstupenky máš na jednom místě.",browse:"Zobrazit akce",tickets:"Moje vstupenky",city:"NEJBLIŽŠÍ AKCE V ČESKU",subtitle:"Skuteční lidé a večery, na které se těšíš.",empty:"Plakáty se tu brzy objeví",steps:["VYBER","REZERVUJ","UKAŽ QR"],poster:"PLAKÁT / BRZY",details:"Podrobnosti",help:"Otázky ke vstupenkám?",faq:"Časté otázky"},
    uk:{eyebrow:"PRAHA / TICKETTREAT",headline:["КВИТОК ЗА","ТРИ КРОКИ"],intro:"Обери подію, забронюй місце та покажи QR на вході. Усі квитки в одному місці.",browse:"Переглянути події",tickets:"Мої квитки",city:"НАЙБЛИЖЧІ ПОДІЇ В ЧЕХІЇ",subtitle:"Живі зустрічі та справжні події.",empty:"Афіші незабаром з’являться",steps:["ОБЕРИ","БРОНЮЙ","ПОКАЖИ QR"],poster:"АФІША / СКОРО",details:"Докладніше",help:"Питання про квитки?",faq:"Поширені запитання"},
    en:{eyebrow:"PRAHA / TICKETTREAT",headline:["YOUR TICKET","IN THREE STEPS"],intro:"Find an event, book a spot and show your QR at the door. Keep all tickets in one place.",browse:"Explore events",tickets:"My tickets",city:"UPCOMING IN CZECHIA",subtitle:"Real people, real nights out. Find your next event.",empty:"New posters are coming soon",steps:["CHOOSE","BOOK","SHOW QR"],poster:"POSTER / SOON",details:"View event",help:"Questions about tickets?",faq:"Read FAQ"}
  }[language];
  const featured=events.find(event=>Boolean(event.image_url));
  return <div className="app-shell tt-night-home">
    <AppHeader/>
    <WelcomeStory language={language}/>
    <main className="page tt-night-home-page" lang={language} id="main-content">
      <section className="tt-night-hero" aria-labelledby="tt-night-title">
        <div className="tt-night-hero-copy">
          <p className="tt-night-kicker">{copy.eyebrow}</p>
          <h1 id="tt-night-title"><span>{copy.headline[0]}</span><span>{copy.headline[1]}</span></h1>
          <p className="tt-night-intro">{copy.intro}</p>
          <div className="tt-night-actions">
            <a className="button button-primary tt-night-action" href="#events">{copy.browse}<span className="tt-night-action-arrow" aria-hidden="true">↗</span></a>
            <Link className="button button-secondary tt-night-action-secondary" href="/tickets">{copy.tickets}</Link>
            <button type="button" className="button button-secondary tt-night-action-secondary"
              onClick={()=>window.dispatchEvent(new Event("tickettreat-open-story"))}>
              {language==="ru"?"Как это работает":language==="cs"?"Jak to funguje":language==="uk"?"Як це працює":"How it works"} ↗
            </button>
          </div>
          <ol className="tt-night-steps" aria-label="TicketTreat">
            {copy.steps.map((step,index)=><li key={step}><span>{String(index+1).padStart(2,"0")}</span>{step}</li>)}
          </ol>
        </div>
        <div className="tt-night-hero-art" aria-hidden="true">
          <div className="tt-night-poster">
            {featured?.image_url?<img src={featured.image_url} alt="" />:<div className="tt-night-poster-art"><img src="/brand/glyph-burst.svg" alt="" /></div>}
            <div className="tt-night-poster-stamp">{copy.poster}</div>
            <div className="tt-night-poster-foot"><span>TICKETTREAT</span><span>2026 / PRAHA</span></div>
          </div>
          <img className="tt-night-glyph tt-night-glyph-plus" src="/brand/glyph-plus.svg" alt="" />
          <img className="tt-night-glyph tt-night-glyph-wave" src="/brand/glyph-wave.svg" alt="" />
        </div>
      </section>
      <section className="section tt-night-events" id="events" aria-labelledby="tt-events-heading">
        <div className="section-heading"><div>
          <p className="tt-night-kicker">TICKETTREAT / EVENTS</p>
          <h2 id="tt-events-heading">{copy.city}</h2>
          <p>{copy.subtitle}</p>
        </div></div>
        {loading&&<div className="state-card" role="status">{t(language,"loading")}</div>}
        {!loading&&error&&<div className="state-card state-error" role="alert">{t(language,"loadError")}<small>{error}</small></div>}
        {!loading&&!error&&events.length===0&&<div className="state-card" role="status">{t(language,"noEvents")}</div>}
        {!loading&&!error&&events.length>0&&
          <EventDiscovery events={events} language={language}/>}
      </section>
      <GuidedSections language={language}/>
      <section className="tt-home-faq" aria-label="TicketTreat FAQ">
        <div><h2>{copy.help}</h2><p>{language==="en"?"Registration, QR tickets and cancellations.":language==="cs"?"Registrace, QR vstupenky a zrušení.":language==="uk"?"Реєстрація, QR-квитки та скасування.":"Регистрация, QR-билеты и отмены."}</p></div>
        <Link href={language==="ru"?"/faq":"/"+language+"/faq"} className="button button-secondary">{copy.faq} ↗</Link>
      </section>
    </main>
  </div>;
}
