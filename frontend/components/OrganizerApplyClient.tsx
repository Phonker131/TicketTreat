"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {AppHeader} from "@/components/AppHeader";
import {useLanguage} from "@/components/LanguageProvider";
import {adminTranslate} from "@/lib/admin-i18n";
import {getOrganizerApplication,applyAsOrganizer,type OrganizerApplicationStatus} from "@/lib/api";
import {getWebToken} from "@/lib/session";
import type {LanguageCode} from "@/lib/types";
const WORDS:Record<LanguageCode,Record<string,string>>={"en":{"intro":"TicketTreat manually reviews organizer applications. You need a verified email address. Approved organizers must enable two-factor authentication before managing events.","role":"Account role","status":"Application status","participant":"Participant","organizer":"Organizer","global_admin":"Global administrator","none":"Not submitted","pending":"Under review","approved":"Approved","rejected":"Rejected","login":"Please sign in first."},"cs":{"intro":"TicketTreat posuzuje žádosti pořadatelů ručně. Je potřeba ověřený e-mail. Schválení pořadatelé musí před správou akcí zapnout dvoufaktorové ověření.","role":"Role účtu","status":"Stav žádosti","participant":"Účastník","organizer":"Pořadatel","global_admin":"Hlavní administrátor","none":"Nepodáno","pending":"Ve schvalování","approved":"Schváleno","rejected":"Zamítnuto","login":"Nejdříve se přihlaste."},"ru":{"intro":"TicketTreat рассматривает заявки организаторов вручную. Нужен подтверждённый email. После одобрения для управления мероприятиями необходимо включить двухфакторную защиту.","role":"Роль аккаунта","status":"Статус заявки","participant":"Участник","organizer":"Организатор","global_admin":"Главный администратор","none":"Не подана","pending":"На рассмотрении","approved":"Одобрена","rejected":"Отклонена","login":"Сначала войди в аккаунт."},"uk":{"intro":"TicketTreat розглядає заявки організаторів вручну. Потрібен підтверджений email. Після схвалення для керування подіями треба ввімкнути двофакторний захист.","role":"Роль акаунта","status":"Статус заявки","participant":"Учасник","organizer":"Організатор","global_admin":"Головний адміністратор","none":"Не подано","pending":"На розгляді","approved":"Схвалено","rejected":"Відхилено","login":"Спочатку увійди до акаунта."}};
export function OrganizerApplyClient(){
  const {language}=useLanguage();
  const tr=(phrase:string)=>adminTranslate(language,phrase);
  const txt=WORDS[language];
  const [data,setData]=useState<OrganizerApplicationStatus|null>(null);
  const [error,setError]=useState("");const [busy,setBusy]=useState(false);
  useEffect(()=>{if(getWebToken())getOrganizerApplication().then(setData).catch(e=>setError(String(e)));
    else setError("msg:login");},[]);
  async function apply(){
    setBusy(true);setError("");
    try{await applyAsOrganizer();setData(await getOrganizerApplication());}
    catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}
  }
  return <div className="app-shell"><AppHeader/><main className="page">
    <Link href="/profile" className="back-link">{tr("← Profile")}</Link>
    <h1>{tr("Become an organizer")}</h1>
    <p className="form-note">{txt.intro}</p>
    {error&&<div className="state-card state-error" role="alert">{error==="msg:login"?txt.login:error}</div>}
    {data&&<section className="panel form-stack">
      <p>{txt.role}: <strong>{txt[data.role]||data.role}</strong></p>
      <p>{txt.status}: <strong>{txt[data.status]||data.status}</strong></p>
      {data.role==="participant"&&["none","rejected"].includes(data.status)&&
        <button className="button button-primary" onClick={apply} disabled={busy}>{tr("Submit application")}</button>}
      {data.role==="organizer"&&<Link href="/security/mfa" className="button button-primary">{tr("Configure MFA")}</Link>}
    </section>}
  </main></div>;
}