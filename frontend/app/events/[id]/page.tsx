import type {Metadata} from "next";
import {EventDetailClient} from "@/components/EventDetailClient";

type Props={params:Promise<{id:string}>};

export async function generateMetadata({params}:Props):Promise<Metadata>{
  const {id}=await params;
  if(!/^\d+$/.test(id))return {title:"Events | TicketTreat"};
  const backend=(process.env.BACKEND_API_URL||"").trim().replace(/\/$/,"");
  if(!backend)return {title:"Events | TicketTreat"};
  try{
    const response=await fetch(`${backend}/events/${id}`,{
      cache:"no-store",signal:AbortSignal.timeout(4500)
    });
    if(!response.ok)return {title:"Events | TicketTreat"};
    const event=await response.json();
    if(!event||!event.id||event.publication?.visible===false)return {title:"Events | TicketTreat"};
    const name=String(event.title||"Event").slice(0,180);
    const description=String(event.description||"Discover events on TicketTreat.").slice(0,300);
    const poster=typeof event.image_url==="string"&&/^https:\/\//.test(event.image_url)
      ? [{url:event.image_url,alt:name}]:undefined;
    return {
      title:`${name} | TicketTreat`,
      description,
      openGraph:{type:"website",title:name,description,images:poster},
      twitter:{card:poster?"summary_large_image":"summary",title:name,description,images:poster?.map(x=>x.url)}
    };
  }catch{return {title:"Events | TicketTreat"}}
}

export default function EventPage(){
  return <EventDetailClient/>;
}
