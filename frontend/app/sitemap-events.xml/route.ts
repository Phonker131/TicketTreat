import {publicEvents,isUpcomingEvent} from "@/lib/public-events";
import {publicOrganizersStrict} from "@/lib/public-organizers";

// Optional supplemental sitemap: dynamic URLs never jeopardize the stable primary sitemap.
// This endpoint is NOT currently advertised in robots.txt or submitted to Search Console.
const origin="https://tickettreat.eu";
export const dynamic="force-dynamic";
const tag=(s:string)=>s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
const xmlHeader='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
export async function GET(){
  const [events,organizers]=await Promise.all([publicEvents(true),publicOrganizersStrict()]);
  if(events===null||organizers===null)
    return new Response("Supplemental sitemap temporarily unavailable",{
      status:503,headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"}
    });
  const urls=new Set<string>();
  for(const e of events)if(isUpcomingEvent(e))urls.add(origin+"/events/"+e.id);
  for(const o of organizers){
    if(typeof o.slug==="string"&&/^[a-z0-9](?:[a-z0-9-]{1,69}[a-z0-9])?$/.test(o.slug))
      urls.add(origin+"/organizers/"+o.slug);
  }
  if(urls.size>50000)
    return new Response("Supplemental sitemap exceeds URL limit",{
      status:503,headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"}
    });
  const xml=xmlHeader+Array.from(urls).map(u=>"  <url><loc>"+tag(u)+"</loc></url>").join("\n")+"\n</urlset>\n";
  return new Response(xml,{status:200,headers:{"Content-Type":"application/xml; charset=utf-8","Cache-Control":"public, max-age=0, must-revalidate"}});
}
