"use client";

import Link from "next/link";
import {useEffect,useState,type FormEvent} from "react";
import {useRouter} from "next/navigation";
import {AppHeader} from "@/components/AppHeader";
import {claimWebGlobalAdmin} from "@/lib/api";
import {getWebToken,restoreWebProfile} from "@/lib/session";

/** Direct-access-only owner recovery. Never linked from signup, profile or nav.
 * The server independently checks the allowlisted verified email and secret.
 */
export default function PrivateAccessRecoveryPage(){
  const router=useRouter();
  const [ready,setReady]=useState(false);
  const [eligible,setEligible]=useState(false);
  const [secret,setSecret]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  useEffect(()=>{
    let live=true;
    void restoreWebProfile().then(profile=>{
      if(live)setEligible(profile?.admin_claim_available===true);
    }).catch(()=>{}).finally(()=>{if(live)setReady(true);});
    return()=>{live=false;};
  },[]);
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!eligible||busy)return;
    const token=getWebToken();
    if(!token)return;
    setBusy(true);setError("");
    try{
      await claimWebGlobalAdmin(token,secret);
      setSecret("");
      window.dispatchEvent(new Event("tickettreat-auth-change"));
      router.replace("/admin");
    }catch{
      // Don't disclose privileged recovery eligibility or backend details.
      setError("Could not confirm access.");
    }finally{setBusy(false);}
  }
  return <div className="app-shell"><AppHeader/><main className="page narrow-page">
    <Link className="back-link" href="/">← TicketTreat</Link>
    {!ready?<div className="state-card">Checking access…</div>:
      !eligible?<div className="state-card">This action is not available for this account.</div>:
      <section className="panel form-stack">
        <h1>Private account recovery</h1>
        <p className="form-note">Only an existing authorized account can use its private recovery key.</p>
        <form className="form-stack" onSubmit={submit}>
          <label>Recovery key<input type="password" required minLength={24} maxLength={200}
            autoComplete="off" value={secret} onChange={e=>setSecret(e.target.value)}/></label>
          <button type="submit" className="button button-primary" disabled={busy||secret.length<24}>
            {busy?"Verifying…":"Confirm access"}
          </button>
        </form>
        {error&&<div className="state-card state-error" role="alert">{error}</div>}
      </section>}
  </main></div>;
}
