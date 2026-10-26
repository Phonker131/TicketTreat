import type {MetadataRoute} from "next";
import {publicEvents,isUpcomingEvent} from "@/lib/public-events";
import {publicOrganizersStrict} from "@/lib/public-organizers";
import {FAQ_LOCALES,faqUrl} from "@/lib/faq-seo";
const origin="https://tickettreat.eu";
export const dynamic="force-dynamic";
// A partial 200 after upstream failure would silently drop indexed event URLs.
// Fail with 5xx so crawlers can retry and retain their previous sitemap.
export default async function sitemap():Promise<MetadataRoute.Sitemap>{
  const [events,organizers]=await Promise.all([publicEvents(true),publicOrganizersStrict()]);
  if(events===null||organizers===null)throw new Error("Sitemap upstream unavailable");
  const urls:MetadataRoute.Sitemap=[{url:origin,changeFrequency:"daily",priority:1}];
  const seen=new Set([origin]);
  function add(path:string,frequency:"daily"|"weekly"|"monthly",priority:number){
    const url=origin+path;if(seen.has(url))return;seen.add(url);
    urls.push({url,changeFrequency:frequency,priority});
  }
  for(const locale of FAQ_LOCALES)add(faqUrl(locale),"monthly",locale==="cs"?0.7:0.5);
  add("/organizers","weekly",0.6);
  for(const event of events)if(isUpcomingEvent(event))add("/events/"+event.id,"daily",0.8);
  for(const organizer of organizers){
    if(!/^[a-z0-9](?:[a-z0-9-]{1,69}[a-z0-9])?$/.test(organizer.slug))continue;
    add("/organizers/"+organizer.slug,"weekly",0.7);
  }
  return urls;
}
