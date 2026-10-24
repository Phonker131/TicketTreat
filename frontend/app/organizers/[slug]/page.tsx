import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {OrganizerPublicClient} from "@/components/OrganizerPublicClient";
import {publicOrganizer} from "@/lib/public-organizers";

type Props={params:Promise<{slug:string}>};
export const dynamic="force-dynamic";

export async function generateMetadata({params}:Props):Promise<Metadata>{
  const {slug}=await params;
  const p=await publicOrganizer(slug);
  if(!p)return {title:"Organizer not found",robots:{index:false,follow:false}};
  const title=`${p.display_name} — TicketTreat`;
  const description=(p.bio||"Explore events from this organizer on TicketTreat").slice(0,240);
  const url=`/organizers/${p.slug}`;
  return {
    title,description,
    alternates:{canonical:url},
    robots:{index:true,follow:true},
    openGraph:{title,description,type:"profile",url,
      ...(p.cover_url?{images:[{url:`https://tickettreat.eu${p.cover_url}`,alt:p.display_name}]}:{})},
  };
}
export default async function OrganizerPage({params}:Props){
  const {slug}=await params;
  const p=await publicOrganizer(slug);
  if(!p)notFound();
  return <OrganizerPublicClient data={p}/>;
}
