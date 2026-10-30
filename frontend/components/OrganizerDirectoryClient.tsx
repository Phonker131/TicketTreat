"use client";
import Link from "next/link";
import {AppHeader} from "@/components/AppHeader";
import {useLanguage} from "@/components/LanguageProvider";
import type {OrganizerPublicSummary,LanguageCode} from "@/lib/types";

const W:Record<LanguageCode,{title:string;intro:string;empty:string;view:string;future:string;futureHint:string;example:string}>={
 ru:{title:"Организаторы",intro:"Познакомься с организаторами мероприятий TicketTreat и найди их будущие и прошедшие события.",empty:"Публичные профили появятся здесь, когда организаторы опубликуют их.",view:"Открыть профиль",future:"Здесь будет профиль",futureHint:"Он появится, когда организатор его опубликует.",example:"Пример"},
 uk:{title:"Організатори",intro:"Познайомся з організаторами подій TicketTreat та знайди майбутні й минулі заходи.",empty:"Публічні профілі з’являться, коли організатори опублікують їх.",view:"Відкрити профіль",future:"Тут буде профіль",futureHint:"Він з’явиться, коли організатор його опублікує.",example:"Приклад"},
 cs:{title:"Pořadatelé",intro:"Poznejte pořadatele na TicketTreat a prohlédněte si jejich nadcházející i proběhlé akce.",empty:"Veřejné profily se zobrazí, jakmile je pořadatelé zveřejní.",view:"Zobrazit profil",future:"Zde bude profil",futureHint:"Zobrazí se, až jej pořadatel zveřejní.",example:"Příklad"},
 en:{title:"Organizers",intro:"Meet TicketTreat event organizers and explore their upcoming and past events.",empty:"Public profiles will appear when organizers publish them.",view:"View profile",future:"A profile will appear here",futureHint:"It appears when an organizer publishes it.",example:"Example"}
};
export function OrganizerDirectoryClient({profiles}:{profiles:OrganizerPublicSummary[]}){
 const {language}=useLanguage(),t=W[language];
 return <div className="app-shell"><AppHeader/><main className="page tt-organizer-directory">
   <h1>{t.title}</h1><p className="form-note">{t.intro}</p>
   <div className="tt-organizer-directory-grid">
     {profiles.map(p=><Link href={`/organizers/${p.slug}`} className="panel tt-organizer-directory-card" key={p.slug}>
       <div className="tt-organizer-directory-logo">
         {p.logo_url?<img src={p.logo_url} alt="" loading="lazy"/>:p.display_name.slice(0,2).toUpperCase()}
       </div>
       <h2>{p.display_name}</h2>
       {p.city&&<p>📍 {p.city}</p>}
       <p>{p.bio.slice(0,180)}</p>
       <strong className="tt-organizer-link">{t.view} ↗</strong>
     </Link>)}
     {[0,1].map((n)=><div key={"future-"+n} className="panel tt-organizer-ghost" aria-label={t.future}>
       <span className="tt-example-stamp">{t.example}</span>
       <div className="tt-organizer-ghost-mark" aria-hidden="true">+</div>
       <h2>{t.future}</h2><p>{t.futureHint}</p>
     </div>)}
   </div>
   {!profiles.length&&<p className="form-note">{t.empty}</p>}

 </main></div>;
}
