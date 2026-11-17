"use client";
import Link from "next/link";
import {FormEvent,useEffect,useState} from "react";
import {AppHeader} from "@/components/AppHeader";
import {useLanguage} from "@/components/LanguageProvider";
import {getOrganizerLoyaltyTiers,updateOrganizerLoyaltyTier,
  type OrganizerLoyaltyTiers,type OrganizerTierBenefit} from "@/lib/api";
import {userFacingError} from "@/lib/user-facing-errors";

const copy={
  en:{title:"Organizer loyalty rewards",intro:"Earned automatically by visiting one organizer, not issued for individual events.",back:"Organizer dashboard",refresh:"Refresh",org:"Organizer",edit:"Edit reward",save:"Save changes",cancel:"Cancel",saving:"Saving…",nameEn:"Reward (English)",nameCs:"Reward (Czech)",detailsEn:"Details (English)",detailsCs:"Details (Czech)",active:"Enable waitlist priority",live:"Active",soon:"Coming soon",paused:"Paused",levels:["Newcomer","Regular","Insider","VIP"],visits:"verified visits per quarter",rules:"Only QR-confirmed visits count, separately for each organizer. Counts reset every calendar quarter.",limitations:"Waitlist priority is operational. Early registration and companion admission are not implemented in booking yet; editing their descriptions does not activate those benefits.",saved:"Loyalty reward updated.",none:"No organizer events found. Create an event under your organizer account first."},
  cs:{title:"Věrnostní odměny pořadatele",intro:"Host je získává automaticky za návštěvy jednoho pořadatele, nikoli za jednotlivé akce.",back:"Panel pořadatele",refresh:"Obnovit",org:"Pořadatel",edit:"Upravit odměnu",save:"Uložit změny",cancel:"Zrušit",saving:"Ukládám…",nameEn:"Odměna (anglicky)",nameCs:"Odměna (česky)",detailsEn:"Popis (anglicky)",detailsCs:"Popis (česky)",active:"Zapnout přednost na čekací listině",live:"Aktivní",soon:"Připravujeme",paused:"Pozastaveno",levels:["Nováček","Stálý host","Insider","VIP"],visits:"ověřených návštěv za čtvrtletí",rules:"Počítají se pouze návštěvy potvrzené QR odbavením, pro každého pořadatele zvlášť. Každé čtvrtletí se počet vynuluje.",limitations:"Přednost na čekací listině již funguje. Dřívější registrace a doprovod zatím nejsou implementovány v rezervacích; změna jejich popisu je nezapne.",saved:"Věrnostní odměna byla upravena.",none:"Nemáte zatím žádné vlastní akce. Nejdříve vytvořte akci pořadatele."},
};

