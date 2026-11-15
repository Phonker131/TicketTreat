"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {getMyLoyalty,type ManualVisitAward} from "@/lib/api";
import {useLanguage} from "@/components/LanguageProvider";
export function ProfileAwards(){
 const {language}=useLanguage(),cs=language==="cs";
 const [awards,setAwards]=useState<ManualVisitAward[]|null>(null),[error,setError]=useState(false);
 useEffect(()=>{let active=true;getMyLoyalty().then(p=>{if(active)setAwards(p.awards||[])}).catch(()=>{if(active)setError(true)});return()=>{active=false}},[]);
 return <section className="panel"><h3>{cs?"Moje ocenění":"My achievements"}</h3>
 {error?<p role="alert">{cs?"Ocenění se nepodařilo načíst.":"Could not load achievements."}</p>:awards===null?<p role="status">{cs?"Načítání…":"Loading…"}</p>:awards.length===0?<p>{cs?"Po návštěvě akce vám pořadatel může udělit odznak nebo zvláštní odměnu.":"After attending an event, its organizer can award you a badge or special reward."}</p>:<div className="tt-award-passport-grid">{awards.map(a=><article className="tt-award-passport-item" key={a.id}><span className="tt-award-passport-icon" aria-hidden="true">✦</span><div><strong>{a.title}</strong><p>{a.event_title}</p>{a.description&&<p>{a.description}</p>}{a.note&&<p>{a.note}</p>}</div></article>)}</div>}
 <Link className="button button-outline" href="/loyalty">{cs?"Otevřít pas a všechny výhody":"Open passport and all benefits"}</Link></section>;
}
