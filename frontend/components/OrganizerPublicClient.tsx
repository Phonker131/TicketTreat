"use client";
import Link from "next/link";
import {AppHeader} from "@/components/AppHeader";
import {EventCard} from "@/components/EventCard";
import {useLanguage} from "@/components/LanguageProvider";
import type {OrganizerPublicDetail,LanguageCode} from "@/lib/types";

const W:Record<LanguageCode,Record<string,string>>={
  en:{back:"All organizers",about:"About organizer",upcoming:"Upcoming events",past:"Past events",held:"Held",planned:"Upcoming",none:"No events in this section yet.",instagram:"Instagram",website:"Website"},
  cs:{back:"Všichni pořadatelé",about:"O pořadateli",upcoming:"Nadcházející akce",past:"Proběhlé akce",held:"Proběhlo",planned:"Nadcházející",none:"Zatím žádné akce.",instagram:"Instagram",website:"Web"},
  ru:{back:"Все организаторы",about:"Об организаторе",upcoming:"Предстоящие мероприятия",past:"Прошедшие мероприятия",held:"Проведено",planned:"Предстоит",none:"Пока нет мероприятий в этом разделе.",instagram:"Instagram",website:"Сайт"},
  uk:{back:"Усі організатори",about:"Про організатора",upcoming:"Майбутні події",past:"Минулі події",held:"Проведено",planned:"Попереду",none:"Поки немає подій у цьому розділі.",instagram:"Instagram",website:"Сайт"}
};
export function OrganizerPublicClient({data}:{data:OrganizerPublicDetail}){
  const {language}=useLanguage(),w=W[language];
  return <div className="app-shell"><AppHeader/><main className="page tt-organizer-public">
    <Link href="/organizers" className="back-link">← {w.back}</Link>
    <section className="tt-organizer-hero">
      <div className="tt-organizer-cover">
        {data.cover_url&&<img src={data.cover_url} alt="" loading="eager"/>}
      </div>
      <div className="tt-organizer-intro">
        <div className="tt-organizer-logo">
          {data.logo_url?<img src={data.logo_url} alt={data.display_name}/>:<span>{data.display_name.substring(0,2).toUpperCase()}</span>}
        </div>
        <div className="tt-organizer-name">
          <h1>{data.display_name}</h1>
          {data.city&&<p>📍 {data.city}</p>}
        </div>
      </div>
      <div className="tt-organizer-description">
        <h2>{w.about}</h2>
        <p>{data.bio}</p>
        <div className="tt-organizer-links">
          {data.website_url&&<a href={data.website_url} target="_blank" rel="noopener noreferrer nofollow" className="button button-outline">{w.website} ↗</a>}
          {data.instagram&&<a href={`https://www.instagram.com/${encodeURIComponent(data.instagram)}/`} target="_blank" rel="noopener noreferrer nofollow" className="button button-outline">{w.instagram} ↗</a>}
        </div>
      </div>
      <div className="tt-organizer-stats">
        <div><strong>{data.past_count}</strong><span>{w.held}</span></div>
        <div><strong>{data.upcoming_count}</strong><span>{w.planned}</span></div>
      </div>
    </section>
    <section className="tt-organizer-section">
      <h2>{w.upcoming}</h2>
      {data.upcoming_events.length>0?<div className="event-grid">{data.upcoming_events.map(event=><EventCard event={event} key={event.id}/>)}</div>:<div className="state-card">{w.none}</div>}
    </section>
    <section className="tt-organizer-section">
      <h2>{w.past}</h2>
      {data.past_events.length>0?<div className="event-grid">{data.past_events.map(event=><EventCard event={event} key={event.id}/>)}</div>:<div className="state-card">{w.none}</div>}
    </section>
  </main></div>;
}
