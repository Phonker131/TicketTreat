import type {Metadata} from "next";
import {EventDetailClient} from "@/components/EventDetailClient";
import {publicEvent,isUpcomingEvent} from "@/lib/public-events";
import type {TicketTreatEvent} from "@/lib/types";

type Props={params:Promise<{id:string}>};
const origin="https://tickettreat.eu";

export async function generateMetadata({params}:Props):Promise<Metadata>{
  const {id}=await params;
  const event=await publicEvent(id);
  if(!event || !isUpcomingEvent(event))return {
    title:"Мероприятие",
    robots:{index:false,follow:true},
  };
  const name=event.title.trim().slice(0,160);
  const description=(event.description||"Узнайте подробности мероприятия и забронируйте билет на TicketTreat.")
    .replace(/\s+/g," ").trim().slice(0,280);
  const poster=event.image_url && /^https:\/\//i.test(event.image_url)?[{
    url:event.image_url,alt:name,
  }]:undefined;
  const url=`/events/${event.id}`;
  return {
    title:name,
    description,
    alternates:{canonical:url},
    robots:{index:true,follow:true},
    openGraph:{type:"website",url,title:name,siteName:"TicketTreat",description,images:poster},
    twitter:{card:poster?"summary_large_image":"summary",title:name,description,images:poster?.map(item=>item.url)},
  };
}

function structuredEvent(event:TicketTreatEvent):Record<string,unknown>|null {
  if(!isUpcomingEvent(event)||!event.location?.trim()||!event.starts_at)return null;
  const url=`${origin}/events/${event.id}`;
  const result:Record<string,unknown>={
    "@context":"https://schema.org",
    "@type":"Event",
    name:event.title,
    startDate:event.starts_at,
    eventStatus:"https://schema.org/EventScheduled",
    eventAttendanceMode:"https://schema.org/OfflineEventAttendanceMode",
    url,
    location:{
      "@type":"Place",
      name:event.location,
      address:{
        "@type":"PostalAddress",
        ...(event.city?{addressLocality:event.city}:{}),
        addressCountry:event.country_code||"CZ",
      },
    },
    ...(event.description?{description:event.description}:{}),
    ...(event.organizer?{organizer:{"@type":"Organization",name:event.organizer}}:{}),
  };
  if(event.image_url && /^https:\/\//i.test(event.image_url))result.image=event.image_url;
  if(Number(event.price||0)===0)result.offers={
    "@type":"Offer",url,price:"0",priceCurrency:event.currency||"CZK",
    availability:event.spots_left===0?"https://schema.org/SoldOut":"https://schema.org/InStock",
  };
  return result;
}

export default async function EventPage({params}:Props){
  const {id}=await params;
  const event=await publicEvent(id);
  const schema=event&&structuredEvent(event);
  return <>
    {schema&&<script type="application/ld+json" dangerouslySetInnerHTML={{
      __html:JSON.stringify(schema).replace(/</g,"\\u003c"),
    }}/>}
    <EventDetailClient initialEvent={event}/>
  </>;
}
