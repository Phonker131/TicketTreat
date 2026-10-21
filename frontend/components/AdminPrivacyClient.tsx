"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {AppHeader} from "@/components/AppHeader";
import {getWebToken} from "@/lib/session";
import {listErasureRequests,fulfillErasureRequest,type PendingErasure} from "@/lib/api";

export function AdminPrivacyClient(){
  const [rows,setRows]=useState<PendingErasure[]>([]);
  const [reason,setReason]=useState("");
  const [code,setCode]=useState("");
  const [selected,setSelected]=useState<number|null>(null);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState(false);
  async function reload(){setRows(await listErasureRequests());}
  useEffect(()=>{if(getWebToken())void reload().catch(e=>setError(String(e)));else setError("Sign in first.");},[]);
  async function act(){
    if(!selected||code!=="ERASE"||reason.trim().length<12)return;
    setBusy(true);setError("");setNotice("");
    try{
      await fulfillErasureRequest(selected,reason);
      setSelected(null);setReason("");setCode("");
      setNotice("Eligible account data has been erased and the action audited.");
      await reload();
    }catch(e){
      setError(e instanceof Error?e.message:String(e));
    }finally{setBusy(false);}
  }
  return <div className="app-shell"><AppHeader/><main className="page">
    <Link href="/admin" className="back-link">← Admin dashboard</Link>
    <h1>Data erasure requests</h1>
    <p className="form-note">Global-admin MFA is required. Never fulfill a request without checking legal obligations, user ownership and backup retention. Conflicting records will block automatic fulfillment.</p>
    {error&&<p className="state-card state-error" role="alert">{error}</p>}
    {notice&&<p className="success-banner">{notice}</p>}
    {rows.length===0?<p className="state-card">No pending requests.</p>:
      <div className="ticket-list">{rows.map(row=><section key={row.request_id} className="panel form-stack">
        <strong>Request #{row.request_id} · Account #{row.account_id}</strong>
        <p>{row.email}</p><small>{new Date(row.created_at).toLocaleString()}</small>
        <button className="button button-outline" onClick={()=>{setSelected(row.request_id);setCode("");setReason("");}}>
          Review this request
        </button>
      </section>)}</div>}
    {selected!==null&&<section className="panel form-stack">
      <h2>Review request #{selected}</h2>
      <p>Permanent operation. If linked Telegram registrations, future events or retained financial records exist, the API refuses deletion for manual review.</p>
      <label>Reason and internal case reference
        <textarea minLength={12} maxLength={500} rows={3} value={reason}
          onChange={e=>setReason(e.target.value)}/>
      </label>
      <label>Type ERASE to authorize
        <input autoComplete="off" value={code} onChange={e=>setCode(e.target.value)}/>
      </label>
      <button className="button button-primary" disabled={busy||code!=="ERASE"||reason.trim().length<12}
        onClick={act}>Fulfill eligible erasure</button>
    </section>}
  </main></div>;
}
