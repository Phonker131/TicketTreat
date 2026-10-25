"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {AppHeader} from "@/components/AppHeader";
import {useLanguage} from "@/components/LanguageProvider";
import {userFacingError} from "@/lib/user-facing-errors";
import {eventAdminText} from "@/lib/event-admin-i18n";
import {localeForLanguage} from "@/lib/i18n";
import {getWebToken} from "@/lib/session";
import {listErasureRequests,fulfillErasureRequest,type PendingErasure} from "@/lib/api";

const MFA_HELP={
  en:"Administrator verification required. Set up or verify the authenticator code to review erasure requests.",
  cs:"Je nutné ověření správce. Pro kontrolu žádostí nastavte či potvrďte kód v ověřovací aplikaci.",
  ru:"Нужно подтвердить двухфакторную аутентификацию администратора для работы с запросами на удаление.",
  uk:"Для роботи із запитами на видалення потрібне двофакторне підтвердження адміністратора."
};
const MFA_LINK={
  en:"Verify administrator access",cs:"Ověřit přístup správce",
  ru:"Подтвердить доступ администратора",uk:"Підтвердити доступ адміністратора"
};
const MANUAL_REVIEW={
  en:"Automatic erasure is blocked. Review retained tickets, Telegram links or other obligations before resolving this request manually.",
  cs:"Automatický výmaz je zablokován. Před ručním vyřízením zkontrolujte vstupenky, propojení Telegramu a povinnosti uchování dat.",
  ru:"Автоматическое удаление заблокировано. Проверь билеты, привязку Telegram и обязательства хранения данных; запрос требует ручного рассмотрения.",
  uk:"Автоматичне видалення заблоковано. Перевір квитки, зв’язок із Telegram та обов’язки зберігання даних; запит потребує ручного розгляду."
};
const REQUEST_DEADLINE={
  en:"Response due",cs:"Odpovědět do",ru:"Ответить до",uk:"Відповісти до"
};
const OVERDUE={
  en:"Overdue — prioritize review",cs:"Po termínu — řešte přednostně",
  ru:"Срок истёк — обработать приоритетно",uk:"Термін минув — розглянути пріоритетно"
};
const BLOCKERS:Record<string,Record<"en"|"cs"|"ru"|"uk",string>>={
  privileged_account:{en:"Privileged administrator account",cs:"Privilegovaný administrátorský účet",ru:"Привилегированный аккаунт администратора",uk:"Привілейований акаунт адміністратора"},
  organizer_owns_events:{en:"Account owns events",cs:"Účet vlastní akce",ru:"Аккаунт владеет мероприятиями",uk:"Акаунт володіє подіями"},
  linked_telegram_requires_review:{en:"Linked Telegram identity",cs:"Propojený účet Telegram",ru:"Привязан Telegram",uk:"Прив'язано Telegram"},
  retention_policy_not_configured:{en:"Ticket retention policy not configured",cs:"Není nastaveno uchovávání vstupenek",ru:"Не настроен срок хранения билетов",uk:"Не налаштовано строк зберігання квитків"},
  financial_records:{en:"Financial records require review",cs:"Finanční záznamy vyžadují kontrolu",ru:"Есть финансовые записи",uk:"Є фінансові записи"},
  ticket_retention_window:{en:"Ticket retention period is still active",cs:"Lhůta uchování vstupenky ještě běží",ru:"Срок хранения билета ещё не истёк",uk:"Строк зберігання квитка ще не минув"},
  legacy_record_requires_review:{en:"Legacy registration requires review",cs:"Starší registrace vyžaduje kontrolu",ru:"Старая регистрация требует проверки",uk:"Стара реєстрація потребує перевірки"},
  active_waitlist:{en:"Active waitlist entry",cs:"Aktivní zápis na čekací listině",ru:"Активная запись в листе ожидания",uk:"Активний запис у списку очікування"},
  active_support_ticket:{en:"Open support ticket",cs:"Otevřený požadavek podpory",ru:"Открытый тикет поддержки",uk:"Відкритий запит підтримки"}
};
export function AdminPrivacyClient(){
  const {language}=useLanguage();
  const tr=(phrase:string)=>eventAdminText(language,phrase);
  const [rows,setRows]=useState<PendingErasure[]>([]);
  const [reason,setReason]=useState("");
  const [code,setCode]=useState("");
  const [selected,setSelected]=useState<number|null>(null);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState(false);
  const needsMfa=error.includes("mfa_challenge_required")||error.includes("mfa_enrollment_required");
  const manualReview=error.includes("manual_review_required");
  const blockers=manualReview?error.split(":").slice(1).map(item=>item.trim()).filter(Boolean):[];
  async function reload(){setRows(await listErasureRequests());}
  useEffect(()=>{if(getWebToken())void reload().catch(e=>setError(e instanceof Error?e.message:String(e)));else setError("Sign in first.");},[]);
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
    <Link href="/admin" className="back-link">{tr("← Admin dashboard")}</Link>
    <h1>{tr("Data erasure requests")}</h1>
    <p className="form-note">{tr("Global-admin MFA is required. Never fulfill a request without checking legal obligations, user ownership and backup retention. Conflicting records will block automatic fulfillment.")}</p>
    {error&&<p className="state-card state-error" role="alert">{needsMfa?MFA_HELP[language]:manualReview?MANUAL_REVIEW[language]:userFacingError(error,language)}</p>}
    {needsMfa&&<Link href="/security/mfa" className="button button-outline">{MFA_LINK[language]}</Link>}
    {manualReview&&blockers.length>0&&<ul>{blockers.map(code=><li key={code}>{BLOCKERS[code]?.[language]||code}</li>)}</ul>}
    {notice&&<p className="success-banner">{tr(notice)}</p>}
    {rows.length===0?<p className="state-card">{tr("No pending requests.")}</p>:
      <div className="ticket-list">{rows.map(row=><section key={row.request_id} className="panel form-stack">
        <strong>{tr("Request #")}{row.request_id} · {tr("Account #")}{row.account_id}</strong>
        <p>{row.email}</p><small>{new Date(row.created_at).toLocaleString(localeForLanguage(language))}</small>
        <p className="form-note">{REQUEST_DEADLINE[language]}: {new Date(row.response_due_at).toLocaleDateString(localeForLanguage(language))}</p>
        {row.overdue&&<p className="state-card state-error" role="status">{OVERDUE[language]}</p>}
        <button className="button button-outline" onClick={()=>{setSelected(row.request_id);setCode("");setReason("");}}>
          {tr("Review this request")}
        </button>
      </section>)}</div>}
    {selected!==null&&<section className="panel form-stack">
      <h2>{tr("Review request #")}{selected}</h2>
      <p>{tr("Permanent operation. If linked Telegram registrations, future events or retained financial records exist, the API refuses deletion for manual review.")}</p>
      <label>{tr("Reason and internal case reference")}
        <textarea minLength={12} maxLength={500} rows={3} value={reason}
          onChange={e=>setReason(e.target.value)}/>
      </label>
      <label>{tr("Type ERASE to authorize")}
        <input autoComplete="off" value={code} onChange={e=>setCode(e.target.value)}/>
      </label>
      <button className="button button-primary" disabled={busy||code!=="ERASE"||reason.trim().length<12}
        onClick={act}>{tr("Fulfill eligible erasure")}</button>
    </section>}
  </main></div>;
}
