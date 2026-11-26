import {unstable_cache} from "next/cache";
import {lookupPublicEvent} from "@/lib/public-events";
import {eventDescription} from "@/lib/czech-event-descriptions";

// Cache successful translations by the actual source text and destination language.
// An organizer's edit produces a different key immediately.
const translateChunk = unstable_cache(async (source:string, language:string) => {
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.search = new URLSearchParams({client:"gtx",sl:"auto",tl:language,dt:"t",q:source}).toString();
  const response = await fetch(url,{cache:"no-store",signal:AbortSignal.timeout(6500)});
  if (!response.ok) throw new Error("Translation unavailable");
  const data = await response.json();
  if (!Array.isArray(data?.[0])) throw new Error("Missing translation");
  const translated = data[0].map((part:unknown[]) => typeof part?.[0] === "string" ? part[0] : "").join("");
  if (!translated.trim()) throw new Error("Empty translation");
  return translated;
},["event-translation-v1"],{revalidate:60*60*24*30});

async function translate(source:string, language:string) {
  if (!source.trim()) return source;
  // Fit even non-ASCII text into a URL and keep paragraph breaks intact.
  const chunks = source.match(/[^\n]{1,450}(?:[^\S\n](?=[^\n])|(?=\n|$))|[^\n]{1,450}|\n+/gu) || [];
  const output:string[]=[];
  for (const chunk of chunks) {
    const content=chunk.trim();
    if(!content){output.push(chunk);continue;}
    const leading=chunk.length-chunk.trimStart().length;
    output.push(chunk.slice(0,leading)+await translateChunk(content,language)+chunk.slice(leading+content.length));
  }
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
      translate(event.title,language),
      query.get("detail")!=="1" ? null : curated!==source ? curated : translate(source,language)
    ]);
    return Response.json({title,description},{headers:{"Cache-Control":"no-store"}});
  } catch {
    return new Response(null,{status:503,headers:{"Cache-Control":"no-store"}});
  }
}
