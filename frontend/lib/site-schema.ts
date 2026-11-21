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

/** Event times are Prague wall time without an offset; use the same instant as the ticket countdown. */
export function pragueDateTime(value:string|null|undefined):string|undefined{
  if(!value)return undefined;
  const epoch = venueStartEpoch(value);
  return Number.isFinite(epoch) ? new Date(epoch).toISOString() : undefined;
}

const description="TicketTreat is an event platform for Czechia, mostly Prague: game nights, quizzes, workshops and community evenings. Guests find events, register in a few taps and keep QR tickets in one place; the QR is scanned at the door. Registration on TicketTreat is free. For paid events the organizer sets the price and arranges payment directly; TicketTreat does not take payments.";

/** Home page: the platform itself and the website. */
export function siteSchema(){
  return {
    "@context":"https://schema.org",
    "@graph":[
      {"@type":"Organization","@id":origin+"/#org","name":"TicketTreat","url":origin,
        "logo":origin+"/icon-512.png",description,
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
      ...(e.location?{location:eventPlace(e)}:{})}]:[];
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

export function eventPlace(event:TicketTreatEvent){
  return {
    "@type":"Place",
    name:event.location?.trim(),
    ...(event.city || event.country_code ? {
      address:{
        "@type":"PostalAddress",
        ...(event.city ? {addressLocality:event.city} : {}),
        ...(event.country_code ? {addressCountry:event.country_code} : {}),
      },
    } : {}),
  };
}
