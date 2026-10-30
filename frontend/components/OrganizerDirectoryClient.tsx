"use client";
import Link from "next/link";
import {AppHeader} from "@/components/AppHeader";
import {useLanguage} from "@/components/LanguageProvider";
import type {OrganizerPublicSummary,LanguageCode} from "@/lib/types";

const W:Record<LanguageCode,{title:string;intro:string;empty:string;view:string}>={
 ru:{title:"Организаторы",intro:"Познакомься с организаторами мероприятий TicketTreat и найди их будущие и прошедшие события.",empty:"Публичные профили появятся здесь, когда организаторы опубликуют их.",view:"Открыть профиль"},
 uk:{title:"Організатори",intro:"Познайомся з організаторами подій TicketTreat та знайди майбутні й минулі заходи.",empty:"Публічні профілі з’являться, коли організатори опублікують їх.",view:"Відкрити профіль"},
 cs:{title:"Pořadatelé",intro:"Poznejte pořadatele na TicketTreat a prohlédněte si jejich nadcházející i proběhlé akce.",empty:"Veřejné profily se zobrazí, jakmile je pořadatelé zveřejní.",view:"Zobrazit profil"},
 en:{title:"Organizers",intro:"Meet TicketTreat event organizers and explore their upcoming and past events.",empty:"Public profiles will appear when organizers publish them.",view:"View profile"}
};
export function OrganizerDirectoryClient({profiles}:{profiles:OrganizerPublicSummary[]}){
 const {language}=useLanguage(),t=W[language];
 return <div className="app-shell"><AppHeader/><main className="page tt-organizer-directory">
   <h1>{t.title}</h1><p className="form-note">{t.intro}</p>
   {profiles.length?<div className="tt-organizer-directory-grid">
     {profiles.map(p=><Link href={`/organizers/${p.slug}`} className="panel tt-organizer-directory-card" key={p.slug}>
       <div className="tt-organizer-directory-logo">
         {p.logo_url?<img src={p.logo_url} alt="" loading="lazy"/>:p.display_name.slice(0,2).toUpperCase()}
       </div>
       <h2>{p.display_name}</h2>
       {p.city&&<p>📍 {p.city}</p>}
       <p>{p.bio.slice(0,180)}</p>
       <strong className="tt-organizer-link">{t.view} ↗</strong>
     </Link>)}
   </div>:<div className="state-card">{t.empty}</div>}

 </main></div>;
}
