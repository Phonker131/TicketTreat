"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {AppHeader} from "@/components/AppHeader";
import {useLanguage} from "@/components/LanguageProvider";
import {adminTranslate} from "@/lib/admin-i18n";
import {getManagedAccounts,setManagedAccountRole,getGlobalAdminDelegations,grantGlobalAdmin,revokeGlobalAdmin} from "@/lib/api";
import type {ManagedAccount,GlobalAdminDelegation} from "@/lib/api";
import {getWebToken} from "@/lib/session";

const ACCOUNT_UI = {"en":{"intro":"Manage participant and organizer roles. A verified account can be granted global administrator access, subject to your MFA confirmation.","grantIntro":"Both global administrators have equal management permissions. Grant access only to an existing account with a verified email. The recipient must then enable MFA.","emailAdmin":"New global administrator email","emailHint":"Verified account email","accounts":"Accounts","account":"Account","global":"Global administrator","organizer":"Organizer","participant":"Participant","roleUpdated":"Role updated.","grantDone":"Permissions granted. The new administrator must finish MFA setup and sign in again.","revoked":"Administrator access revoked.","signIn":"Sign in to manage accounts.","roleConfirm":"Change account role","grantConfirm":"Grant this verified account full TicketTreat management access?","revokeConfirm":"Revoke global administrator access?","target_email_verification_required":"The partner must verify their email in their profile first.","account_not_found_sign_up_first":"No account exists for this email. Check that registration is complete.","mfa_enrollment_required":"Enable two-factor authentication on your administrator account.","mfa_challenge_required":"Verify the MFA code for your administrator session.","global_admin_only":"Only a current global administrator can grant administrator access.","email_verification_required":"Verify your email in your TicketTreat profile.","invalid_session":"Your session expired. Sign in again."},"cs":{"intro":"Spravujte role účastníků a pořadatelů. Ověřenému účtu lze udělit oprávnění hlavního administrátora po potvrzení MFA.","grantIntro":"Oba hlavní administrátoři mají stejná oprávnění. Přístup udělte pouze existujícímu účtu s ověřeným e-mailem. Příjemce pak musí nastavit MFA.","emailAdmin":"E-mail nového hlavního administrátora","emailHint":"E-mail ověřeného účtu","accounts":"Účty","account":"Účet","global":"Hlavní administrátor","organizer":"Pořadatel","participant":"Účastník","roleUpdated":"Role byla změněna.","grantDone":"Oprávnění uděleno. Nový administrátor musí dokončit nastavení MFA a znovu se přihlásit.","revoked":"Přístup administrátora byl odebrán.","signIn":"Pro správu účtů se přihlaste.","roleConfirm":"Změnit roli účtu","grantConfirm":"Udělit tomuto ověřenému účtu plný přístup ke správě TicketTreat?","revokeConfirm":"Odebrat přístup hlavního administrátora?","target_email_verification_required":"Partner musí nejprve ověřit svůj e-mail v profilu.","account_not_found_sign_up_first":"Účet s touto adresou neexistuje. Ověřte dokončení registrace.","mfa_enrollment_required":"Nastavte dvoufaktorové ověření na administrátorském účtu.","mfa_challenge_required":"Potvrďte MFA kód administrátorské relace.","global_admin_only":"Přístup může udělit pouze stávající hlavní administrátor.","email_verification_required":"Ověřte e-mail v profilu TicketTreat.","invalid_session":"Relace vypršela. Přihlaste se znovu."},"ru":{"intro":"Управление ролями участников и организаторов. Главного администратора можно назначить существующему аккаунту с подтверждённой почтой после проверки MFA.","grantIntro":"Оба главных администратора имеют одинаковые права. Назначать их можно только зарегистрированным пользователям с подтверждённым email. После назначения необходимо настроить MFA.","emailAdmin":"Email нового главного администратора","emailHint":"Имейл подтверждённого аккаунта","accounts":"Аккаунты","account":"Аккаунт","global":"Главный администратор","organizer":"Организатор","participant":"Участник","roleUpdated":"Роль обновлена.","grantDone":"Права назначены. Новому администратору необходимо завершить MFA и заново войти.","revoked":"Администратор отозван.","signIn":"Для просмотра аккаунтов необходимо войти.","roleConfirm":"Изменить роль аккаунта","grantConfirm":"Предоставить этому подтверждённому аккаунту полный доступ к управлению TicketTreat?","revokeConfirm":"Отозвать доступ этого главного администратора?","target_email_verification_required":"Партнёр должен сначала подтвердить email в профиле.","account_not_found_sign_up_first":"Аккаунт с таким адресом не найден. Проверь регистрацию.","mfa_enrollment_required":"Заверши подключение двухфакторной защиты.","mfa_challenge_required":"Подтверди код MFA для сессии администратора.","global_admin_only":"Назначать администраторов может только главный администратор.","email_verification_required":"Подтверди email в профиле TicketTreat.","invalid_session":"Сессия завершилась. Войди ещё раз."},"uk":{"intro":"Керування ролями учасників та організаторів. Головного адміністратора можна призначити наявному акаунту з підтвердженою поштою після MFA.","grantIntro":"Обидва головні адміністратори мають однакові права. Призначати їх можна лише зареєстрованим користувачам із підтвердженим email. Після призначення потрібно налаштувати MFA.","emailAdmin":"Email нового головного адміністратора","emailHint":"Email підтвердженого акаунта","accounts":"Акаунти","account":"Акаунт","global":"Головний адміністратор","organizer":"Організатор","participant":"Учасник","roleUpdated":"Роль оновлено.","grantDone":"Права надано. Новий адміністратор має налаштувати MFA та знову ввійти.","revoked":"Права адміністратора відкликано.","signIn":"Увійди для керування акаунтами.","roleConfirm":"Змінити роль акаунта","grantConfirm":"Надати цьому підтвердженому акаунту повний доступ до керування TicketTreat?","revokeConfirm":"Відкликати права головного адміністратора?","target_email_verification_required":"Партнер має спочатку підтвердити email у профілі.","account_not_found_sign_up_first":"Акаунт із такою адресою не знайдено. Перевір реєстрацію.","mfa_enrollment_required":"Налаштуй двофакторний захист акаунта адміністратора.","mfa_challenge_required":"Підтвердь код MFA для сеансу адміністратора.","global_admin_only":"Призначати адміністраторів може лише головний адміністратор.","email_verification_required":"Підтвердь email у профілі TicketTreat.","invalid_session":"Сеанс завершився. Увійди знову."}};

