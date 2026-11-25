"use client";

import Link from "next/link";
import {useEffect,useState} from "react";
import {AppHeader} from "@/components/AppHeader";
import {useLanguage} from "@/components/LanguageProvider";
import {getOrganizerTelegramSettings,saveOrganizerTelegramSettings} from "@/lib/api";
import type {OrganizerTelegramSettings} from "@/lib/api";

type SettingKey="registrations"|"cancellations"|"waitlist"|"messages";
const KEYS:SettingKey[]=["registrations","cancellations","waitlist","messages"];
const TEXT={
  en:{title:"Telegram notifications",intro:"Receive important changes to events belonging to your organization or the teams you joined in your own linked Telegram account.",back:"Organizer dashboard",loading:"Loading notification settings…",
    link:"Connect Telegram in your profile to receive notifications. A verified account link is required; your Telegram username alone is not enough.",
    disabled:"The Telegram bot is not configured. Your settings will be saved, but messages cannot be sent yet.",
    registrations:"New registrations",cancellations:"Registration cancellations",waitlist:"Waitlist joins, departures and promotions",messages:"New messages from attendees",save:"Save preferences",saving:"Saving…",saved:"Notification preferences saved.",error:"Could not load or save your preferences. Check organizer access and two-factor verification.",
    privacy:"Alerts are sent only to the verified owner and team members with active access. Names are shortened; email addresses, phone numbers, tickets and chat messages stay on the site."},
  cs:{title:"Upozornění na Telegramu",intro:"Dostávejte změny u vlastních akcí i akcí týmů, jejichž jste členem, do propojeného Telegramu.",back:"Panel pořadatele",loading:"Načítáme nastavení…",
    link:"Pro příjem upozornění propojte Telegram ve svém profilu. Samotné uživatelské jméno nestačí.",
    disabled:"Telegram bot není nakonfigurován. Nastavení se uloží, zprávy ale zatím nelze odesílat.",
    registrations:"Nové registrace",cancellations:"Zrušené registrace",waitlist:"Čekací listina: přidání, odchod a přesun",messages:"Nové zprávy od účastníků",save:"Uložit nastavení",saving:"Ukládání…",saved:"Nastavení upozornění bylo uloženo.",error:"Nastavení se nepodařilo načíst nebo uložit. Ověřte přístup a dvoufaktorové přihlášení.",
    privacy:"Upozornění dostane jen ověřený vlastník a členové týmu s aktivním přístupem. Jména jsou zkrácená; e-mail, telefon, vstupenky a obsah chatu zůstávají na webu."},
} as const;

export function OrganizerTelegramNotifications(){
  const {language}=useLanguage();
  const tr=TEXT[language==="cs"?"cs":"en"];
  const [data,setData]=useState<OrganizerTelegramSettings|null>(null);
  const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
  const [error,setError]=useState(false),[saved,setSaved]=useState(false);
  useEffect(()=>{
    let active=true;
    getOrganizerTelegramSettings().then(value=>{if(active)setData(value);})
      .catch(()=>{if(active)setError(true);})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[]);
  function toggle(key:SettingKey,checked:boolean){
    setData(current=>current?{...current,[key]:checked}:current);
    setSaved(false);
  }
  async function save(){
    if(!data)return;
    setSaving(true);setError(false);setSaved(false);
    try{
      const result=await saveOrganizerTelegramSettings({registrations:data.registrations,
        cancellations:data.cancellations,waitlist:data.waitlist,messages:data.messages});
      setData(result);setSaved(true);
    }catch{setError(true);}
    finally{setSaving(false);}
  }
  return <div className="app-shell"><AppHeader/><main className="page">
    <Link href="/admin" className="back-link">← {tr.back}</Link>
    <h1>{tr.title}</h1><p className="form-note">{tr.intro}</p>
    <p className="form-note"><Link href="/admin/team">{language==="cs"?"Spravovat tým a připojené účty →":"Manage your organization team →"}</Link></p>
    {loading?<div className="state-card">{tr.loading}</div>:data&&<section className="panel form-stack">
      {!data.telegram_linked&&<div className="state-card" role="status">{tr.link} <Link href="/profile">{language==="cs"?"Profil":"Profile"} →</Link></div>}
      {!data.bot_configured&&<p className="form-note">{tr.disabled}</p>}
      <div className="tt-organizer-notice-list">
        {KEYS.map(key=><label className="tt-organizer-notice-option" key={key}>
          <input type="checkbox" checked={data[key]} onChange={e=>toggle(key,e.target.checked)} />
          <span>{tr[key]}</span>
        </label>)}
      </div>
      <p className="form-note">{tr.privacy}</p>
      {error&&<p className="state-card state-error" role="alert">{tr.error}</p>}
      {saved&&<p className="success-banner" role="status">{tr.saved}</p>}
      <button className="button button-primary" type="button" disabled={saving} onClick={save}>{saving?tr.saving:tr.save}</button>
    </section>}
    {!loading&&!data&&<p className="state-card state-error" role="alert">{tr.error}</p>}
  </main></div>;
}
