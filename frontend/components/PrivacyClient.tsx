"use client";
import Link from "next/link";
import {FormEvent,useEffect,useState} from "react";
import {AppHeader} from "@/components/AppHeader";
import {getWebToken} from "@/lib/session";
import {
  getPrivacyRequest,submitPrivacyRequest,withdrawPrivacyRequest,
  type PrivacyRequestStatus,
} from "@/lib/api";

export function PrivacyClient(){
  const [details,setDetails]=useState<PrivacyRequestStatus|null>(null);
  const [password,setPassword]=useState("");
  const [pending,setPending]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");

  async function reload(){
    if(!getWebToken()){setError("Please sign in to manage your data.");return;}
    const status=await getPrivacyRequest();
    setDetails(status);
  }

  useEffect(()=>{void reload().catch(e=>setError(String(e)));},[]);

  async function send(e:FormEvent){
    e.preventDefault();setPending(true);setError("");setNotice("");
    try{
      await submitPrivacyRequest(password);
      setPassword("");
      await reload();
      setNotice("Your erasure request has been registered.");
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setPending(false);}
  }

  async function withdraw(){
    setPending(true);setError("");setNotice("");
    try{
      await withdrawPrivacyRequest();
      await reload();
      setNotice("Your erasure request has been withdrawn.");
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setPending(false);}
  }

  return <div className="app-shell"><AppHeader/><main className="page">
    <Link href="/profile" className="back-link">← Back to profile</Link>
    <h1>Privacy and personal data</h1>
    <section className="panel form-stack">
      <h2>Account erasure request</h2>
      <p className="form-note">You can request the deletion of your TicketTreat account and personal information. Requests are reviewed before fulfillment because event-registration records, organizer activity or legally required data may need to be retained.</p>
      {error&&<p role="alert" className="state-card state-error">{error}</p>}
      {notice&&<p className="success-banner">{notice}</p>}
      {details?.status==="pending"?
        <>
          <p><strong>Status:</strong> Pending review</p>
          <p className="form-note">Requested: {details.requested_at?new Date(details.requested_at).toLocaleString():"—"}</p>
          <p className="form-note">Response due: {details.response_due_at?new Date(details.response_due_at).toLocaleDateString():"—"}</p>
          <button className="button button-outline" type="button" disabled={pending} onClick={withdraw}>Withdraw request</button>
        </>:
        <form onSubmit={send} className="form-stack">
          <label>Confirm with your current password
            <input type="password" autoComplete="current-password" minLength={1} maxLength={128}
              required value={password} onChange={e=>setPassword(e.target.value)}/>
          </label>
          <button type="submit" className="button button-primary" disabled={pending||!getWebToken()}>Submit erasure request</button>
        </form>
      }
      <p className="form-note">Submitting a request does not instantly cancel event registrations or delete financial records. Your other account privacy rights, including data export, are available from your profile.</p>
    </section>
  </main></div>;
}
