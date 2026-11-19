"use client";
import Link from "next/link";
import {FormEvent,useEffect,useState} from "react";
import {AppHeader} from "@/components/AppHeader";
import {useLanguage} from "@/components/LanguageProvider";
import {getOrganizerSubscriptionRewards,saveOrganizerSubscriptionRewardLevels,
  type OrganizerSubscriptionRewardLevel,type OrganizerSubscriptionRewardPreview} from "@/lib/api";
import {userFacingError} from "@/lib/user-facing-errors";

const TIERS:OrganizerSubscriptionRewardLevel["tier"][]=["starter","bronze","silver","gold","platinum"];
const COPY={
 en:{title:"Organizer Rewards",intro:"The more verified events you host, the higher your potential subscription discount.",
  back:"Organizer dashboard",period:"Rolling last 3 calendar months",preview:"Preview only — TicketTreat organizer subscriptions and Stripe billing are not active. No money is charged and no discount is applied to a payment.",
  rules:"Only finished, non-cancelled events with at least one verified QR check-in count. Creating an event or collecting registrations alone does not count.",
  organization:"Organization",held:"Qualifying events",discount:"Potential discount",next:"Until next level",max:"Maximum level reached",progress:"Progress",levels:"Levels",threshold:"Events needed",save:"Save discount levels",saving:"Saving…",saved:"Discount preview levels saved. No billing changes were made.",refresh:"Refresh",empty:"No qualifying organizer account or events yet.",settings:"Global admin: set future discount thresholds",settingsNote:"These preview percentages are configurable, not a contract or an active subscription. Starter is always 0 events / 0%.",invalid:"Thresholds must strictly increase; discounts must not decrease and cannot exceed 80%."},
 cs:{title:"Odměny pro pořadatele",intro:"Čím více ověřených akcí uspořádáte, tím vyšší může být sleva na budoucí předplatné.",
  back:"Panel pořadatele",period:"Klouzavé období posledních 3 kalendářních měsíců",preview:"Pouze ukázka — předplatné pořadatelů ani platby Stripe zatím nejsou aktivní. Žádné peníze se nestrhávají a sleva se neuplatňuje na platby.",
  rules:"Počítají se jen dokončené a nezrušené akce s alespoň jedním ověřeným QR odbavením. Samotné vytvoření akce ani rezervace nestačí.",
  organization:"Pořadatel",held:"Započítané akce",discount:"Možná sleva",next:"Do další úrovně",max:"Nejvyšší úroveň",progress:"Postup",levels:"Úrovně",threshold:"Počet akcí",save:"Uložit úrovně slev",saving:"Ukládám…",saved:"Úrovně přehledu byly uloženy. Platby se nijak nezměnily.",refresh:"Obnovit",empty:"Zatím nejsou dostupné žádné akce pořadatele.",settings:"Hlavní administrátor: nastavení budoucích slev",settingsNote:"Procenta lze měnit; nejedná se o smluvní ani aktivní předplatné. Starter je vždy 0 akcí / 0 %.",invalid:"Prahy musí růst, slevy nesmí klesat a nesmí přesáhnout 80 %."},
};

