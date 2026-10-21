"use client";
import Link from "next/link";
import {FormEvent,useEffect,useState} from "react";
import {AppHeader} from "@/components/AppHeader";
import {useLanguage} from "@/components/LanguageProvider";
import {adminTranslate} from "@/lib/admin-i18n";
import {getMFAStatus,startMFA,confirmMFA,elevateMFA,type MFAStatus,type MFAStart} from "@/lib/api";
import {getWebToken} from "@/lib/session";

export function MFAClient(){
  const {language}=useLanguage();
  const tr=(phrase:string)=>adminTranslate(language,phrase);
  const [status,setStatus]=useState<MFAStatus|null>(null);
  const [setup,setSetup]=useState<MFAStart|null>(null);
  const [password,setPassword]=useState("");
  const [code,setCode]=useState("");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  useEffect(()=>{
    if(!getWebToken()){setError("Sign in to configure two-factor authentication.");return;}
    getMFAStatus().then(setStatus).catch(e=>setError(e instanceof Error?e.message:String(e)));
  },[]);
  async function begin(e:FormEvent){
    e.preventDefault();setLoading(true);setError("");setNotice("");
    try{
      setSetup(await startMFA(password));setPassword("");
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setLoading(false);}
  }
  async function prove(e:FormEvent){
    e.preventDefault();setLoading(true);setError("");
    try{
      const response=setup?await confirmMFA(code):await elevateMFA(code);
      setStatus(response);setSetup(null);setCode("");
      setNotice("Two-factor authentication verified. Your administrator session is active.");
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setLoading(false);}
  }
  return <div className="app-shell"><AppHeader/><main className="page">
    <Link href="/profile" className="back-link">{tr("← Back to profile")}</Link>
    <h1>{tr("Two-factor authentication")}</h1>
    <p className="form-note">Organizers and administrators must verify a six-digit code from an authenticator app to access management tools. After 12 hours you must verify again.</p>
    {error&&<div className="state-card state-error" role="alert">{error}</div>}
    {notice&&<div className="success-banner">{notice}</div>}
    {status&&!status.enabled&&!setup&&<form className="panel form-stack" onSubmit={begin}>
      <h2>{tr("Connect authenticator app")}</h2>
      <label>Confirm your account password
        <input type="password" autoComplete="current-password" required value={password}
          onChange={e=>setPassword(e.target.value)}/>
      </label>
      <button className="button button-primary" disabled={loading}>{tr("Start MFA enrollment")}</button>
    </form>}
    {setup&&<section className="panel form-stack">
      <h2>{tr("Add TicketTreat to your authenticator")}</h2>
      <p>{tr("Enter this setup key manually in your authenticator app. Keep this secret private.")}</p>
      <code style={{wordBreak:"break-all"}}>{setup.secret}</code>
      <a href={setup.otpauth_url} className="button button-outline">{tr("Open authenticator app")}</a>
      <form className="form-stack" onSubmit={prove}>
        <label>{tr("Six-digit code")}<input inputMode="numeric" pattern="[0-9]{6}" minLength={6}
          maxLength={6} autoComplete="one-time-code" required value={code}
          onChange={e=>setCode(e.target.value)}/></label>
        <button className="button button-primary" disabled={loading}>{tr("Enable two-factor authentication")}</button>
      </form>
    </section>}
    {status?.enabled&&<section className="panel form-stack">
      <p><strong>{tr("MFA enabled.")}</strong> {status.elevated?"Administrator session verified.":"Verification required before using organizer tools."}</p>
      {!status.elevated&&<form className="form-stack" onSubmit={prove}>
        <label>{tr("Authenticator code")}<input inputMode="numeric" pattern="[0-9]{6}" minLength={6}
          maxLength={6} required autoComplete="one-time-code" value={code} onChange={e=>setCode(e.target.value)}/></label>
        <button className="button button-primary" disabled={loading}>{tr("Verify session")}</button>
      </form>}
      {status.elevated&&<Link href="/admin" className="button button-primary">{tr("Open organizer dashboard")}</Link>}
    </section>}
    <p className="form-note">Important: there is no self-service MFA reset. If you lose your authenticator, recovery requires manual identity verification by the platform operator.</p>
  </main></div>;
}
