"use client";
import Link from "next/link";
import {FormEvent,useEffect,useState} from "react";
import {AppHeader} from "@/components/AppHeader";
import {useLanguage} from "@/components/LanguageProvider";
import {userFacingError} from "@/lib/user-facing-errors";
import {adminTranslate} from "@/lib/admin-i18n";
import {getMFAStatus,getWebProfile,startMFA,confirmMFA,elevateMFA,type MFAStatus,type MFAStart} from "@/lib/api";
import type {WebProfile} from "@/lib/types";
import {getWebToken} from "@/lib/session";
import type {LanguageCode} from "@/lib/types";
const WORDS:Record<LanguageCode,Record<string,string>>={"en":{"intro":"Organizers and administrators must verify a six-digit code from an authenticator app to access management tools. After 12 hours you must verify again.","checking":"Checking account permissions…","account":"Account","role":"Role","participant":"Participant","organizer":"Organizer","globalAdmin":"Global administrator","emailFirst":"Please verify your email address in your profile first.","emailRequired":"Verify your email in your profile before managing events or participants.","profile":"Profile","passwordConfirm":"Confirm your account password","verified":"Two-factor authentication verified. Your administrator session is active.","verifiedSession":"Administrator session verified.","verificationRequired":"Verification required before using organizer tools.","warning":"Important: there is no self-service MFA reset. If you lose your authenticator, recovery requires manual identity verification by the platform operator.","loginRequired":"Sign in to configure two-factor authentication.","permission":"This account does not yet have organizer or global administrator rights. Ask an existing global administrator to grant access under Admin → Accounts after verifying your email."},"cs":{"intro":"Pořadatelé a administrátoři musí přístup ke správě potvrdit šestimístným kódem z ověřovací aplikace. Po 12 hodinách je nutné nové ověření.","checking":"Kontrolujeme oprávnění účtu…","account":"Účet","role":"Role","participant":"Účastník","organizer":"Pořadatel","globalAdmin":"Hlavní administrátor","emailFirst":"Nejprve ověřte e-mail ve svém profilu.","emailRequired":"Před správou akcí a účastníků ověřte e-mail v profilu.","profile":"Profil","passwordConfirm":"Potvrďte heslo k účtu","verified":"Dvoufaktorové ověření úspěšné. Administrátorská relace je aktivní.","verifiedSession":"Administrátorská relace ověřena.","verificationRequired":"Před použitím nástrojů pořadatele je nutné ověření.","warning":"Důležité: dvoufaktorové ověření nelze obnovit svépomocí. Při ztrátě ověřovací aplikace je nutné ruční ověření totožnosti provozovatelem platformy.","loginRequired":"Pro nastavení dvoufaktorového ověření se přihlaste.","permission":"Tento účet zatím nemá oprávnění pořadatele ani hlavního administrátora. Po ověření e-mailu požádejte hlavního administrátora o přidělení přístupu v části Administrace → Účty."},"ru":{"intro":"Организаторы и администраторы должны подтвердить вход шестизначным кодом из приложения-аутентификатора. Через 12 часов потребуется повторное подтверждение.","checking":"Проверяем права аккаунта…","account":"Аккаунт","role":"Роль","participant":"Участник","organizer":"Организатор","globalAdmin":"Главный администратор","emailFirst":"Сначала подтверди email в профиле.","emailRequired":"Для работы с участниками и мероприятиями необходимо подтвердить email в профиле.","profile":"Профиль","passwordConfirm":"Подтверди пароль от аккаунта","verified":"Двухфакторная проверка пройдена. Сессия администратора активна.","verifiedSession":"Сессия администратора подтверждена.","verificationRequired":"Для работы с панелью организатора нужно подтверждение.","warning":"Важно: самостоятельный сброс двухфакторной защиты недоступен. При потере приложения восстановление требует ручной проверки личности оператором платформы.","loginRequired":"Войди, чтобы настроить двухфакторную защиту.","permission":"У аккаунта пока нет прав организатора или главного администратора. После подтверждения email попроси администратора назначить доступ в панели управления аккаунтами."},"uk":{"intro":"Організатори й адміністратори мають підтверджувати доступ шестизначним кодом із застосунку-автентифікатора. Через 12 годин перевірку треба повторити.","checking":"Перевіряємо права акаунта…","account":"Акаунт","role":"Роль","participant":"Учасник","organizer":"Організатор","globalAdmin":"Головний адміністратор","emailFirst":"Спочатку підтвердь email у профілі.","emailRequired":"Перш ніж керувати подіями й учасниками, підтвердь email у профілі.","profile":"Профіль","passwordConfirm":"Підтвердь пароль від акаунта","verified":"Двофакторну перевірку пройдено. Сеанс адміністратора активний.","verifiedSession":"Сеанс адміністратора підтверджено.","verificationRequired":"Для роботи з панеллю організатора потрібне підтвердження.","warning":"Важливо: самостійне скидання двофакторного захисту недоступне. Якщо втратиш застосунок, оператор платформи має вручну підтвердити особу.","loginRequired":"Увійди, щоб налаштувати двофакторний захист.","permission":"Цей акаунт ще не має прав організатора чи головного адміністратора. Після підтвердження email попроси головного адміністратора надати доступ у панелі керування акаунтами."}};

