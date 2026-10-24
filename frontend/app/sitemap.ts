import type {MetadataRoute} from "next";
import {publicEvents,isUpcomingEvent} from "@/lib/public-events";

const root="https://tickettreat.eu";
export const revalidate=300;

export default async function sitemap():Promise<MetadataRoute.Sitemap>{
  // Only include real, public, upcoming events. Organizer drafts and account
  // routes are never published in sitemaps.
  const events=await publicEvents();
  const urls:MetadataRoute.Sitemap=[{
    url:root,
    lastModified:new Date(),
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
  return urls;
}