export function ManageAccountsClient() {
  const {language}=useLanguage();
  const tr=(phrase:string)=>adminTranslate(language,phrase);
  const ui=ACCOUNT_UI[language];
  const display=(msg:string)=>msg.startsWith("msg:")?ui[msg.slice(4) as keyof typeof ui]||msg:msg;
  const [accounts,setAccounts]=useState<ManagedAccount[]>([]);
  const [delegations,setDelegations]=useState<GlobalAdminDelegation[]>([]);
  const [inviteEmail,setInviteEmail]=useState("");
  const [error,setError]=useState(""),[notice,setNotice]=useState("");
  const [busy,setBusy]=useState<number|null>(null),[loading,setLoading]=useState(true);
  useEffect(()=>{
    const token=getWebToken();
    if(!token){setError("msg:signIn");setLoading(false);return;}
    Promise.all([getManagedAccounts(token),getGlobalAdminDelegations(token)])
      .then(([users,grants])=>{setAccounts(users);setDelegations(grants);})
      .catch(e=>setError(e instanceof Error?e.message:String(e))).finally(()=>setLoading(false));
  },[]);
  async function changeRole(account:ManagedAccount,role:"participant"|"organizer"){
    const token=getWebToken();if(!token)return;
    if(!window.confirm(`${ui.roleConfirm} #${account.account_id} → ${ui[role]}?`))return;
    setBusy(account.account_id);setError("");setNotice("");
    try{
      await setManagedAccountRole(token,account.account_id,role);
      setAccounts(prev=>prev.map(a=>a.account_id===account.account_id?{...a,role}:a));
      setNotice("msg:roleUpdated");
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setBusy(null)}
  }
  async function grant() {
    const token=getWebToken();if(!token||!inviteEmail.trim())return;
    if(!window.confirm(ui.grantConfirm))return;
    setBusy(-1);setError("");setNotice("");
    try {
      await grantGlobalAdmin(token,inviteEmail.trim());
      const [users,grants]=await Promise.all([getManagedAccounts(token),getGlobalAdminDelegations(token)]);
      setAccounts(users);setDelegations(grants);setInviteEmail("");
      setNotice("msg:grantDone");
    } catch(e){setError(`msg:${e instanceof Error?e.message:String(e)}`);}
    finally{setBusy(null);}
  }
  async function revoke(accountId:number) {
    const token=getWebToken();if(!token)return;
    if(!window.confirm(ui.revokeConfirm))return;
    setBusy(accountId);setError("");setNotice("");
    try{
      await revokeGlobalAdmin(token,accountId);
      const [users,grants]=await Promise.all([getManagedAccounts(token),getGlobalAdminDelegations(token)]);
      setAccounts(users);setDelegations(grants);setNotice("msg:revoked");
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(null);}
  }
  return <div className="app-shell"><AppHeader/><main className="page">
    <Link href="/admin" className="back-link">{tr("← Organizer dashboard")}</Link>
    <div className="admin-heading"><div><span className="status status-demo">GLOBAL ADMIN</span><h1>{tr("Управление аккаунтами")}</h1>
      <p>{ui.intro}</p></div></div>
    {error&&<div className="state-card state-error">{display(error)}</div>}
    {notice&&<div className="success-banner">{display(notice)}</div>}
    <section className="panel form-stack">
      <h2>{tr("Главные администраторы")}</h2>
      <p className="form-note">{ui.grantIntro}</p>
      <label>{ui.emailAdmin}
        <input type="email" autoComplete="off" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder={ui.emailHint}/>
      </label>
      <button type="button" className="button button-primary" disabled={busy!==null||!inviteEmail.includes("@")} onClick={grant}>{tr("Назначить главного администратора")}</button>
      {delegations.map(d=><div className="account-management-row" key={d.account_id}>
        <div className="account-management-info"><strong>{d.email}</strong><small>{ui.account} #{d.account_id}</small></div>
        <button type="button" className="button button-outline" disabled={busy!==null} onClick={()=>revoke(d.account_id)}>{tr("Отозвать")}</button>
      </div>)}
    </section>
    {loading?<div className="state-card">{tr("Загрузка…")}</div>:<div className="panel">
      <h2>{ui.accounts} ({accounts.length})</h2>
      {accounts.map(a=><div className="account-management-row" key={a.account_id}>
        <div className="account-management-info">
          <div className="account-management-title">
            <strong>{a.name}</strong>
            <span className="account-management-role" data-role={a.role}>
              {a.role==="global_admin" ? ui.global : a.role==="organizer" ? ui.organizer : ui.participant}
            </span>
          </div>
          <p className="account-management-meta">{ui.account} #{a.account_id} · {a.email}</p>
        </div>
        {a.role!=="global_admin"&&<div className="account-management-actions">
          <button className="button button-outline" disabled={busy===a.account_id||a.role==="participant"}
            onClick={()=>changeRole(a,"participant")}>{tr("Participant")}</button>
          <button className="button button-primary" disabled={busy===a.account_id||a.role==="organizer"}
            onClick={()=>changeRole(a,"organizer")}>{tr("Organizer")}</button>
        </div>}
      </div>)}
    </div>}
  </main></div>;
}
