"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {AppHeader} from "@/components/AppHeader";
import {useLanguage} from "@/components/LanguageProvider";
import {adminTranslate} from "@/lib/admin-i18n";
import {getManagedAccounts,setManagedAccountRole,getGlobalAdminDelegations,grantGlobalAdmin,revokeGlobalAdmin} from "@/lib/api";
import type {ManagedAccount,GlobalAdminDelegation} from "@/lib/api";
import {getWebToken} from "@/lib/session";

function adminGrantError(error:unknown):string {
  const message=error instanceof Error?error.message:String(error);
  const known:Record<string,string>={
    target_email_verification_required:"Сначала партнёр должен подтвердить свой email в личном профиле TicketTreat, затем повторите назначение.",
    account_not_found_sign_up_first:"Аккаунт с таким адресом не найден. Проверьте email и убедитесь, что партнёр завершил регистрацию.",
    mfa_enrollment_required:"Завершите подключение двухфакторной аутентификации для своего администраторского аккаунта.",
    mfa_challenge_required:"Подтвердите MFA-код для своей сессии администратора и повторите действие.",
    global_admin_only:"Назначать главных администраторов может только действующий глобальный администратор.",
    email_verification_required:"Подтвердите ваш email в профиле TicketTreat.",
    invalid_session:"Сессия завершилась. Войдите в TicketTreat ещё раз."
  };
  return known[message]||message;
}

export function ManageAccountsClient() {
  const {language}=useLanguage();
  const tr=(phrase:string)=>adminTranslate(language,phrase);
  const [accounts,setAccounts]=useState<ManagedAccount[]>([]);
  const [delegations,setDelegations]=useState<GlobalAdminDelegation[]>([]);
  const [inviteEmail,setInviteEmail]=useState("");
  const [error,setError]=useState(""),[notice,setNotice]=useState("");
  const [busy,setBusy]=useState<number|null>(null),[loading,setLoading]=useState(true);
  useEffect(()=>{
    const token=getWebToken();
    if(!token){setError("Для просмотра аккаунтов необходимо войти.");setLoading(false);return;}
    Promise.all([getManagedAccounts(token),getGlobalAdminDelegations(token)])
      .then(([users,grants])=>{setAccounts(users);setDelegations(grants);})
      .catch(e=>setError(e instanceof Error?e.message:String(e))).finally(()=>setLoading(false));
  },[]);
  async function changeRole(account:ManagedAccount,role:"participant"|"organizer"){
    const token=getWebToken();if(!token)return;
    if(!window.confirm(`Изменить роль аккаунта #${account.account_id} на ${role}?`))return;
    setBusy(account.account_id);setError("");setNotice("");
    try{
      await setManagedAccountRole(token,account.account_id,role);
      setAccounts(prev=>prev.map(a=>a.account_id===account.account_id?{...a,role}:a));
      setNotice("Роль обновлена");
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setBusy(null)}
  }
  async function grant() {
    const token=getWebToken();if(!token||!inviteEmail.trim())return;
    if(!window.confirm("Предоставить этому подтверждённому аккаунту полный доступ к управлению TicketTreat?"))return;
    setBusy(-1);setError("");setNotice("");
    try {
      await grantGlobalAdmin(token,inviteEmail.trim());
      const [users,grants]=await Promise.all([getManagedAccounts(token),getGlobalAdminDelegations(token)]);
      setAccounts(users);setDelegations(grants);setInviteEmail("");
      setNotice("Права назначены. Новому администратору необходимо завершить MFA и заново войти.");
    } catch(e){setError(adminGrantError(e));}
    finally{setBusy(null);}
  }
  async function revoke(accountId:number) {
    const token=getWebToken();if(!token)return;
    if(!window.confirm("Отозвать доступ этого главного администратора?"))return;
    setBusy(accountId);setError("");setNotice("");
    try{
      await revokeGlobalAdmin(token,accountId);
      const [users,grants]=await Promise.all([getManagedAccounts(token),getGlobalAdminDelegations(token)]);
      setAccounts(users);setDelegations(grants);setNotice("Администратор отозван.");
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(null);}
  }
  return <div className="app-shell"><AppHeader/><main className="page">
    <Link href="/admin" className="back-link">{tr("← Organizer dashboard")}</Link>
    <div className="admin-heading"><div><span className="status status-demo">GLOBAL ADMIN</span><h1>{tr("Управление аккаунтами")}</h1>
      <p>Разрешение ролей участников и организаторов. Главного администратора можно безопасно назначить существующему аккаунту с подтверждённой почтой. Требуется ваша двухфакторная авторизация.</p></div></div>
    {error&&<div className="state-card state-error">{error}</div>}
    {notice&&<div className="success-banner">{notice}</div>}
    <section className="panel form-stack">
      <h2>{tr("Главные администраторы")}</h2>
      <p className="form-note">Оба администратора имеют одинаковые права: события, главная страница, участники и роли. Нельзя назначить права до создания аккаунта и подтверждения email. После назначения получатель должен настроить двухфакторную аутентификацию.</p>
      <label>Email нового главного администратора
        <input type="email" autoComplete="off" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="Имейл подтверждённого аккаунта"/>
      </label>
      <button type="button" className="button button-primary" disabled={busy!==null||!inviteEmail.includes("@")} onClick={grant}>{tr("Назначить главного администратора")}</button>
      {delegations.map(d=><div className="account-management-row" key={d.account_id}>
        <div className="account-management-info"><strong>{d.email}</strong><small>Account #{d.account_id}</small></div>
        <button type="button" className="button button-outline" disabled={busy!==null} onClick={()=>revoke(d.account_id)}>{tr("Отозвать")}</button>
      </div>)}
    </section>
    {loading?<div className="state-card">{tr("Загрузка…")}</div>:<div className="panel">
      <h2>Аккаунты ({accounts.length})</h2>
      {accounts.map(a=><div className="account-management-row" key={a.account_id}>
        <div className="account-management-info">
          <div className="account-management-title">
            <strong>{a.name}</strong>
            <span className="account-management-role" data-role={a.role}>
              {a.role==="global_admin" ? "Global admin" : a.role==="organizer" ? "Organizer" : "Participant"}
            </span>
          </div>
          <p className="account-management-meta">Account #{a.account_id} · {a.email}</p>
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
