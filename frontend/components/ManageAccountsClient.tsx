"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {AppHeader} from "@/components/AppHeader";
import {useLanguage} from "@/components/LanguageProvider";
import {adminTranslate} from "@/lib/admin-i18n";
import {getManagedAccounts,setManagedAccountRole,getGlobalAdminDelegations,grantGlobalAdmin,revokeGlobalAdmin,banManagedAccount,unbanManagedAccount,getAccountBanHistory} from "@/lib/api";
import type {ManagedAccount,GlobalAdminDelegation,AccountBanHistory} from "@/lib/api";
import {getWebToken} from "@/lib/session";

const ACCOUNT_UI = {"en":{"intro":"Manage participant and organizer roles. A verified account can be granted global administrator access, subject to your MFA confirmation.","grantIntro":"Both global administrators have equal management permissions. Grant access only to an existing account with a verified email. The recipient must then enable MFA.","emailAdmin":"New global administrator email","emailHint":"Verified account email","accounts":"Accounts","account":"Account","global":"Global administrator","organizer":"Organizer","participant":"Participant","roleUpdated":"Role updated.","grantDone":"Permissions granted. The new administrator must finish MFA setup and sign in again.","revoked":"Administrator access revoked.","signIn":"Sign in to manage accounts.","roleConfirm":"Change account role","grantConfirm":"Grant this verified account full TicketTreat management access?","revokeConfirm":"Revoke global administrator access?","target_email_verification_required":"The partner must verify their email in their profile first.","account_not_found_sign_up_first":"No account exists for this email. Check that registration is complete.","mfa_enrollment_required":"Enable two-factor authentication on your administrator account.","mfa_challenge_required":"Verify the MFA code for your administrator session.","global_admin_only":"Only a current global administrator can grant administrator access.","email_verification_required":"Verify your email in your TicketTreat profile.","invalid_session":"Your session expired. Sign in again."},"cs":{"intro":"Spravujte role účastníků a pořadatelů. Ověřenému účtu lze udělit oprávnění hlavního administrátora po potvrzení MFA.","grantIntro":"Oba hlavní administrátoři mají stejná oprávnění. Přístup udělte pouze existujícímu účtu s ověřeným e-mailem. Příjemce pak musí nastavit MFA.","emailAdmin":"E-mail nového hlavního administrátora","emailHint":"E-mail ověřeného účtu","accounts":"Účty","account":"Účet","global":"Hlavní administrátor","organizer":"Pořadatel","participant":"Účastník","roleUpdated":"Role byla změněna.","grantDone":"Oprávnění uděleno. Nový administrátor musí dokončit nastavení MFA a znovu se přihlásit.","revoked":"Přístup administrátora byl odebrán.","signIn":"Pro správu účtů se přihlaste.","roleConfirm":"Změnit roli účtu","grantConfirm":"Udělit tomuto ověřenému účtu plný přístup ke správě TicketTreat?","revokeConfirm":"Odebrat přístup hlavního administrátora?","target_email_verification_required":"Partner musí nejprve ověřit svůj e-mail v profilu.","account_not_found_sign_up_first":"Účet s touto adresou neexistuje. Ověřte dokončení registrace.","mfa_enrollment_required":"Nastavte dvoufaktorové ověření na administrátorském účtu.","mfa_challenge_required":"Potvrďte MFA kód administrátorské relace.","global_admin_only":"Přístup může udělit pouze stávající hlavní administrátor.","email_verification_required":"Ověřte e-mail v profilu TicketTreat.","invalid_session":"Relace vypršela. Přihlaste se znovu."},"ru":{"intro":"Управление ролями участников и организаторов. Главного администратора можно назначить существующему аккаунту с подтверждённой почтой после проверки MFA.","grantIntro":"Оба главных администратора имеют одинаковые права. Назначать их можно только зарегистрированным пользователям с подтверждённым email. После назначения необходимо настроить MFA.","emailAdmin":"Email нового главного администратора","emailHint":"Имейл подтверждённого аккаунта","accounts":"Аккаунты","account":"Аккаунт","global":"Главный администратор","organizer":"Организатор","participant":"Участник","roleUpdated":"Роль обновлена.","grantDone":"Права назначены. Новому администратору необходимо завершить MFA и заново войти.","revoked":"Администратор отозван.","signIn":"Для просмотра аккаунтов необходимо войти.","roleConfirm":"Изменить роль аккаунта","grantConfirm":"Предоставить этому подтверждённому аккаунту полный доступ к управлению TicketTreat?","revokeConfirm":"Отозвать доступ этого главного администратора?","target_email_verification_required":"Партнёр должен сначала подтвердить email в профиле.","account_not_found_sign_up_first":"Аккаунт с таким адресом не найден. Проверь регистрацию.","mfa_enrollment_required":"Заверши подключение двухфакторной защиты.","mfa_challenge_required":"Подтверди код MFA для сессии администратора.","global_admin_only":"Назначать администраторов может только главный администратор.","email_verification_required":"Подтверди email в профиле TicketTreat.","invalid_session":"Сессия завершилась. Войди ещё раз."},"uk":{"intro":"Керування ролями учасників та організаторів. Головного адміністратора можна призначити наявному акаунту з підтвердженою поштою після MFA.","grantIntro":"Обидва головні адміністратори мають однакові права. Призначати їх можна лише зареєстрованим користувачам із підтвердженим email. Після призначення потрібно налаштувати MFA.","emailAdmin":"Email нового головного адміністратора","emailHint":"Email підтвердженого акаунта","accounts":"Акаунти","account":"Акаунт","global":"Головний адміністратор","organizer":"Організатор","participant":"Учасник","roleUpdated":"Роль оновлено.","grantDone":"Права надано. Новий адміністратор має налаштувати MFA та знову ввійти.","revoked":"Права адміністратора відкликано.","signIn":"Увійди для керування акаунтами.","roleConfirm":"Змінити роль акаунта","grantConfirm":"Надати цьому підтвердженому акаунту повний доступ до керування TicketTreat?","revokeConfirm":"Відкликати права головного адміністратора?","target_email_verification_required":"Партнер має спочатку підтвердити email у профілі.","account_not_found_sign_up_first":"Акаунт із такою адресою не знайдено. Перевір реєстрацію.","mfa_enrollment_required":"Налаштуй двофакторний захист акаунта адміністратора.","mfa_challenge_required":"Підтвердь код MFA для сеансу адміністратора.","global_admin_only":"Призначати адміністраторів може лише головний адміністратор.","email_verification_required":"Підтвердь email у профілі TicketTreat.","invalid_session":"Сеанс завершився. Увійди знову."}};

