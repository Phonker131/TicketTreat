"use client";
import {useEffect,useState} from "react";
import {getMyLoyalty,type LoyaltyPassport,type LoyaltyStudio} from "@/lib/api";
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
