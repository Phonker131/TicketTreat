"use client";

import Link from "next/link";
import {FormEvent,useCallback,useEffect,useState} from "react";
import {AppHeader} from "@/components/AppHeader";
import {useLanguage} from "@/components/LanguageProvider";
import {acceptOrganizerInvitation,getOrganizerTeams,inviteOrganizerMember,
  leaveOrganizerTeam,revokeOrganizerMember,setOrganizerTeamNotifications} from "@/lib/api";
import type {OrganizerTeamData} from "@/lib/api";
import {userFacingError} from "@/lib/user-facing-errors";

const COPY={
  en:{title:"Organizer team",back:"Organizer dashboard",intro:"Collaborate under one organizer account without sharing passwords. Each team member uses their own TicketTreat account and their own linked Telegram.",
    inviteTitle:"Invite a team member",inviteHelp:"Enter the email of an existing, verified TicketTreat account. They must accept the invitation from their profile before they can manage events. Maximum 12 members.",
    email:"Team member email",invite:"Send invitation",sending:"Sending…",invited:"Invitation created. Ask the person to open Profile → Organizer team and accept it.",
    myMembers:"People in my organization",noneMembers:"No team members yet.",myTeams:"Organizations that invited me",noneTeams:"No invitations or memberships.",
    pending:"Awaiting acceptance",active:"Active",accept:"Accept invitation",leave:"Leave organization",revoke:"Remove access",cancel:"Cancel invitation",
    notifications:"Send Telegram event notifications to me",mfa:"Team event access requires two-factor authentication. Each member must enable it for their own account.",
    telegram:"To receive notifications, each person must link their Telegram in their own profile and enable registration/cancellation alerts.",
    expiry:"Invitation expires",confirm:"Remove this person's access to your organization's events and notifications?",confirmLeave:"Leave this organization and lose event management access?",
    updated:"Changes saved.",loading:"Loading team…",error:"Could not complete this request. Verify your login and try again.",
    manage:"Event management",profile:"Connect Telegram",prefs:"Notification preferences"},
  cs:{title:"Tým pořadatele",back:"Správa akcí",intro:"Spravujte akce společně pod jedním pořadatelem bez sdílení hesel. Každý člen používá vlastní účet TicketTreat a vlastní propojený Telegram.",
    inviteTitle:"Pozvat člena týmu",inviteHelp:"Zadejte e-mail existujícího ověřeného účtu TicketTreat. Pozvaný musí pozvánku přijmout ve svém profilu. Maximálně 12 členů.",
    email:"E-mail člena týmu",invite:"Odeslat pozvánku",sending:"Odesílání…",invited:"Pozvánka byla vytvořena. Požádejte kolegu, aby ji přijal v Profil → Tým pořadatele.",
    myMembers:"Členové mé organizace",noneMembers:"Zatím žádní členové.",myTeams:"Organizace, které mě pozvaly",noneTeams:"Zatím žádné pozvánky ani členství.",
    pending:"Čeká na potvrzení",active:"Aktivní",accept:"Přijmout pozvánku",leave:"Opustit organizaci",revoke:"Odebrat přístup",cancel:"Zrušit pozvánku",
    notifications:"Posílat mi oznámení o akcích na Telegram",mfa:"Přístup k akcím týmu vyžaduje dvoufaktorové ověření. Každý člen si ho nastavuje na vlastním účtu.",
    telegram:"Pro příjem oznámení si každý člen musí propojit svůj Telegram ve svém profilu a povolit upozornění na registrace a odhlášení.",
    expiry:"Pozvánka vyprší",confirm:"Odebrat této osobě přístup k akcím a oznámením vaší organizace?",confirmLeave:"Opustit tuto organizaci a ztratit přístup ke správě akcí?",
    updated:"Změny uloženy.",loading:"Načítání týmu…",error:"Požadavek se nezdařil. Zkontrolujte přihlášení a zkuste to znovu.",
    manage:"Správa akcí",profile:"Propojit Telegram",prefs:"Nastavení upozornění"}
} as const;

