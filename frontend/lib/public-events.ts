import type {TicketTreatEvent} from "@/lib/types";
const backend=(process.env.BACKEND_API_URL||"").trim().replace(/\/+$/,"");
async function publicFetch(path:string,fresh=false):Promise<unknown>{
  if(!/^https?:\/\//.test(backend))return null;
  try{
    const res=await fetch(backend+path,{
      ...(fresh?{cache:"no-store" as const}:{next:{revalidate:180}}),
      signal:AbortSignal.timeout(4500),redirect:"error"
    });
    if(!res.ok)return null;
    return await res.json();
  }catch{return null;}
}
function isPublicEvent(v:unknown):v is TicketTreatEvent{
  if(!v||typeof v!=="object")return false;
  const e=v as Partial<TicketTreatEvent>;
  return Number.isSafeInteger(e.id)&&Number(e.id)>0&&typeof e.title==="string"
    &&e.title.trim().length>0&&e.publication?.visible!==false;
}
export async function publicEvents(fresh=false):Promise<TicketTreatEvent[]|null>{
  const result=await publicFetch("/events",fresh);
  if(!Array.isArray(result))return null;
  return result.filter(isPublicEvent).filter(e=>!e.is_cancelled);
}
export type EventLookup=
 |{status:"found";event:TicketTreatEvent}
 |{status:"missing"}
 |{status:"unavailable"};
export async function lookupPublicEvent(id:string):Promise<EventLookup>{
  if(!/^[1-9][0-9]{0,8}$/.test(id))return {status:"missing"};
  if(!/^https?:\/\//.test(backend))return {status:"unavailable"};
  try{
    const r=await fetch(backend+"/events/"+id,{
      cache:"no-store",signal:AbortSignal.timeout(4500),redirect:"error"
    });
    if(r.status===404||r.status===410)return {status:"missing"};
    if(!r.ok)return {status:"unavailable"};
    const data=await r.json();
    if(!isPublicEvent(data)||data.id!==Number(id)||data.is_cancelled)return {status:"missing"};
    return {status:"found",event:data};
  }catch{return {status:"unavailable"};}
}
export async function publicEvent(id:string):Promise<TicketTreatEvent|null>{
  const r=await lookupPublicEvent(id);
  return r.status==="found"?r.event:null;
}
export function isUpcomingEvent(e:TicketTreatEvent):boolean{
  if(!e.starts_at||e.is_cancelled)return false;
  const date=new Date(e.starts_at);
  return !Number.isNaN(date.getTime())&&date.getTime()>Date.now();
}
