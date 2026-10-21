"use client";

import Link from "next/link";
import {useCallback, useEffect, useMemo, useState} from "react";
import {AppHeader} from "@/components/AppHeader";
import {EventCard} from "@/components/EventCard";
import {useLanguage} from "@/components/LanguageProvider";
import {getEvents,getWebProfile,getSiteLanding,type SiteLanding} from "@/lib/api";
import {getWebToken} from "@/lib/session";
import {isInUsersCity} from "@/lib/location";
import {t} from "@/lib/i18n";
import type {TicketTreatEvent,LanguageCode} from "@/lib/types";

const COPY: Record<LanguageCode,{
  local:string;inYourCity:string;other:string;all:string;showOther:string;
  hideOther:string;fillLocation:string;noLocal:string;signIn:string;recommended:string;
}> = {
  ru:{local:"В твоём городе",inYourCity:"События поблизости",other:"Другие города",all:"Все ивенты",
    showOther:"Показать ивенты в других городах",hideOther:"Скрыть другие города",
    fillLocation:"Укажи город и страну в профиле, чтобы находить ближайшие ивенты.",
    noLocal:"В твоём городе пока нет опубликованных событий.",
    signIn:"Войти или указать город",recommended:"Подобраны по городу из профиля"},
  en:{local:"In your city",inYourCity:"Events near you",other:"Other cities",all:"All events",
    showOther:"Show events in other cities",hideOther:"Hide other cities",
    fillLocation:"Add your country and city in your profile to find local events.",
    noLocal:"There are no upcoming events in your city yet.",
    signIn:"Log in or choose your city",recommended:"Matched to your profile city"},
  cs:{local:"Ve tvém městě",inYourCity:"Akce poblíž",other:"Ostatní města",all:"Všechny akce",
    showOther:"Zobrazit akce v jiných městech",hideOther:"Skrýt jiná města",
    fillLocation:"Zadej v profilu svou zemi a město, aby se zobrazily místní akce.",
    noLocal:"Ve tvém městě zatím nejsou žádné nadcházející akce.",
    signIn:"Přihlásit se nebo zadat město",recommended:"Podle města v profilu"},
  uk:{local:"У твоєму місті",inYourCity:"Події поруч",other:"Інші міста",all:"Усі події",
    showOther:"Показати події в інших містах",hideOther:"Приховати інші міста",
    fillLocation:"Укажи країну та місто в профілі, щоб знаходити події поруч.",
    noLocal:"У твоєму місті поки що немає майбутніх подій.",
    signIn:"Увійти або вказати місто",recommended:"За містом у профілі"},
};

export function HomeClient(){
  const {language}=useLanguage();
  const c=COPY[language];
  const [events,setEvents]=useState<TicketTreatEvent[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [location,setLocation]=useState<{country:string;city:string}|null>(null);
  const [showOther,setShowOther]=useState(false);
  const [landing,setLanding]=useState<SiteLanding|null>(null);

  const refreshProfile=useCallback(async()=>{
    const token=getWebToken();
    if(!token){setLocation(null);return;}
    try{
      const profile=await getWebProfile(token);
      const {country_code,city}=profile.account;
      setLocation(country_code&&city?{country:country_code,city}:null);
    }catch(e){
      // If a transient network failure occurs, show all upcoming events.
      setLocation(null);
    }
  },[]);

  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);setError(null);
    getEvents(controller.signal)
      .then(items=>setEvents(items.filter(event=>!event.is_cancelled)))
      .catch(e=>{
        if(e instanceof DOMException&&e.name==="AbortError")return;
        setError(e instanceof Error?e.message:"Unknown error");
      }).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    void getSiteLanding().then(setLanding).catch(()=>{});
    void refreshProfile();
    const onStorage=()=>{void refreshProfile();};
    window.addEventListener("storage",onStorage);
    window.addEventListener("crowdly-auth-change",onStorage);
    return()=>{
      controller.abort();
      window.removeEventListener("storage",onStorage);
      window.removeEventListener("crowdly-auth-change",onStorage);
    };
  },[refreshProfile]);

  const localEvents=useMemo(()=>location?events.filter(e=>
    isInUsersCity(e,location.country,location.city)):events,[events,location]);
  const remainingEvents=useMemo(()=>location?events.filter(e=>
    !isInUsersCity(e,location.country,location.city)):[],[events,location]);

  return <div className="app-shell">
    <AppHeader/>
    <main className="page">
      <section className="hero" style={landing?.hero_image_url?{backgroundImage:`linear-gradient(105deg,rgba(15,12,35,.88),rgba(15,12,35,.62)),url(${landing.hero_image_url})`,backgroundSize:"cover",backgroundPosition:"center"}:undefined}>
        <div className="hero-pattern"><span className="hero-you"/></div>
        <div className="hero-copy">
          <p className="eyebrow">TICKETTREAT</p>
          <h1>{landing?.headline?.replace(/Crowdly/gi,"TicketTreat")||t(language,"upcoming")}</h1>
          <p>{landing?.subtitle?.replace(/Crowdly/gi,"TicketTreat")||t(language,"tagline")}</p>
        </div>
      </section>
      <section className="section">
        <div className="section-heading"><div>
          <h2>{location?`${c.local}: ${location.city}`:c.all}</h2>
          <p>{location?c.recommended:t(language,"upcomingHint")}</p>
        </div></div>
        {!location&&<div className="location-reminder">
          <p>{c.fillLocation}</p><Link href="/profile" className="button button-outline">{c.signIn}</Link>
        </div>}
        {loading&&<div className="state-card">{t(language,"loading")}</div>}
        {!loading&&error&&<div className="state-card state-error">{t(language,"loadError")}<small>{error}</small></div>}
        {!loading&&!error&&!events.length&&<div className="state-card">{t(language,"noEvents")}</div>}
        {!loading&&!error&&events.length>0&&<>
          {localEvents.length>0
            ? <div className="event-grid">{localEvents.map(e=><EventCard key={e.id} event={e}/>)}</div>
            : location&&<div className="state-card">{c.noLocal}</div>}
          {location&&remainingEvents.length>0&&<div className="other-cities-section">
            <button type="button" className="button button-outline" onClick={()=>setShowOther(v=>!v)}
              aria-expanded={showOther}>
              {showOther?c.hideOther:`${c.showOther} (${remainingEvents.length})`}
            </button>
            {showOther&&<section className="section">
              <div className="section-heading"><h2>{c.other}</h2></div>
              <div className="event-grid">{remainingEvents.map(e=><EventCard key={e.id} event={e}/>)}</div>
            </section>}
          </div>}
        </>}
      </section>
    </main>
  </div>;
}
