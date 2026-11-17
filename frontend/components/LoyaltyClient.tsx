"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {AppHeader} from "@/components/AppHeader";
import {RewardsPreview} from "@/components/premium/RewardsPreview";
import {RewardsRules,RewardsTrack,levelName,progressLine,rewardsCopy} from "@/components/premium/RewardsTrack";
import {useLanguage} from "@/components/LanguageProvider";
import {getMyLoyalty,type LoyaltyPassport,type LoyaltyStudio} from "@/lib/api";
import {restoreGuest} from "@/lib/session";
import type {LanguageCode} from "@/lib/types";
import {PageFaq} from "@/components/premium/PageFaq";

export function PassportCard({studio,language}:{studio:LoyaltyStudio;language:LanguageCode}){
 return <section className="panel tt-rw-card tt-rw-studio">
  <div className="tt-rw-studio-head">
   <div><h2>{studio.organizer_name}</h2><p className="tt-rw-progress">{progressLine(language,studio.season_visits)}</p></div>
   <strong className={"loyalty-badge loyalty-"+studio.tier}>{levelName(language,studio.season_visits)}</strong>
   {studio.promotional_vip&&<span className="tt-promo-vip-label">VIP promo</span>}
  </div>
  <RewardsTrack language={language} visits={studio.season_visits} tierRewards={studio.tier_rewards}/>
 </section>;
}
export function LoyaltyClient(){
 const {language}=useLanguage();
 const [passport,setPassport]=useState<LoyaltyPassport|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(true);
 useEffect(()=>{let live=true;(async()=>{
   try{const guest=await restoreGuest();if(guest){const result=await getMyLoyalty();if(live)setPassport(result);}}
   catch(e){if(live)setError(e instanceof Error?e.message:"Could not load loyalty passport");}
   finally{if(live)setLoading(false);}
 })();return()=>{live=false};},[]);
 return <div className="app-shell"><AppHeader/><main className="page">
  <Link href="/" className="back-link">{language==="ru"?"Ивенты":language==="cs"?"Události":language==="uk"?"Події":"Events"}</Link>
  <div className={"section-heading"+(!loading&&!error&&(!passport||passport.studios.length===0)?" sr-only":"")}><div><h1>{rewardsCopy[language].title}</h1><p>{rewardsCopy[language].lead}</p></div></div>
  {loading?<div className="state-card" role="status">…</div>:error?<div className="state-card state-error" role="alert">{error}</div>:
  !passport?<RewardsPreview language={language} mode="guest"/>:
  <>
   {passport.studios.length===0?<RewardsPreview language={language} mode="empty"/>:
   <><div className="loyalty-grid tt-rw-grid">{passport.studios.map(s=><PassportCard key={s.organizer_id} studio={s} language={language}/>)}</div>
   <RewardsRules language={language}/></>}
   {(passport.campaign_perks?.length||0)>0&&<section className="panel tt-promo-passport">
     <h2>{language==="cs"?"Výhody z kampaní":"Promotional benefits"}</h2>
     <div className="tt-promo-passport-grid">{passport.campaign_perks!.map(p=><article className="tt-promo-passport-item" key={p.id}>
       <strong>{p.reward_title}</strong><span>{p.organizer_name}</span>
       {p.reward_details&&<p>{p.reward_details}</p>}
       {p.benefit_expires_at&&<p>{language==="cs"?"Platí do: ":"Valid until: "}{new Date(p.benefit_expires_at).toLocaleDateString(language==="cs"?"cs-CZ":"en-GB")}</p>}
     </article>)}</div>
     <p className="form-note">{language==="cs"?"Tyto bonusy nezvyšují počet QR návštěv ani věrnostní úroveň.":"These bonuses do not increase QR visits or the attendance-based loyalty tier."}</p>
   </section>}
   {(passport.awards?.length||0)>0&&<section className="panel tt-guest-manual-awards" aria-label={language==="cs"?"Ocenění od pořadatelů":language==="en"?"Organizer awards":language==="ru"?"Награды от организаторов":"Нагороди від організаторів"}>
     <h2>{language==="cs"?"Ocenění od pořadatelů":language==="en"?"Awards from organizers":language==="ru"?"Награды от организаторов":"Нагороди від організаторів"}</h2>
     <div className="tt-award-passport-grid">{passport.awards!.map(a=><article key={a.id} className="tt-award-passport-item">
       <span aria-hidden="true" className="tt-award-passport-icon">✦</span>
       <div><strong>{a.title}</strong><p className="form-note">{a.event_title}</p>
         {a.description&&<p>{a.description}</p>}
         {a.note&&<p className="form-note">{a.note}</p>}</div>
     </article>)}</div>
   </section>}
  </>}
<PageFaq topic="rewards"/>
 </main></div>;
}
