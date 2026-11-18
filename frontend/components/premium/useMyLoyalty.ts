"use client";
import {useEffect,useState} from "react";
import {getMyLoyalty,getOrganizerLoyaltyTiers,type LoyaltyPassport,type LoyaltyStudio,type OrganizerLoyaltyTiers,type OrganizerTierBenefit} from "@/lib/api";
import {getWebToken} from "@/lib/session";

/* One request per page for "my visits with each organizer"; cards, the event page and the profile share it.
   Signing in or out (the session's change event) drops the cached answer. */
let cached:Promise<LoyaltyPassport|null>|null=null;
if(typeof window!=="undefined")window.addEventListener("tickettreat-auth-change",()=>{cached=null;});

function signedIn(){
 if(getWebToken())return true;
 return Boolean((window as Window&{Telegram?:{WebApp?:{initData?:string}}}).Telegram?.WebApp?.initData);
}

export function useMyLoyalty(){
 const [passport,setPassport]=useState<LoyaltyPassport|null>(null);
 const [state,setState]=useState<"loading"|"guest"|"ready">("loading");
 useEffect(()=>{
  let live=true;
  if(!signedIn()){setState("guest");return;}
  cached??=getMyLoyalty().catch(()=>null);
  cached.then(result=>{if(!live)return;setPassport(result);setState(result?"ready":"guest");});
  return()=>{live=false};
 },[]);
 return {passport,state};
}

/** The studio for an organizer. Visits are counted under the name on the organizer's events,
 *  which can be shorter than the public profile name ("Scentino" and "Scentino Perfumery"). */
export function studioFor(passport:LoyaltyPassport|null,organizer:string|null|undefined):LoyaltyStudio|null{
 const name=(organizer||"").trim().toLowerCase();
 if(!passport||!name)return null;
 const exact=passport.studios.find(s=>s.organizer_name.trim().toLowerCase()===name);
 if(exact)return exact;
 return passport.studios.find(s=>{const n=s.organizer_name.trim().toLowerCase();return n.length>2&&(name.startsWith(n+" ")||n.startsWith(name+" "));})||null;
}

/* The organizer's own level settings, for the pages that show them before a guest has visited.
   1) a public answer per organizer profile (/public/organizers/{slug}/loyalty, used once the server offers it);
   2) for a signed-in organizer, the settings from their own dashboard. */
const publicTiers=new Map<string,Promise<OrganizerTierBenefit[]|null>>();
function loadPublicTiers(slug:string){
 if(!publicTiers.has(slug))publicTiers.set(slug,
  fetch(`/api/gateway/api/v1/public/organizers/${encodeURIComponent(slug)}/loyalty`,{headers:{Accept:"application/json"},cache:"no-store"})
   .then(r=>r.ok?r.json():null).then(d=>Array.isArray(d?.tiers)&&d.tiers.length===4?d.tiers as OrganizerTierBenefit[]:null).catch(()=>null));
 return publicTiers.get(slug)!;
}
let ownTiers:Promise<OrganizerLoyaltyTiers|null>|null=null;
if(typeof window!=="undefined")window.addEventListener("tickettreat-auth-change",()=>{ownTiers=null;});

export function useOrganizerTiers(slug:string|null|undefined,name:string|null|undefined){
 const [tiers,setTiers]=useState<OrganizerTierBenefit[]|null>(null);
 useEffect(()=>{
  let live=true;
  (async()=>{
   if(slug){const t=await loadPublicTiers(slug);if(t){if(live)setTiers(t);return;}}
   if(!getWebToken()||!name)return;
   ownTiers??=getOrganizerLoyaltyTiers().catch(()=>null);
   const own=await ownTiers,key=name.trim().toLowerCase();
   const org=own?.organizers.find(o=>o.name.trim().toLowerCase()===key)
    ||own?.organizers.find(o=>{const n=o.name.trim().toLowerCase();return n.length>2&&(key.startsWith(n+" ")||n.startsWith(key+" "));});
   if(live&&org)setTiers(org.tiers);
  })();
  return()=>{live=false};
 },[slug,name]);
 return tiers;
}
