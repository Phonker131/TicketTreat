"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {AppHeader} from "@/components/AppHeader";
import {useLanguage} from "@/components/LanguageProvider";
import {adminTranslate} from "@/lib/admin-i18n";
import {listOrganizerApplications,decideOrganizer,type PendingOrganizer} from "@/lib/api";
import {getWebToken} from "@/lib/session";

export function OrganizerReviewClient(){
  const {language}=useLanguage();
  const tr=(phrase:string)=>adminTranslate(language,phrase);
  const [rows,setRows]=useState<PendingOrganizer[]>([]);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  async function reload(){setRows(await listOrganizerApplications());}
  useEffect(()=>{if(getWebToken())void reload().catch(e=>setMessage(String(e)));},[]);
  async function decide(id:number,approve:boolean){
    if(!window.confirm(approve?"Approve this verified organizer?":"Reject this organizer application?"))return;
    setBusy(true);setMessage("");
    try{await decideOrganizer(id,approve);await reload();}
    catch(e){setMessage(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  }
  return <div className="app-shell"><AppHeader/><main className="page">
    <Link href="/admin" className="back-link">{tr("← Admin")}</Link>
    <h1>{tr("Organizer applications")}</h1>
    <p className="form-note">{tr("Applicants must verify their email. Global admin MFA is required to approve new event organizers.")}</p>
    {message&&<p className="state-card state-error" role="alert">{message}</p>}
    {rows.length===0?<p className="state-card">{tr("No pending applications.")}</p>:
    rows.map(x=><section className="panel form-stack" key={x.account_id}>
      <h3>Account #{x.account_id}</h3><p>{x.email}</p>
      <small>{new Date(x.created_at).toLocaleString()}</small>
      <div className="profile-actions">
        <button className="button button-primary" disabled={busy} onClick={()=>decide(x.account_id,true)}>{tr("Approve")}</button>
        <button className="button button-outline" disabled={busy} onClick={()=>decide(x.account_id,false)}>{tr("Reject")}</button>
      </div>
    </section>)}
  </main></div>;
}
