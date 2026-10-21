"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {AppHeader} from "@/components/AppHeader";
import {getOrganizerApplication,applyAsOrganizer,type OrganizerApplicationStatus} from "@/lib/api";
import {getWebToken} from "@/lib/session";
export function OrganizerApplyClient(){
  const [data,setData]=useState<OrganizerApplicationStatus|null>(null);
  const [error,setError]=useState("");const [busy,setBusy]=useState(false);
  useEffect(()=>{if(getWebToken())getOrganizerApplication().then(setData).catch(e=>setError(String(e)));
    else setError("Please sign in first.");},[]);
  async function apply(){
    setBusy(true);setError("");
    try{await applyAsOrganizer();setData(await getOrganizerApplication());}
    catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}
  }
  return <div className="app-shell"><AppHeader/><main className="page">
    <Link href="/profile" className="back-link">← Profile</Link>
    <h1>Become an organizer</h1>
    <p className="form-note">TicketTreat manually reviews organizer applications. You need a verified email address. Approved organizers must enable two-factor authentication before managing events.</p>
    {error&&<div className="state-card state-error" role="alert">{error}</div>}
    {data&&<section className="panel form-stack">
      <p>Account role: <strong>{data.role}</strong></p>
      <p>Application status: <strong>{data.status}</strong></p>
      {data.role==="participant"&&["none","rejected"].includes(data.status)&&
        <button className="button button-primary" onClick={apply} disabled={busy}>Submit application</button>}
      {data.role==="organizer"&&<Link href="/security/mfa" className="button button-primary">Configure MFA</Link>}
    </section>}
  </main></div>;
}