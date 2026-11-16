"use client";
import {useEffect,useState} from "react";
import {getMyLoyalty,type LoyaltyPassport} from "@/lib/api";
import {useLanguage} from "@/components/LanguageProvider";
import {PassportCard} from "@/components/LoyaltyClient";

export function ProfileAwards(){
 const {language}=useLanguage(),cs=language==="cs";
 const [passport,setPassport]=useState<LoyaltyPassport|null>(null);
 const [loading,setLoading]=useState(true),[error,setError]=useState(false),[attempt,setAttempt]=useState(0);
 useEffect(()=>{
   let active=true;setLoading(true);setError(false);
   getMyLoyalty().then(p=>{if(active)setPassport(p)}).catch(()=>{if(active)setError(true)}).finally(()=>{if(active)setLoading(false)});
   return()=>{active=false};
 },[attempt]);
 if(loading)return <div className="state-card" role="status">{cs?"Načítání ocenění…":"Loading achievements…"}</div>;
 if(error||!passport)return <div className="state-card state-error" role="alert">
   <p>{cs?"Ocenění se nepodařilo načíst.":"Could not load achievements."}</p>
   <button type="button" className="button button-outline" onClick={()=>setAttempt(n=>n+1)}>{cs?"Zkusit znovu":"Try again"}</button>
 </div>;
 const awards=passport.awards||[],perks=passport.campaign_perks||[];
 return <div className="form-stack">
   <section className="panel">
     <h2>{cs?"Speciální ocenění":"Special achievements"} ({awards.length})</h2>
     {awards.length===0?<p>{cs?"Zatím vám nebylo uděleno žádné speciální ocenění. Pořadatel je může udělit po potvrzeném QR odbavení. Udělené odznaky a odměny se zobrazí přímo zde.":"You have not received any special achievements yet. Organizers can award them after a confirmed QR check-in. Your badges and rewards will appear right here."}</p>:
     <div className="tt-award-passport-grid">{awards.map(a=><article className="tt-award-passport-item" key={a.id}>
       <span className="tt-award-passport-icon" aria-hidden="true">✦</span>
       <div><strong>{a.title}</strong><p className="form-note">{a.kind==="badge"?(cs?"Odznak":"Badge"):a.kind==="perk"?(cs?"Zvláštní výhoda":"Special benefit"):(cs?"Ocenění":"Recognition")}</p>
       {a.event_title&&<p>{a.event_title}</p>}{a.description&&<p>{a.description}</p>}{a.note&&<p>{a.note}</p>}</div>
     </article>)}</div>}
   </section>
   <section className="panel">
     <h2>{cs?"Bonusy z akcí a kampaní":"Promotional rewards"} ({perks.length})</h2>
     {perks.length===0?<p className="form-note">{cs?"Zatím nemáte žádné bonusy z kampaní.":"You have no promotional rewards yet."}</p>:
     <div className="tt-promo-passport-grid">{perks.map(p=><article className="tt-promo-passport-item" key={p.id}>
       <strong>{p.reward_title}</strong><p>{p.organizer_name}</p>{p.reward_details&&<p>{p.reward_details}</p>}
       {p.benefit_expires_at&&<p>{cs?"Platí do: ":"Valid until: "}{new Date(p.benefit_expires_at).toLocaleDateString(cs?"cs-CZ":"en-GB")}</p>}
     </article>)}</div>}
   </section>
   <section aria-label={cs?"Úrovně za návštěvy":"Attendance levels"}>
     <h2>{cs?"Úrovně za návštěvy":"Attendance levels"}</h2>
     <p className="form-note">{cs?"Úrovně se počítají za QR návštěvy zvlášť u každého pořadatele v rámci čtvrtletí. Speciální ocenění ani bonusy nezvyšují počet návštěv.":"Levels count QR check-ins separately for each organizer, each quarter. Special achievements and promotional rewards do not add check-ins."}</p>
     {passport.studios.length>0?<div className="loyalty-grid">{passport.studios.map(s=><PassportCard key={s.organizer_id} studio={s} language={language}/>)}</div>:
     <p>{cs?"Váš pas a postup se objeví po registraci na akci pořadatele.":"Your passport and progress will appear after you register for an organizer’s event."}</p>}
   </section>
 </div>;
}