export function OrganizerSubscriptionRewardsClient(){
 const {language}=useLanguage(),t=language==="cs"?COPY.cs:COPY.en;
 const [data,setData]=useState<OrganizerSubscriptionRewardPreview|null>(null);
 const [selected,setSelected]=useState<number|null>(null);
 const [edits,setEdits]=useState<OrganizerSubscriptionRewardLevel[]>([]);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 async function reload(){setLoading(true);setError("");
  try{const response=await getOrganizerSubscriptionRewards();setData(response);
   setSelected(current=>response.organizers.some(o=>o.owner_account_id===current)?current:response.organizers[0]?.owner_account_id??null);
   setEdits(response.levels.map(l=>({...l})));
  }catch(cause){setError(userFacingError(cause,language));}finally{setLoading(false);}}
 useEffect(()=>{void reload();},[]);
 const org=data?.organizers.find(o=>o.owner_account_id===selected);
 const valid=edits.length===TIERS.length&&edits.every((v,i)=>v.tier===TIERS[i]&&
   Number.isInteger(v.min_events)&&v.min_events>=0&&v.min_events<=10000&&
   Number.isInteger(v.discount_pct)&&v.discount_pct>=0&&v.discount_pct<=80&&
   (i===0?(v.min_events===0&&v.discount_pct===0):
    v.min_events>edits[i-1].min_events&&v.discount_pct>=edits[i-1].discount_pct));
 async function save(e:FormEvent){e.preventDefault();if(busy||!valid)return;
  setBusy(true);setError("");setNotice("");
  try{await saveOrganizerSubscriptionRewardLevels(edits);await reload();setNotice(t.saved);}
  catch(cause){setError(userFacingError(cause,language));}finally{setBusy(false);}}
 function update(i:number,key:"min_events"|"discount_pct",raw:string){
  setEdits(old=>old.map((v,j)=>i===j?{...v,[key]:raw===""?NaN:Number(raw)}:v));
 }
 const tierName=(tier:string)=>tier.charAt(0).toUpperCase()+tier.slice(1);
 const active=org?data?.levels.find(l=>l.tier===org.tier):null;
 const next=org?data?.levels.find(l=>l.tier===org.next_tier):null;
 const pct=org&&active&&next?(org.qualified_events-active.min_events)/(next.min_events-active.min_events)*100:org?100:0;
 return <div className="app-shell"><AppHeader/><main className="page tt-organizer-reward-page">
  <Link href="/admin" className="back-link">{t.back}</Link>
  <div className="section-heading"><div><h1>{t.title}</h1><p>{t.intro}</p></div>
   <button type="button" className="button button-outline" disabled={busy||loading} onClick={()=>void reload()}>{t.refresh}</button></div>
  <p className="state-card" role="status"><strong>{t.period}</strong> · {t.preview}</p>
  <p className="form-note">{t.rules}</p>
  {error&&<p className="state-card state-error" role="alert">{error}</p>}
  {notice&&<p className="success-banner" role="status">{notice}</p>}
  {loading?<div className="state-card">…</div>:data&&<>
   {data.organizers.length===0?<section className="panel">{t.empty}</section>:<>
    {data.organizers.length>1&&<section className="panel form-stack"><label>{t.organization}
     <select value={selected??""} onChange={e=>setSelected(Number(e.target.value))} disabled={busy}>
      {data.organizers.map(o=><option key={o.owner_account_id} value={o.owner_account_id}>{o.name} · #{o.owner_account_id}</option>)}
     </select></label></section>}
    {org&&<section className="panel form-stack" aria-label={t.progress}>
     <h2>{org.name} · {tierName(org.tier)}</h2>
     <div className="two-col"><p><strong>{org.qualified_events}</strong> {t.held.toLowerCase()}</p>
      <p><strong>{org.discount_pct}%</strong> {t.discount.toLowerCase()}</p></div>
     {next?<><label htmlFor="org-reward-progress">{t.next}: {org.events_to_next} / {next.min_events} · {tierName(next.tier)}</label>
       <progress id="org-reward-progress" style={{width:"100%"}} value={Math.max(0,Math.min(100,pct))} max={100}/></>:<p>{t.max}</p>}
    </section>}
   </>}
   <section className="panel form-stack"><h2>{t.levels}</h2>
    <div className="tt-reward-admin-grid">{data.levels.map(l=><div key={l.tier} className="state-card">
     <strong>{tierName(l.tier)}</strong><p>{l.min_events} {t.held.toLowerCase()}</p>
     <p><strong>{l.discount_pct}%</strong> {t.discount.toLowerCase()}</p></div>)}</div>
   </section>
   {data.editable&&<form className="panel form-stack" onSubmit={e=>void save(e)}>
    <h2>{t.settings}</h2><p className="form-note">{t.settingsNote}</p>
    {edits.map((l,i)=><div className="two-col" key={l.tier}>
     <label>{tierName(l.tier)} · {t.threshold}<input type="number" min={0} max={10000} step={1} required disabled={busy||i===0}
      value={Number.isNaN(l.min_events)?"":l.min_events} onChange={e=>update(i,"min_events",e.target.value)}/></label>
     <label>{tierName(l.tier)} · {t.discount} (%)<input type="number" min={0} max={80} step={1} required disabled={busy||i===0}
      value={Number.isNaN(l.discount_pct)?"":l.discount_pct} onChange={e=>update(i,"discount_pct",e.target.value)}/></label>
    </div>)}
    {!valid&&<p role="alert">{t.invalid}</p>}
    <button className="button button-primary" disabled={!valid||busy}>{busy?t.saving:t.save}</button>
   </form>}
  </>}
 </main></div>;
}
