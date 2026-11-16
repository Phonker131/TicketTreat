"use client";
import Link from "next/link";
import {useEffect,useState,type FormEvent} from "react";
import {AppHeader} from "@/components/AppHeader";
import {useLanguage} from "@/components/LanguageProvider";
import {getPublicPromotions,getMyPromotions,claimInstagramPromotion,type Promotion} from "@/lib/api";
import {userFacingError} from "@/lib/user-facing-errors";
const copy={
 en:{title:"Special offers",intro:"Limited-time campaigns from organizers.",loading:"Loading offers…",
   empty:"There are no live promotions right now.",back:"Discover events",expires:"Offer ends",
   reward:"Reward",signup:"Create an account",event:"Register for event",instagram:"Open Instagram",
   username:"Your Instagram username",claim:"Submit for review",claimed:"Submitted for manual verification.",
   pending:"Pending manual review",earned:"Qualified, see your guest passport",approved:"Approved, see your guest passport",
   rejected:"Submission not approved",disclaimer:"TicketTreat does not verify Instagram follows automatically. The organizer must check your username before approving the reward.",
   notVerified:"Sign in to TicketTreat first to submit a claim.",sending:"Sending…",passport:"My rewards"},
 cs:{title:"Speciální nabídky",intro:"Časově omezené kampaně pořadatelů.",loading:"Načítání nabídek…",
   empty:"Právě neprobíhá žádná akce.",back:"Procházet akce",expires:"Akce končí",
   reward:"Odměna",signup:"Vytvořit účet",event:"Přihlásit se na akci",instagram:"Otevřít Instagram",
   username:"Váš instagramový účet",claim:"Odeslat k ověření",claimed:"Odesláno k ručnímu ověření.",
   pending:"Čeká na ruční kontrolu",earned:"Splněno, viz pas hosta",approved:"Schváleno, viz pas hosta",
   rejected:"Žádost nebyla schválena",disclaimer:"TicketTreat nesleduje Instagram automaticky. Pořadatel musí váš účet před schválením odměny ověřit.",
   notVerified:"Nejprve se přihlaste do TicketTreat.",sending:"Odesílám…",passport:"Moje odměny"}
} as const;
function formatDate(s:string,lang:"cs"|"en"){const date=new Date(s);return new Intl.DateTimeFormat(lang==="cs"?"cs-CZ":"en-GB",
 {dateStyle:"medium",timeStyle:"short"}).format(date);}
export function PromotionsClient(){
 const {language}=useLanguage(),lang=language==="cs"?"cs":"en",t=copy[lang];
 const [promos,setPromos]=useState<Promotion[]>([]);
 const [mine,setMine]=useState<Promotion[]>([]);
 const [username,setUsername]=useState<Record<number,string>>({});
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState<number|null>(null);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 async function reload(){
   try{
    const publicData=await getPublicPromotions();
    setPromos(publicData.campaigns);
    try{setMine((await getMyPromotions()).campaigns)}
    catch{/* Public discovery must remain available when logged out. */}
   }catch(e){setError(userFacingError(e,language))}
   finally{setLoading(false)}
 }
 useEffect(()=>{void reload()},[]);
 async function submit(e:FormEvent<HTMLFormElement>,id:number){
  e.preventDefault();setError("");setNotice("");setBusy(id);
  try{await claimInstagramPromotion(id,username[id]||"");setNotice(t.claimed);await reload()}
  catch(e){setError(userFacingError(e,language))}
  finally{setBusy(null)}
 }
 return <div className="app-shell"><AppHeader/><main className="page tt-promo-page">
  <Link href="/" className="back-link">{t.back}</Link>
  <div className="section-heading"><div><h1>{t.title}</h1><p>{t.intro}</p></div></div>
  {error&&<div role="alert" className="state-card state-error">{error}</div>}
  {notice&&<p role="status" className="success-banner">{notice}</p>}
  {loading?<div className="state-card">{t.loading}</div>:
   promos.length===0?<div className="panel form-stack"><p>{t.empty}</p><Link href="/" className="button button-primary">{t.back}</Link></div>:
   <div className="tt-promo-cards">
    {promos.map(p=>{
     const own=mine.find(m=>m.id===p.id);
     return <article key={p.id} className="panel tt-promo-card">
      <small className="tt-promo-kicker">{p.organizer_name}</small>
      <h2>{p.title}</h2>
      <p>{p.description}</p>
      <div className="tt-promo-metrics">
       <span><strong>{t.reward}:</strong> {p.reward_title}</span>
       <span><strong>{t.expires}:</strong> {formatDate(p.ends_at,lang)}</span>
       {p.reward_details&&<span>{p.reward_details}</span>}
      </div>
      {own?.participation==="earned"||own?.participation==="approved"?
       <div className="tt-promo-claim-status"><strong>{own.participation==="earned"?t.earned:t.approved}</strong>
        <p><Link href="/loyalty">{t.passport}</Link></p></div>:
       own?.participation==="pending"?<p className="tt-promo-claim-status">{t.pending}</p>:
       own?.participation==="rejected"?<p className="tt-promo-claim-status">{t.rejected}</p>:null}
      <div className="tt-promo-actions">
       {p.trigger==="account_signup"&&<Link href="/login" className="button button-primary">{t.signup}</Link>}
       {p.trigger==="event_booking"&&p.event_id&&<Link href={"/events/"+p.event_id} className="button button-primary">{t.event}</Link>}
       {p.trigger==="instagram_follow"&&<a className="button button-primary" href={p.instagram_url}
        target="_blank" rel="noopener noreferrer">{t.instagram}</a>}
      </div>
      {p.trigger==="instagram_follow"&&!(own?.participation==="approved"||own?.participation==="pending"||own?.participation==="rejected")&&
       <form className="tt-promo-claim-form" onSubmit={e=>void submit(e,p.id)}>
        <label>{t.username}<input required minLength={2} maxLength={30}
          placeholder="@yourprofile" value={username[p.id]||""}
          onChange={e=>setUsername(all=>({...all,[p.id]:e.target.value}))}/></label>
        <button type="submit" disabled={busy!==null} className="button button-outline">{busy===p.id?t.sending:t.claim}</button>
        <p className="form-note">{t.disclaimer} <Link href="/login">{t.notVerified}</Link></p>
       </form>}
     </article>;
    })}
   </div>}
 </main></div>;
}
