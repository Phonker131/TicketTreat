"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {useLanguage} from "@/components/LanguageProvider";
export function EmailUnsubscribe(){
 const {language}=useLanguage(),cs=language==="cs";
 const [token,setToken]=useState<string|null>(null),[ready,setReady]=useState(false);
 const [busy,setBusy]=useState(false),[done,setDone]=useState(false),[error,setError]=useState("");
 useEffect(()=>{setToken(new URLSearchParams(window.location.hash.slice(1)).get("token"));setReady(true)},[]);
 async function unsubscribe(){
   if(!token||busy)return;setBusy(true);setError("");
   try{
     const response=await fetch("/api/gateway/api/v1/public/broadcast-unsubscribe",{
       method:"POST",headers:{"Content-Type":"application/json","X-TicketTreat-Client":"1"},
       body:JSON.stringify({token}),cache:"no-store"
     });
     if(!response.ok)throw new Error(response.status===400?"invalid":"failed");
     setDone(true);window.history.replaceState(null,"",window.location.pathname);
   }catch(e){setError(e instanceof Error&&e.message==="invalid"?
     (cs?"Odkaz je neplatný. Otevřete odkaz z novějšího e-mailu nebo změňte nastavení v profilu.":"This link is invalid. Use a newer email or change your preferences in your profile."):
     (cs?"Odhlášení se nepodařilo. Zkuste to znovu.":"Could not unsubscribe. Please try again."))}
   finally{setBusy(false)}
 }
 return <main className="page"><section className="panel form-stack" style={{maxWidth:600,margin:"32px auto"}}>
   <h1>{done?(cs?"Odhlášeno":"Unsubscribed"):(cs?"Odhlásit e-mailové rozesílky":"Unsubscribe from email broadcasts")}</h1>
   {!ready?<p role="status">{cs?"Načítání…":"Loading…"}</p>:done?
   <p role="status">{cs?"E-mailové rozesílky TicketTreat a pořadatelů jsou nyní vypnuté.":"Email broadcasts from TicketTreat and organizers are now turned off."}</p>:token?<>
     <p>{cs?"Potvrďte odhlášení od hromadných e-mailových zpráv TicketTreat a pořadatelů. Přihlášení není potřeba.":"Confirm that you want to stop email broadcasts from TicketTreat and organizers. No sign-in is needed."}</p>
     <button className="button button-primary" type="button" disabled={busy} onClick={()=>void unsubscribe()}>{busy?(cs?"Ukládání…":"Saving…"):(cs?"Odhlásit rozesílky":"Unsubscribe")}</button>
   </>:<p>{cs?"Otevřete odkaz pro odhlášení v doručeném e-mailu nebo změňte nastavení v profilu.":"Open the unsubscribe link in your email, or change your preferences in your profile."}</p>}
   {error&&<p role="alert">{error}</p>}
   <p className="form-note">{cs?"Vstupenky, obnova přístupu a automatická upozornění na změny nebo zrušení akcí zůstávají zapnuté. Nastavení Telegramu se nemění.":"Tickets, account recovery and automatic event change or cancellation notices remain enabled. Your Telegram preference stays unchanged."}</p>
   <Link href="/profile">{cs?"Otevřít profil":"Open profile"}</Link>
 </section></main>;
}
