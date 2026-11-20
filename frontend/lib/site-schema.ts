/** Structured data (schema.org JSON-LD) shared by public pages.
 * Facts only: who TicketTreat is, where it works, how booking and payment work.
 * The operator's private address is never published here (see /legal-notice for legal details).
 */
import {venueStartEpoch} from "@/lib/venue-time";
import type {OrganizerPublicDetail,TicketTreatEvent} from "@/lib/types";
import {seoImageUrl} from "@/lib/seo-image";

export const origin="https://tickettreat.eu";

/** Serialize for a <script type="application/ld+json"> without allowing "</script>". */
export function jsonLd(data:unknown):string{return JSON.stringify(data).replace(/</g,"\\u003c");}

/** Event times are Prague wall time without an offset; add the Prague offset (+01:00 or +02:00). */
export function pragueDateTime(value:string|null|undefined):string|undefined{
  if(!value)return undefined;
  if(/(?:Z|[+-]\d{2}:\d{2})$/i.test(value))return value;
  const m=value.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  const epoch=venueStartEpoch(value);
  if(!m||!Number.isFinite(epoch))return undefined;
  const [y,mo,d,h,mi,s]=m.slice(1).map(Number);
  const offset=Math.round((Date.UTC(y,mo-1,d,h,mi,s||0)-epoch)/60000);
  const sign=offset<0?"-":"+",abs=Math.abs(offset);
  const pad=(n:number)=>String(n).padStart(2,"0");
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${pad(s||0)}${sign}${pad(Math.floor(abs/60))}:${pad(abs%60)}`;
}

const description="TicketTreat is an event platform for Czechia, mostly Prague: game nights, quizzes, workshops and community evenings. Guests find events, register in a few taps and keep QR tickets in one place; the QR is scanned at the door. Registration on TicketTreat is free. For paid events the organizer sets the price and arranges payment directly; TicketTreat does not take payments.";

/** Home page: the platform itself and the website. */
export function siteSchema(){
  return {
    "@context":"https://schema.org",
    "@graph":[
      {"@type":"Organization","@id":origin+"/#org","name":"TicketTreat","url":origin,
        "logo":origin+"/icon-512.png","email":"contact@tickettreat.eu",description,
        "address":{"@type":"PostalAddress","addressLocality":"Praha","addressCountry":"CZ"},
        "areaServed":{"@type":"Country","name":"Czechia"},
        "sameAs":["https://t.me/TicketTreatBot"]},
      {"@type":"WebSite","@id":origin+"/#site","name":"TicketTreat","url":origin,
        "inLanguage":["en","cs"],description,"publisher":{"@id":origin+"/#org"}},
    ],
  };
}

/** Organizer page: who runs the events, where, and what is coming up. */
export function organizerSchema(p:OrganizerPublicDetail){
  const url=`${origin}/organizers/${p.slug}`;
  const sameAs=[p.website_url,p.instagram?`https://www.instagram.com/${encodeURIComponent(p.instagram)}/`:""]
    .filter(link=>/^https:\/\//.test(link));
  const logo=seoImageUrl(p.logo_url),image=seoImageUrl(p.cover_url);
  const events=p.upcoming_events.slice(0,20).flatMap(e=>{
    const startDate=pragueDateTime(e.starts_at);
    return startDate?[{"@type":"Event","name":e.title,"url":`${origin}/events/${e.id}`,startDate,
      ...(e.location?{"location":{"@type":"Place","name":e.location,
        "address":{"@type":"PostalAddress",...(e.city||p.city?{"addressLocality":e.city||p.city}:{}),"addressCountry":e.country_code||"CZ"}}}:{})}]:[];
  });
  return {
    "@context":"https://schema.org","@type":"Organization","@id":url+"#org","name":p.display_name,url,
    ...(p.bio?{"description":p.bio.replace(/\s+/g," ").trim().slice(0,600)}:{}),
    ...(logo?{logo}:{}),...(image?{image}:{}),
    ...(p.city?{"address":{"@type":"PostalAddress","addressLocality":p.city,"addressCountry":"CZ"}}:{}),
    ...(sameAs.length?{sameAs}:{}),
    ...(events.length?{"event":events}:{}),
  };
}

/** Event page: the venue city falls back to the organizer's city; a street address is used when the venue text has a number. */
export function eventPlace(event:TicketTreatEvent){
  const location=(event.location||"").trim();
  const locality=event.city||event.organizer_profile?.city||"";
  return {
    "@type":"Place","name":location,
    "address":{"@type":"PostalAddress",
      ...(/\d/.test(location)?{"streetAddress":location}:{}),
      ...(locality?{"addressLocality":locality}:{}),
      "addressCountry":event.country_code||"CZ"},
  };
}
