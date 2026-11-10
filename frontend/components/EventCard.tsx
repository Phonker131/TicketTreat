"use client";

import Link from "next/link";
import {useEffect,useRef,useState} from "react";

import {useLanguage} from "@/components/LanguageProvider";
import {BrandIcon} from "@/components/BrandIcon";
import {PosterArt} from "@/components/premium/PosterArt";
import {localeForLanguage,t} from "@/lib/i18n";
import type {LanguageCode,TicketTreatEvent} from "@/lib/types";
import {eventDisplayDate} from "@/lib/format";
import {eventTags,TAG_LABELS} from "@/lib/event-tags";
import {useWanted} from "@/lib/wanted";

function formatPrice(event:TicketTreatEvent,language:LanguageCode):string{
  const numeric=Number(event.price||0);
  if(!Number.isFinite(numeric)||numeric<=0)return t(language,"free");
  const rawCurrency=(event.currency||"CZK").toUpperCase();
  const currency=/^[A-Z]{3}$/.test(rawCurrency)?rawCurrency:"CZK";
  const amount=new Intl.NumberFormat(localeForLanguage(language),{maximumFractionDigits:Number.isInteger(numeric)?0:2}).format(numeric);
  return `${amount} ${currency}`;
}

const WORDS={
  ru:{save:"В избранное",saved:"Убрать из избранного",spotsFew:"мест"},
  cs:{save:"Uložit",saved:"Odebrat z uložených",spotsFew:"míst"},
  uk:{save:"В обране",saved:"Прибрати з обраного",spotsFew:"місць"},
  en:{save:"Save",saved:"Remove from saved",spotsFew:"left"}
} as const;

/** One event in the feed or in the saved list: a 4:5 poster, date and price on the poster, two-line title, one-line place. */
export function EventCard({event}:{event:TicketTreatEvent}){
  const {language}=useLanguage();
  const words=WORDS[language];
  const [wanted,setWanted]=useWanted();
  const isWanted=wanted.includes(event.id);
  const [posterUnavailable,setPosterUnavailable]=useState(false);
  const poster=useRef<HTMLImageElement>(null);
  // A poster that failed before hydration never reaches onError, so the fallback is also checked on mount.
  useEffect(()=>{const el=poster.current;setPosterUnavailable(!!el&&el.complete&&el.naturalWidth===0)},[event.image_url]);

  const startsAt=event.starts_at?eventDisplayDate(event.starts_at):null;
  const validStart=!!startsAt&&!Number.isNaN(startsAt.date.getTime());
  const locale=localeForLanguage(language);
  const sticker=validStart&&startsAt?{
    day:new Intl.DateTimeFormat(locale,{day:"2-digit",timeZone:startsAt.timeZone}).format(startsAt.date),
    month:new Intl.DateTimeFormat(locale,{month:"short",timeZone:startsAt.timeZone}).format(startsAt.date).replace(".","").toUpperCase(),
  }:null;
  const when=validStart&&startsAt
    ?new Intl.DateTimeFormat(locale,{weekday:"short",day:"numeric",month:"long",hour:"2-digit",minute:"2-digit",timeZone:startsAt.timeZone}).format(startsAt.date)
    :"—";
  const href=`/events/${event.id}?lang=${language}`;
  const tags=eventTags(event);
  const langs=(event.languages||[]).map(code=>code.toUpperCase()).join(" · ");

  return (
    <article className="event-card tp-ecard">
      <div className="tt-event-poster-wrap tp-ecard-media">
        <Link href={href} className="tp-ecard-poster" tabIndex={-1} aria-hidden="true">
          {event.image_url&&!posterUnavailable
            // eslint-disable-next-line @next/next/no-img-element
            ?<img ref={poster} className="event-card-poster" src={event.image_url} alt="" loading="lazy" decoding="async" onError={()=>setPosterUnavailable(true)}/>
            :<PosterArt seed={event.id} className="tp-card-art"/>}
        </Link>
        {sticker&&<div className="tt-event-date-sticker tp-ecard-date" aria-hidden="true"><strong>{sticker.day}</strong><span>{sticker.month}</span></div>}
        <span className="tp-ecard-price">{formatPrice(event,language)}</span>
        <button type="button" className="tp-heart" aria-pressed={isWanted} aria-label={isWanted?words.saved:words.save}
          onClick={()=>setWanted(event.id,!isWanted)}>
          <BrandIcon name="heart" size={20}/>
        </button>
      </div>

      <div className="event-card-body tp-ecard-body">
        <p className="tp-ecard-when">{when}</p>
        <h2 className="tp-ecard-title"><Link href={href}>{event.title}</Link></h2>
        <p className="tp-ecard-place">
          {event.organizer_profile&&<Link href={`/organizers/${event.organizer_profile.slug}`} className="tt-event-organizer-link">{event.organizer_profile.display_name}</Link>}
          {event.organizer_profile&&event.location&&<span aria-hidden="true"> · </span>}
          <span>{event.location||(event.organizer_profile?"":"—")}</span>
        </p>
        {(tags.length>0||langs)&&<ul className="tp-ecard-tags" aria-label={t(language,"languages")}>
          {tags.map(tag=><li key={tag}>{TAG_LABELS[language][tag]}</li>)}
          {langs&&<li className="is-lang">{langs}</li>}
        </ul>}
        <div className="event-card-footer tp-ecard-foot">
          {event.spots_left===0
            ?<span className="status status-danger">{t(language,"soldOut")}</span>
            :<span className="status">{event.spots_left==null?"∞":`${event.spots_left} ${words.spotsFew}`}</span>}
          <Link href={href} className="button button-secondary">{t(language,"details")}</Link>
        </div>
      </div>
    </article>
  );
}
