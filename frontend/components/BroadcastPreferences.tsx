"use client";
import {useEffect,useState} from "react";
import {getBroadcastPreferences,saveBroadcastPreferences,type BroadcastPreferencesData} from "@/lib/api";
import {useLanguage} from "@/components/LanguageProvider";
import {userFacingError} from "@/lib/user-facing-errors";

export function BroadcastPreferences(){
 const {language}=useLanguage(),cs=language==="cs";
 const [value,setValue]=useState<BroadcastPreferencesData|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState(""),[saved,setSaved]=useState(false),[attempt,setAttempt]=useState(0);
 useEffect(()=>{let live=true;setLoading(true);setError("");
   getBroadcastPreferences().then(data=>{if(live)setValue(data)})
    .catch(e=>{if(live)setError(userFacingError(e,language))})
    .finally(()=>{if(live)setLoading(false)});
   return()=>{live=false};
 },[attempt,language]);
 async function save(e:React.FormEvent){e.preventDefault();if(!value||busy)return;
   setBusy(true);setError("");setSaved(false);
   try{setValue(await saveBroadcastPreferences(value));setSaved(true)}
   catch(e){setError(userFacingError(e,language))}
   finally{setBusy(false)}
 }
 return <section className="panel form-stack">
   <h2>{cs?"Rozesílky":"Broadcasts"}</h2>
   <p>{cs?"Vyberte, kde chcete přijímat hromadné zprávy od TicketTreat a pořadatelů. Vypnutím rozesílek přes Telegram se vypnou také upozornění na nové akce.":"Choose where to receive bulk messages from TicketTreat and organizers. Turning off Telegram broadcasts also turns off new event notifications."}</p>
   {error&&<div className="state-card state-error" role="alert">{error}</div>}
   {loading?<p role="status">{cs?"Načítání…":"Loading…"}</p>:value?<form className="form-stack" onSubmit={save}>
     <label style={{display:"flex",alignItems:"center",gap:12}}><input style={{width:"auto"}} type="checkbox" checked={value.email_enabled} disabled={busy} onChange={e=>{setValue({...value,email_enabled:e.target.checked});setSaved(false)}}/>{cs?"Rozesílky e-mailem":"Email broadcasts"}</label>
     <label style={{display:"flex",alignItems:"center",gap:12}}><input style={{width:"auto"}} type="checkbox" checked={value.telegram_enabled} disabled={busy} onChange={e=>{setValue({...value,telegram_enabled:e.target.checked});setSaved(false)}}/>{cs?"Rozesílky přes Telegram":"Telegram broadcasts"}</label>
     <label style={{display:"flex",alignItems:"center",gap:12}}><input style={{width:"auto"}} type="checkbox" checked={value.telegram_enabled && (value.new_events_enabled ?? true)} disabled={busy||!value.telegram_enabled} onChange={e=>{setValue({...value,new_events_enabled:e.target.checked});setSaved(false)}}/>{cs?"Nové veřejné akce v Telegramu":"New public events on Telegram"}</label>
     <button type="submit" className="button button-primary" disabled={busy}>{busy?(cs?"Ukládání…":"Saving…"):(cs?"Uložit nastavení":"Save preferences")}</button>
     {saved&&<p role="status">{cs?"Nastavení bylo uloženo.":"Your preferences have been saved."}</p>}
   </form>:<button type="button" className="button button-outline" onClick={()=>setAttempt(n=>n+1)}>{cs?"Zkusit znovu":"Try again"}</button>}
   <p className="form-note">{cs?"Vstupenky, obnova přístupu a automatická upozornění na změny nebo zrušení akcí zůstávají zapnuté. Nastavení Telegramu platí pro propojený účet.":"Tickets, account recovery and automatic event change or cancellation notifications remain enabled. Telegram preferences apply to your linked account."}</p>
 </section>;
}