export function OrganizerLoyaltyTiersClient(){
 const {language}=useLanguage(),t=language==="cs"?copy.cs:copy.en;
 const [data,setData]=useState<OrganizerLoyaltyTiers|null>(null),[ownerId,setOwnerId]=useState<number|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [editing,setEditing]=useState<OrganizerTierBenefit["tier"]|null>(null),[en,setEn]=useState(""),[cs,setCs]=useState(""),[descriptionEn,setDescriptionEn]=useState(""),[descriptionCs,setDescriptionCs]=useState(""),[priority,setPriority]=useState(true);
 async function reload(){
  setLoading(true);setError("");
  try{const next=await getOrganizerLoyaltyTiers();setData(next);
   setOwnerId(id=>next.organizers.some(o=>o.owner_account_id===id)?id:next.organizers[0]?.owner_account_id??null);
  }catch(cause){setError(userFacingError(cause,language));}finally{setLoading(false);}
 }
 useEffect(()=>{void reload();},[]);
 const org=data?.organizers.find(o=>o.owner_account_id===ownerId);
 function edit(b:OrganizerTierBenefit){setEditing(b.tier);setEn(b.label_en);setCs(b.label_cs);setDescriptionEn(b.description_en||"");setDescriptionCs(b.description_cs||"");setPriority(b.enabled);setError("");setNotice("");}
 async function save(e:FormEvent<HTMLFormElement>,b:OrganizerTierBenefit){
  e.preventDefault();if(ownerId===null||busy||en.trim().length<3||cs.trim().length<3)return;
  setBusy(true);setError("");setNotice("");
  try{await updateOrganizerLoyaltyTier(ownerId,b.tier,{label_en:en.trim(),label_cs:cs.trim(),description_en:descriptionEn.trim(),description_cs:descriptionCs.trim(),...(b.editable_enabled?{priority_enabled:priority}:{})});
   const next=await getOrganizerLoyaltyTiers();setData(next);setEditing(null);setNotice(t.saved);
  }catch(cause){setError(userFacingError(cause,language));}finally{setBusy(false);}
 }
 return <div className="app-shell"><AppHeader/><main className="page tt-reward-admin">
  <Link href="/admin" className="back-link">{t.back}</Link>
  <div className="section-heading"><div><h1>{t.title}</h1><p>{t.intro}</p></div>
   <button type="button" className="button button-outline" disabled={busy||loading} onClick={()=>void reload()}>{t.refresh}</button></div>
  {error&&<div role="alert" className="state-card state-error">{error}</div>}
  {notice&&<p role="status" className="success-banner">{notice}</p>}
  {loading?<div className="state-card" role="status">…</div>:data&&<>
   {data.organizers.length===0?<section className="panel"><p>{t.none}</p></section>:<>
    <section className="panel"><label htmlFor="tt-loyalty-organizer-select">{t.org}</label><select id="tt-loyalty-organizer-select" value={ownerId??""} onChange={e=>{setOwnerId(Number(e.target.value));setEditing(null);setNotice("");}}>
     {data.organizers.map(o=><option key={o.owner_account_id} value={o.owner_account_id}>{o.name}</option>)}
    </select><p className="form-note">{t.rules}</p></section>
    <div className="tt-reward-admin-grid">{org?.tiers.map((b,i)=><section key={`${ownerId}-${b.tier}`} className="panel form-stack">
     <h2>{t.levels[i]}</h2><p className="form-note">{b.required_visits} {t.visits}</p>
     <span className={`status ${b.enabled?"status-success":"status-demo"}`}>{b.enabled?t.live:b.operational?t.paused:t.soon}</span>
     {editing===b.tier?<form className="form-stack tt-reward-tier-form" onSubmit={e=>void save(e,b)}>
      <label>{t.nameEn}<input value={en} required minLength={3} maxLength={100} onChange={e=>setEn(e.target.value)}/></label>
      <label>{t.nameCs}<input value={cs} required minLength={3} maxLength={100} onChange={e=>setCs(e.target.value)}/></label>
      <label>{t.detailsEn}<textarea value={descriptionEn} maxLength={300} rows={2} onChange={e=>setDescriptionEn(e.target.value)}/></label>
      <label>{t.detailsCs}<textarea value={descriptionCs} maxLength={300} rows={2} onChange={e=>setDescriptionCs(e.target.value)}/></label>
      {b.editable_enabled&&<label className="tt-reward-edit-toggle"><input type="checkbox" checked={priority} onChange={e=>setPriority(e.target.checked)}/>{t.active}</label>}
      <div className="admin-event-actions"><button className="button button-primary" type="submit" disabled={busy||en.trim().length<3||cs.trim().length<3}>{busy?t.saving:t.save}</button>
       <button className="button button-outline" type="button" disabled={busy} onClick={()=>setEditing(null)}>{t.cancel}</button></div>
     </form>:<><p>{language==="cs"?b.label_cs:b.label_en}</p>{(language==="cs"?b.description_cs:b.description_en)&&<p className="form-note">{language==="cs"?b.description_cs:b.description_en}</p>}<button type="button" className="button button-outline" disabled={busy} onClick={()=>edit(b)}>{t.edit}</button></>}
    </section>)}</div><p className="form-note">{t.limitations}</p>
   </>}
  </>}
 </main></div>;
}
