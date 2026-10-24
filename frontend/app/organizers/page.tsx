import type {Metadata} from "next";
import Link from "next/link";
import {AppHeader} from "@/components/AppHeader";
import {publicOrganizers} from "@/lib/public-organizers";
export const dynamic="force-dynamic";
export const metadata:Metadata={
  title:"Организаторы мероприятий в Чехии",
  description:"Познакомьтесь с организаторами событий на TicketTreat, изучите их профили и предстоящие мероприятия.",
  alternates:{canonical:"/organizers"}
};
export default async function OrganizersPage(){
  const profiles=await publicOrganizers();
  return <div className="app-shell"><AppHeader/><main className="page tt-organizer-directory">
    <h1>Организаторы / Organizers</h1>
    <p className="form-note">Откройте публичные страницы организаторов и найдите их мероприятия.</p>
    {profiles.length?<div className="tt-organizer-directory-grid">
      {profiles.map(p=><Link href={`/organizers/${p.slug}`} className="panel tt-organizer-directory-card" key={p.slug}>
        <div className="tt-organizer-directory-logo">
          {p.logo_url?<img src={p.logo_url} alt="" loading="lazy"/>:p.display_name.slice(0,2).toUpperCase()}
        </div>
        <h2>{p.display_name}</h2>
        {p.city&&<p>📍 {p.city}</p>}
        <p>{p.bio.slice(0,180)}</p>
      </Link>)}
    </div>:<div className="state-card">Публичные профили организаторов появятся здесь после публикации.</div>}
  </main></div>;
}