export function OrganizerTeamClient(){
  const {language}=useLanguage();
  const t=COPY[language==="cs"?"cs":"en"];
  const [data,setData]=useState<OrganizerTeamData|null>(null);
  const [loading,setLoading]=useState(true);
  const [email,setEmail]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");

  const refresh=useCallback(async()=>{setData(await getOrganizerTeams());},[]);
  useEffect(()=>{let active=true;getOrganizerTeams().then(value=>{if(active)setData(value);})
    .catch(()=>{if(active)setError(t.error);}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};},[t.error]);

  async function perform(action:()=>Promise<unknown>,success:string=t.updated){
    setBusy(true);setError("");setNotice("");
    try{await action();await refresh();setNotice(success);}
    catch(err){setError(userFacingError(err,language)||t.error);}
    finally{setBusy(false);}
  }
  function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const chosen=email.trim();if(!chosen)return;
    void perform(async()=>{await inviteOrganizerMember(chosen);setEmail("");},t.invited);
  }
  async function accept(ownerId:number){
    setBusy(true);setError("");setNotice("");
    try{
      await acceptOrganizerInvitation(ownerId);
      // A newly accepted participant now requires their own MFA setup before
      // ordinary signed-in endpoints can be used. Guide them there directly.
      window.location.assign("/security/mfa");
    }catch(err){setError(userFacingError(err,language)||t.error);setBusy(false);}
  }
  return <div className="app-shell"><AppHeader/><main className="page">
    <Link href="/admin" className="back-link">← {t.back}</Link>
    <h1>{t.title}</h1><p className="form-note">{t.intro}</p>
    {error&&<div className="state-card state-error" role="alert">{error}</div>}
    {notice&&<div className="success-banner" role="status">{notice}</div>}
    {loading?<div className="state-card">{t.loading}</div>:data&&<>
      {data.can_invite&&<section className="panel form-stack">
        <h2>{t.inviteTitle}</h2><p className="form-note">{t.inviteHelp}</p>
        <form className="form-stack" onSubmit={submit}>
          <label>{t.email}<input required type="email" autoComplete="off" value={email} onChange={e=>setEmail(e.currentTarget.value)} maxLength={255}/></label>
          <button type="submit" className="button button-primary" disabled={busy||!email.trim()}>{busy?t.sending:t.invite}</button>
        </form>
        <h3>{t.myMembers} ({data.members.length})</h3>
        {data.members.length===0?<p className="form-note">{t.noneMembers}</p>:<ul className="tt-organizer-notice-list">
          {data.members.map(member=><li className="panel" key={member.account_id}>
            <strong>{member.name||member.email}</strong><p className="form-note">{member.email} · {member.status==="active"?t.active:t.pending}</p>
            <button className="button button-outline" type="button" disabled={busy} onClick={()=>{
              if(window.confirm(t.confirm))void perform(()=>revokeOrganizerMember(member.account_id));
            }}>{member.status==="active"?t.revoke:t.cancel}</button>
          </li>)}
        </ul>}
      </section>}
      <section className="panel form-stack">
        <h2>{t.myTeams}</h2>
        {data.teams.length===0?<p className="form-note">{t.noneTeams}</p>:<ul className="tt-organizer-notice-list">
          {data.teams.map(team=><li className="panel form-stack" key={team.owner_account_id}>
            <h3>{team.organization}</h3><p className="form-note">{team.status==="active"?t.active:t.pending}
              {team.status==="invited"&&team.expires_at?` · ${t.expiry}: ${new Date(team.expires_at).toLocaleDateString(language==="cs"?"cs-CZ":"en-GB")}`:""}</p>
            {team.status==="invited"?<button type="button" className="button button-primary" disabled={busy}
              onClick={()=>void accept(team.owner_account_id)}>{t.accept}</button>:<>
              <label className="tt-organizer-notice-option"><input type="checkbox" checked={team.notifications_enabled} disabled={busy}
                onChange={e=>void perform(()=>setOrganizerTeamNotifications(team.owner_account_id,e.currentTarget.checked))}/><span>{t.notifications}</span></label>
              <button className="button button-outline" type="button" disabled={busy} onClick={()=>{
                if(window.confirm(t.confirmLeave))void perform(()=>leaveOrganizerTeam(team.owner_account_id));
              }}>{t.leave}</button>
            </>}
          </li>)}
        </ul>}
        <p className="form-note">{t.mfa} <Link href="/security/mfa">2FA →</Link></p>
        <p className="form-note">{t.telegram}</p>
        <div className="tt-ph-links"><Link className="button button-outline" href="/profile">{t.profile}</Link>
          <Link className="button button-outline" href="/admin/notifications">{t.prefs}</Link>
          <Link className="button button-primary" href="/admin">{t.manage}</Link></div>
      </section>
    </>}
  </main></div>;
}
