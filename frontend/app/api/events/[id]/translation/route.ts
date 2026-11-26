import {detect} from "tinyld";
import {unstable_cache} from "next/cache";
import {lookupPublicEvent} from "@/lib/public-events";
import {eventDescription} from "@/lib/czech-event-descriptions";

// Cache successful translations by the actual source text and destination language.
// An organizer's edit produces a different key immediately.
const translateChunk = unstable_cache(async (source:string, from:string, to:string) => {
  const url = new URL("https://api.mymemory.translated.net/get");
  url.search = new URLSearchParams({q:source,langpair:from+"|"+to}).toString();
  const response=await fetch(url,{cache:"no-store",signal:AbortSignal.timeout(10000)});
  if(!response.ok) throw new Error("Translation unavailable");
  const data=await response.json();
  const text=data.responseData?.translatedText;
  if(Number(data.responseStatus)!==200 || typeof text!=="string" || !text.trim())
    throw new Error("Missing translation");
  return text;
},["event-translation-memory-v1"],{revalidate:60*60*24*30});

async function translate(source:string, language:string, context:string) {
  if(!source.trim()) return source;
  const options={only:["cs","en","ru","uk"]};
  const from=detect(source,options)||detect(context,options)||"en";
  if(from===language) return source;
  // The provider accepts 500 UTF-8 bytes per segment. Keep words together
  // wherever possible and retain paragraph spacing for the calendar and web.
  const output:string[]=[];
  let chunk="";
  async function flush(){
    if(!chunk) return;
    const trimmed=chunk.trim();
    if(trimmed){
      const leading=chunk.length-chunk.trimStart().length;
      output.push(chunk.slice(0,leading)+await translateChunk(trimmed,from,language)+chunk.slice(leading+trimmed.length));
    }else output.push(chunk);
    chunk="";
  }
  for(const word of source.match(/[^\S\n]+|[^\s]+|\n+/gu)||[]){
    if(word.startsWith("\n")){await flush();output.push(word);continue;}
    if(Buffer.byteLength(chunk+word)>500) await flush();
    for(const letter of word){
      if(Buffer.byteLength(chunk+letter)>500) await flush();
      chunk+=letter;
    }
  }
  await flush();
  return output.join("");
}

export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const query=new URL(request.url).searchParams;
  const language=query.get("lang");
  if(language!=="cs" && language!=="en") return new Response(null,{status:400});
  const found=await lookupPublicEvent(id);
  if(found.status==="unavailable") return new Response(null,{status:503});
  if(found.status!=="found" || found.event.visibility!=="public") return new Response(null,{status:404});
  const event=found.event;
  try {
    const source=event.description||"";
    const curated=eventDescription(source,language);
    const [title,description]=await Promise.all([
      translate(event.title,language,source),
      query.get("detail")!=="1" ? null : curated!==source ? curated : translate(source,language,event.title)
    ]);
    return Response.json({title,description},{headers:{"Cache-Control":"no-store"}});
  } catch {
    return new Response(null,{status:503,headers:{"Cache-Control":"no-store"}});
  }
}
