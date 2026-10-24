import type {MetadataRoute} from "next";
import {publicEvents,isUpcomingEvent} from "@/lib/public-events";
import {publicOrganizers} from "@/lib/public-organizers";

const root="https://tickettreat.eu";
// Next.js caches metadata routes at build time by default. Production event
// data is only reachable on the Railway private network at request time.
export const dynamic = "force-dynamic";

export default async function sitemap():Promise<MetadataRoute.Sitemap>{
  // Only include real, public, upcoming events. Organizer drafts and account
  // routes are never published in sitemaps.
  const events=await publicEvents();
  const urls:MetadataRoute.Sitemap=[{
    url:root,
    changeFrequency:"daily",
    priority:1,
  }];
  for(const event of events||[]){
    if(!isUpcomingEvent(event))continue;
    urls.push({
      url:`${root}/events/${event.id}`,
      changeFrequency:"daily",
      priority:0.8,
    });
  }
  urls.push({url:`${root}/organizers`,changeFrequency:"weekly",priority:0.6});
  for(const profile of await publicOrganizers()){
    urls.push({url:`${root}/organizers/${profile.slug}`,changeFrequency:"weekly",priority:0.7});
  }
  return urls;
}
