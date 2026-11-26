"use client";
import {useEffect,useState} from "react";
import {useLanguage} from "@/components/LanguageProvider";
import type {TicketTreatEvent} from "./types";
import {eventDescription} from "./czech-event-descriptions";

type Copy={title:string;description:string|null};
const requests=new Map<string,Promise<Copy>>();

export function useEventTranslation(event:TicketTreatEvent|null,detail=false,enabled=true){
  const {language}=useLanguage();
  const id=event?.id;
  const title=event?.title||"";
  const source=detail ? event?.description||"" : "";
  const eligible=enabled && event?.visibility!=="link_only" && event?.publication?.visible!==false;
  const key=JSON.stringify([id,language,title,source,detail]);
  const [result,setResult]=useState<{key:string;copy:Copy}|null>(null);
  useEffect(()=>{
    if(!eligible || !id || (language!=="en" && language!=="cs")) return;
    let live=true;
    let task=requests.get(key);
    if(!task){
      task=fetch(`/api/events/${id}/translation?lang=${language}&detail=${detail?1:0}`).then(async response=>{
        if(!response.ok) throw new Error("Translation unavailable");
        return await response.json() as Copy;
      });
      requests.set(key,task);
      if(requests.size>256) requests.delete(requests.keys().next().value!);
    }
    task.then(copy=>{if(live)setResult({key,copy});}).catch(()=>{if(requests.get(key)===task)requests.delete(key);});
    return ()=>{live=false;};
  },[detail,eligible,id,key,language]);
  return eligible && result?.key===key ? result.copy : {title,description:eventDescription(source,language)};
}

export function EventTitle({event}:{event:TicketTreatEvent}){
  return <>{useEventTranslation(event).title}</>;
}
