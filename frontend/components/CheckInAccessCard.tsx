"use client";

import Link from "next/link";
import {useEffect,useState} from "react";
import {getCheckinAccess,type CheckinAccess} from "@/lib/api";
import {getWebToken} from "@/lib/session";
import {useLanguage} from "@/components/LanguageProvider";

const COPY={
  en:{title:"Your ticket check-in access",intro:"An organizer assigned you to scan tickets at these events. This does not grant organizer or guest-list access.",open:"Open scanner",all:"Global administrator check-in access",date:"Start (Prague time)"},
  cs:{title:"Přístup ke kontrole vstupenek",intro:"Pořadatel vám povolil skenovat vstupenky na těchto akcích. Nejde o přístup ke správě akce ani seznamu hostů.",open:"Otevřít skener",all:"Přístup hlavního administrátora",date:"Začátek (pražský čas)"},
  ru:{title:"Доступ к проверке билетов",intro:"Организатор назначил тебя проверять билеты на этих мероприятиях. Управление событием и список гостей недоступны.",open:"Открыть сканер",all:"Доступ главного администратора",date:"Начало (время Праги)"},
  uk:{title:"Доступ до перевірки квитків",intro:"Організатор призначив вас сканувати квитки на цих подіях. Керування подією та список гостей недоступні.",open:"Відкрити сканер",all:"Доступ головного адміністратора",date:"Початок (час Праги)"},
};

export function CheckInAccessCard(){
  const {language}=useLanguage(),copy=COPY[language];
  const [access,setAccess]=useState<CheckinAccess|null>(null);
  useEffect(()=>{
    let active=true;
    const refresh=()=>{
      if(document.visibilityState==="hidden")return;
      const token=getWebToken();
      if(!token){if(active)setAccess(null);return;}
      getCheckinAccess(token).then(result=>{if(active)setAccess(result);})
        .catch(()=>{if(active)setAccess(null);});
    };
    refresh();
    const interval=window.setInterval(refresh,60000);
    document.addEventListener("visibilitychange",refresh);
    return()=>{active=false;window.clearInterval(interval);document.removeEventListener("visibilitychange",refresh);};
  },[]);
  if(!access||(access.events.length===0&&!access.can_scan_all))return null;
  return <section className="panel form-stack tt-checkin-access-card" aria-label={copy.title}>
    <h3>{copy.title}</h3><p className="form-note">{copy.intro}</p>
    {access.can_scan_all&&<p className="form-note">{copy.all}</p>}
    {access.events.map(event=><div className="participant-row" key={event.id}>
      <div><strong>{event.title}</strong>
        <small>{event.starts_at?copy.date+": "+event.starts_at.slice(0,16).replace("T"," "):""}
          {event.location?" · "+event.location:""}</small></div>
      <Link className="button button-primary" href={"/admin/check-in?event="+event.id}>{copy.open}</Link>
    </div>)}
    {access.can_scan_all&&<Link href="/admin/check-in" className="button button-outline">{copy.open}</Link>}
  </section>;
}