const MERGED_VIEW = {
  en:{show:"Show merged accounts (audit)",archived:"Merged into account",exclude:"Merged accounts are hidden from the active list; their history is retained."},
  cs:{show:"Zobrazit sloučené účty (audit)",archived:"Sloučeno do účtu",exclude:"Sloučené účty jsou skryté v aktivním seznamu, historie zůstává zachována."},
  ru:{show:"Показать объединённые аккаунты (аудит)",archived:"Объединён с аккаунтом",exclude:"Объединённые аккаунты скрыты из активного списка, история сохранена."},
  uk:{show:"Показати об'єднані акаунти (аудит)",archived:"Об'єднано з акаунтом",exclude:"Об'єднані акаунти приховані з активного списку, історію збережено."}
} as const;

const BAN_UI = {
  en:{ban:"Ban account",unban:"Unban",banned:"Banned",reason:"Reason for ban",placeholder:"Describe the violation (at least 8 characters)",banConfirm:"Ban this account and revoke all active sessions?",unbanConfirm:"Restore this account's access? The user will need to sign in again.",banDone:"Account banned; all web sessions revoked.",unbanDone:"Account unbanned. A new sign-in is required.",history:"Ban history",hideHistory:"Hide history",by:"Admin",at:"On",noHistory:"No bans recorded.",reasonRequired:"Please provide a reason of at least 8 characters.",protected:"Global administrators cannot be banned.",account_banned:"This account is banned.",account_already_banned:"Account is already banned.",account_not_banned:"Account is not banned.",cannot_ban_global_admin:"Global administrator accounts are protected.",merged_account_locked:"Merged accounts cannot be banned."},
  cs:{ban:"Zablokovat účet",unban:"Odblokovat",banned:"Zablokován",reason:"Důvod blokace",placeholder:"Popište porušení pravidel (alespoň 8 znaků)",banConfirm:"Zablokovat účet a zrušit všechna aktivní přihlášení?",unbanConfirm:"Obnovit přístup k účtu? Uživatel se bude muset znovu přihlásit.",banDone:"Účet zablokován a přihlášení zrušena.",unbanDone:"Účet odblokován. Je nutné nové přihlášení.",history:"Historie blokací",hideHistory:"Skrýt historii",by:"Správce",at:"Dne",noHistory:"Žádné blokace.",reasonRequired:"Uveďte důvod alespoň o 8 znacích.",protected:"Hlavní správce nelze zablokovat.",account_banned:"Tento účet je zablokován.",account_already_banned:"Účet je již zablokován.",account_not_banned:"Účet není zablokován.",cannot_ban_global_admin:"Účty hlavních správců jsou chráněny.",merged_account_locked:"Sloučený účet nelze zablokovat."},
  ru:{ban:"Заблокировать",unban:"Разблокировать",banned:"Заблокирован",reason:"Причина блокировки",placeholder:"Опиши нарушение (не менее 8 символов)",banConfirm:"Заблокировать аккаунт и завершить все его сессии?",unbanConfirm:"Восстановить доступ? Пользователю потребуется снова войти.",banDone:"Аккаунт заблокирован, сессии завершены.",unbanDone:"Аккаунт разблокирован. Нужен повторный вход.",history:"История блокировок",hideHistory:"Скрыть историю",by:"Админ",at:"Дата",noHistory:"Блокировок не было.",reasonRequired:"Укажи причину длиной минимум 8 символов.",protected:"Главных администраторов блокировать нельзя.",account_banned:"Этот аккаунт заблокирован.",account_already_banned:"Аккаунт уже заблокирован.",account_not_banned:"Аккаунт не заблокирован.",cannot_ban_global_admin:"Главных администраторов блокировать нельзя.",merged_account_locked:"Объединённый аккаунт заблокировать нельзя."},
  uk:{ban:"Заблокувати",unban:"Розблокувати",banned:"Заблокований",reason:"Причина блокування",placeholder:"Опиши порушення (не менше 8 символів)",banConfirm:"Заблокувати акаунт і завершити всі його сесії?",unbanConfirm:"Відновити доступ? Користувачеві потрібно ввійти знову.",banDone:"Акаунт заблоковано, сесії завершено.",unbanDone:"Акаунт розблоковано. Потрібен повторний вхід.",history:"Історія блокувань",hideHistory:"Сховати історію",by:"Адмін",at:"Дата",noHistory:"Блокувань не було.",reasonRequired:"Вкажи причину щонайменше з 8 символів.",protected:"Головних адміністраторів блокувати не можна.",account_banned:"Цей акаунт заблоковано.",account_already_banned:"Акаунт уже заблокований.",account_not_banned:"Акаунт не заблоковано.",cannot_ban_global_admin:"Головних адміністраторів блокувати не можна.",merged_account_locked:"Об'єднаний акаунт не можна заблокувати."}
} as const;

