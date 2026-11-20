import type {Metadata} from "next";
import {HomeClient} from "@/components/HomeClient";
import {publicEvents} from "@/lib/public-events";
import {homeAlternates} from "@/lib/faq-seo";
import {jsonLd,siteSchema} from "@/lib/site-schema";
export const dynamic="force-dynamic";

export const metadata:Metadata = {
  title:"Events and tickets in Czechia",
  description:"Discover events across Czechia, book your place and keep your QR tickets with TicketTreat.",
  alternates:{canonical:"/",languages:homeAlternates},
  openGraph:{url:"/",type:"website",title:"TicketTreat: events and tickets in Czechia",description:"Discover events across Czechia, book your place and keep your QR tickets with TicketTreat."},
};

export default async function HomePage() {
  const events=await publicEvents();
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd(siteSchema())}}/>
    <HomeClient initialEvents={events}/>
  </>;
}