export function MFAClient(){
  const {language}=useLanguage();
  const tr=(phrase:string)=>adminTranslate(language,phrase);
  const txt=WORDS[language];
  const show=(message:string)=>message.startsWith("msg:")?(txt[message.slice(4)]||userFacingError(message.slice(4),language)):userFacingError(message,language);
  const [status,setStatus]=useState<MFAStatus|null>(null);
  const [profile,setProfile]=useState<WebProfile|null>(null);
  const [checkingProfile,setCheckingProfile]=useState(true);
  const [setup,setSetup]=useState<MFAStart|null>(null);
  const [password,setPassword]=useState("");
  const [code,setCode]=useState("");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  useEffect(()=>{
    const token=getWebToken();
    if(!token){setError("msg:loginRequired");setCheckingProfile(false);return;}
    let active=true;
    // Read the current authoritative role before showing the enrollment form.
    // A verified email or Railway allowlist alone does not grant privileges.
    Promise.all([getWebProfile(token),getMFAStatus()])
      .then(([current,mfa])=>{if(active){setProfile(current);setStatus(mfa);}})
      .catch(e=>{if(active)setError(e instanceof Error?e.message:String(e));})
      .finally(()=>{if(active)setCheckingProfile(false);});
    return()=>{active=false;};
  },[]);
  async function begin(e:FormEvent){
    e.preventDefault();setLoading(true);setError("");setNotice("");
    try{
      setSetup(await startMFA(password));setPassword("");
    }catch(e){
      const raw=e instanceof Error?e.message:String(e);
      setError(raw==="privileged_account_required"
        ?"msg:permission"
        :raw);
    }
    finally{setLoading(false);}
  }
  async function prove(e:FormEvent){
    e.preventDefault();setLoading(true);setError("");
    try{
      const response=setup?await confirmMFA(code):await elevateMFA(code);
      setStatus(response);setSetup(null);setCode("");
      setNotice("msg:verified");
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setLoading(false);}
  }
  const role=profile?.account.role;
  const isPrivileged=role==="organizer"||role==="global_admin";
  const accessMessage={
    ru:"Для этого аккаунта пока не назначены права организатора или главного администратора. Главный администратор должен открыть «Админ-панель → Управление аккаунтами», проверить подтверждение email и назначить права. Только после этого можно подключить MFA.",
    uk:"Цьому акаунту ще не призначено права організатора або головного адміністратора. Головний адміністратор має відкрити «Адмін-панель → Керування акаунтами» та надати доступ після підтвердження email.",
    cs:"Tomuto účtu zatím nebyla přiřazena role organizátora ani hlavního administrátora. Hlavní administrátor musí v části Správa účtů udělit přístup po ověření e-mailu.",
    en:"This account does not yet have organizer or global administrator privileges. An existing global administrator must grant access in Admin → Accounts after your email is verified."
  }[language]||"Your account needs administrator approval before MFA enrollment.";
  return <div className="app-shell"><AppHeader/><main className="page">
    <Link href="/profile" className="back-link">{tr("← Back to profile")}</Link>
    <h1>{tr("Two-factor authentication")}</h1>
    <p className="form-note">{txt.intro}</p>
    {error&&<div className="state-card state-error" role="alert">{show(error)}</div>}
    {notice&&<div className="success-banner">{show(notice)}</div>}
    {checkingProfile&&<div className="state-card" role="status">{txt.checking}</div>}
    {!checkingProfile&&profile&&!isPrivileged&&
      <section className="panel form-stack" role="status">
        <h2>{language==="ru"?"Доступ администратора ещё не назначен":language==="uk"?"Доступ адміністратора ще не призначено":language==="cs"?"Přístup správce ještě nebyl udělen":"Administrator access not granted yet"}</h2>
        <p>{accessMessage}</p>
        <p className="form-note">{txt.account}: <strong>{profile.account.email}</strong> · {txt.role}: <strong>{role==="participant"?txt.participant:role==="organizer"?txt.organizer:txt.globalAdmin}</strong></p>
        {!profile.email_verified&&<p className="form-note">{txt.emailFirst}</p>}
        <Link href="/profile" className="button button-outline">{tr("← Back to profile")}</Link>
      </section>}
    {!checkingProfile&&profile&&isPrivileged&&!profile.email_verified&&
      <div className="state-card" role="status">{txt.emailRequired} <Link href="/profile">{txt.profile} →</Link></div>}
    {status&&isPrivileged&&!status.enabled&&!setup&&<form className="panel form-stack" onSubmit={begin}>
      <h2>{tr("Connect authenticator app")}</h2>
      <label>{txt.passwordConfirm}
        <input type="password" autoComplete="current-password" required value={password}
          onChange={e=>setPassword(e.target.value)}/>
      </label>
      <button className="button button-primary" disabled={loading}>{tr("Start MFA enrollment")}</button>
    </form>}
    {isPrivileged&&setup&&<section className="panel form-stack">
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
    {status?.enabled&&isPrivileged&&<section className="panel form-stack">
      <p><strong>{tr("MFA enabled.")}</strong> {status.elevated?txt.verifiedSession:txt.verificationRequired}</p>
      {!status.elevated&&<form className="form-stack" onSubmit={prove}>
        <label>{tr("Authenticator code")}<input inputMode="numeric" pattern="[0-9]{6}" minLength={6}
          maxLength={6} required autoComplete="one-time-code" value={code} onChange={e=>setCode(e.target.value)}/></label>
        <button className="button button-primary" disabled={loading}>{tr("Verify session")}</button>
      </form>}
      {status.elevated&&<Link href="/admin" className="button button-primary">{tr("Open organizer dashboard")}</Link>}
    </section>}
    <p className="form-note">{txt.warning}</p>
  </main></div>;
}