export function ManageAccountsClient() {
  const {language}=useLanguage();
  const tr=(phrase:string)=>adminTranslate(language,phrase);
  const ui=ACCOUNT_UI[language];
  const mergedUI=MERGED_VIEW[language];
  const banUI=BAN_UI[language];
  const [showMerged,setShowMerged]=useState(false);
  const display=(msg:string)=>msg.startsWith("msg:")?ui[msg.slice(4) as keyof typeof ui]||msg:msg;
  const [accounts,setAccounts]=useState<ManagedAccount[]>([]);
  const [delegations,setDelegations]=useState<GlobalAdminDelegation[]>([]);
  const [inviteEmail,setInviteEmail]=useState("");
  const [banTarget,setBanTarget]=useState<number|null>(null);
  const [banReason,setBanReason]=useState("");
  const [historyTarget,setHistoryTarget]=useState<number|null>(null);
  const [banHistory,setBanHistory]=useState<AccountBanHistory[]>([]);
  const [error,setError]=useState(""),[notice,setNotice]=useState("");
  const [busy,setBusy]=useState<number|null>(null),[loading,setLoading]=useState(true);
  useEffect(()=>{
    const token=getWebToken();
    if(!token){setError("msg:signIn");setLoading(false);return;}
    Promise.all([getManagedAccounts(token,showMerged),getGlobalAdminDelegations(token)])
      .then(([users,grants])=>{setAccounts(users);setDelegations(grants);})
      .catch(e=>setError(e instanceof Error?e.message:String(e))).finally(()=>setLoading(false));
  },[showMerged]);
  async function changeRole(account:ManagedAccount,role:"participant"|"organizer"){
    const token=getWebToken();if(!token)return;
    if(account.merged_into_account_id||account.banned)return;
    if(!window.confirm(`${ui.roleConfirm} #${account.account_id}: ${ui[role]}?`))return;
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
      const [users,grants]=await Promise.all([getManagedAccounts(token,showMerged),getGlobalAdminDelegations(token)]);
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
      const [users,grants]=await Promise.all([getManagedAccounts(token,showMerged),getGlobalAdminDelegations(token)]);
      setAccounts(users);setDelegations(grants);setNotice("msg:revoked");
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(null);}
  }
  async function ban(account:ManagedAccount) {
    const token=getWebToken();if(!token||account.banned||account.role==="global_admin")return;
    const reason=banReason.trim();
    if(reason.length<8){setError(banUI.reasonRequired);return;}
    if(!window.confirm(`${banUI.banConfirm}\n#${account.account_id} ${account.email||account.name}\n${banUI.reason}: ${reason}`))return;
    setBusy(account.account_id);setError("");setNotice("");
    try{
      const result=await banManagedAccount(token,account.account_id,reason);
      setAccounts(prev=>prev.map(a=>a.account_id===account.account_id?{...a,...result}:a));
      setBanTarget(null);setBanReason("");setNotice(banUI.banDone);
      setHistoryTarget(null);
    }catch(e){const message=e instanceof Error?e.message:String(e);setError(banUI[message as keyof typeof banUI]||message);}
    finally{setBusy(null);}
  }
  async function unban(account:ManagedAccount) {
    const token=getWebToken();if(!token||!account.banned)return;
    if(!window.confirm(`${banUI.unbanConfirm}\n#${account.account_id} ${account.email||account.name}`))return;
    setBusy(account.account_id);setError("");setNotice("");
    try{
      await unbanManagedAccount(token,account.account_id);
      setAccounts(prev=>prev.map(a=>a.account_id===account.account_id?{...a,banned:false,ban_reason:null,banned_at:null}:a));
      setNotice(banUI.unbanDone);setHistoryTarget(null);
    }catch(e){const message=e instanceof Error?e.message:String(e);setError(banUI[message as keyof typeof banUI]||message);}
    finally{setBusy(null);}
  }
  async function toggleHistory(accountId:number){
    if(historyTarget===accountId){setHistoryTarget(null);return;}
    const token=getWebToken();if(!token)return;
    setBusy(accountId);setError("");
    try{setBanHistory(await getAccountBanHistory(token,accountId));setHistoryTarget(accountId);}
    catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(null);}
  }
  return <div className="app-shell"><AppHeader/><main className="page">
    <Link href="/admin" className="back-link">{tr("Organizer dashboard")}</Link>
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
      <label className="form-note" style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"12px"}}>
        <input type="checkbox" checked={showMerged}
          onChange={e=>{setLoading(true);setShowMerged(e.target.checked);}} />
        {mergedUI.show}
      </label>
      <p className="form-note">{mergedUI.exclude}</p>
      {accounts.map(a=><div className="account-management-row" key={a.account_id}>
        <div className="account-management-info">
          <div className="account-management-title">
            <strong>{a.name}</strong>
            <span className="account-management-role" data-role={a.role}>
              {a.merged_into_account_id ? `${mergedUI.archived} #${a.merged_into_account_id}`
                :a.role==="global_admin" ? ui.global : a.role==="organizer" ? ui.organizer : ui.participant}
            </span>
          </div>
          <p className="account-management-meta">{ui.account} #{a.account_id}, {a.email}</p>
          {a.banned&&<p className="account-ban-warning" role="status"><strong>{banUI.banned}</strong>{a.banned_at?` · ${new Date(a.banned_at).toLocaleString(language)}`:""}<span>{a.ban_reason}</span></p>}
        </div>
        {!a.merged_into_account_id&&a.role!=="global_admin"&&<div className="account-management-actions">
          <button className="button button-outline" disabled={busy!==null||a.banned||a.role==="participant"}
            onClick={()=>changeRole(a,"participant")}>{tr("Participant")}</button>
          <button className="button button-primary" disabled={busy!==null||a.banned||a.role==="organizer"}
            onClick={()=>changeRole(a,"organizer")}>{tr("Organizer")}</button>
          {a.banned
            ?<button type="button" className="button button-outline" disabled={busy!==null} onClick={()=>unban(a)}>{banUI.unban}</button>
            :<button type="button" className="button button-outline account-ban-button" disabled={busy!==null}
                onClick={()=>{setBanTarget(banTarget===a.account_id?null:a.account_id);setBanReason("");}}>{banUI.ban}</button>}
          <button type="button" className="button button-outline" disabled={busy!==null}
            onClick={()=>toggleHistory(a.account_id)}>{historyTarget===a.account_id?banUI.hideHistory:banUI.history}</button>
        </div>}
        {banTarget===a.account_id&&!a.banned&&<div className="account-ban-form">
          <label>{banUI.reason}
            <textarea value={banReason} maxLength={500} rows={2} placeholder={banUI.placeholder}
              onChange={e=>setBanReason(e.target.value)}/>
          </label>
          <button type="button" className="button button-outline account-ban-button" disabled={busy!==null||banReason.trim().length<8}
            onClick={()=>ban(a)}>{banUI.ban} #{a.account_id}</button>
        </div>}
        {historyTarget===a.account_id&&<div className="account-ban-history">
          {banHistory.length===0?<p>{banUI.noHistory}</p>:banHistory.map((event,i)=><p key={i}>
            <strong>{event.action==="ban"?banUI.ban:banUI.unban}</strong> · {banUI.by} #{event.actor_account_id} · {banUI.at} {new Date(event.created_at).toLocaleString(language)}<span>{event.reason}</span>
          </p>)}
        </div>}
      </div>)}
    </div>}
  </main></div>;
}
