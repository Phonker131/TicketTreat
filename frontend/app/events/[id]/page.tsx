import type {Metadata} from "next";
import {EventDetailClient} from "@/components/EventDetailClient";
import {lookupPublicEvent,isUpcomingEvent} from "@/lib/public-events";
import {notFound} from "next/navigation";
import type {TicketTreatEvent} from "@/lib/types";
import {seoImageUrl} from "@/lib/seo-image";

type Props={params:Promise<{id:string}>;searchParams:Promise<{invite?:string}>};
const validInvite=(s?:string)=>s&&/^[A-Za-z0-9_-]{43}$/.test(s)?s:undefined;
const origin="https://tickettreat.eu";

export async function generateMetadata({params,searchParams}:Props):Promise<Metadata>{
  const {id}=await params;
  const invite=validInvite((await searchParams).invite);
  const found=await lookupPublicEvent(id,invite);
  if(found.status==="unavailable")throw new Error("Event upstream unavailable");
  if(found.status==="missing")return {title:"Event not found",robots:{index:false,follow:false}};
  const event=found.event;
  if(event.visibility==="link_only")return {title:event.title,robots:{index:false,follow:false},referrer:"no-referrer"};
  if(!isUpcomingEvent(event))return {
    title:"Мероприятие",
    robots:{index:false,follow:true},
  };
  const name=event.title.trim().slice(0,160);
  const description=(event.description||"Узнайте подробности мероприятия и забронируйте билет на TicketTreat.")
    .replace(/\s+/g," ").trim().slice(0,280);
  const image=seoImageUrl(event.image_url);
  const poster=image?[{url:image,alt:name}]:undefined;
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
  const image=seoImageUrl(event.image_url);
  if(image)result.image=image;
  // Event offers describe the organizer's advertised ticket price; TicketTreat
  // does not process payments. Include free and priced tickets alike.
  const advertisedPrice=Number(event.price??0);
  if(Number.isFinite(advertisedPrice)&&advertisedPrice>=0)result.offers={
    "@type":"Offer",url,price:advertisedPrice,
    priceCurrency:/^[A-Z]{3}$/.test(event.currency||"")?event.currency:"CZK",
    availability:event.spots_left===0?"https://schema.org/SoldOut":"https://schema.org/InStock",
  };
  return result;
}

export default async function EventPage({params,searchParams}:Props){
  const {id}=await params;
  const invite=validInvite((await searchParams).invite);
  const found=await lookupPublicEvent(id,invite);
  if(found.status==="unavailable")throw new Error("Event upstream unavailable");
  if(found.status==="missing")notFound();
  const event=found.event;
  const schema=event.visibility==="link_only"?null:structuredEvent(event);
  return <>
    {schema&&<script type="application/ld+json" dangerouslySetInnerHTML={{
      __html:JSON.stringify(schema).replace(/</g,"\\u003c"),
    }}/>}
    <EventDetailClient initialEvent={event}/>
  </>;
}
