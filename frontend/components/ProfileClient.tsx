"use client";

import Link from "next/link";
import {GoogleSignIn} from "@/components/GoogleSignIn";
import { FormEvent, useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { getVerifiedTelegramSession } from "@/lib/session";
import { useLanguage } from "@/components/LanguageProvider";
import { getStoredGuestToken, clearWebAuth, getWebToken, restoreWebProfile, setWebAuth, storeGuest } from "@/lib/session";
import { getWebProfile, loginWebAccount, logoutWebAccount, signupWebAccount, updateWebProfile, changeWebPassword, logoutAllWebSessions, getWebSessions, requestEmailVerification, confirmAccountEmail, requestPasswordReset, confirmPasswordReset, getMailStatus, linkTelegramToWebsite, startTelegramAccountLink, getTelegramAccountLinkStatus, claimTelegramAccountLink, elevateMFA } from "@/lib/api";
import type { LanguageCode, TelegramAuthResult, WebProfile } from "@/lib/types";

const COPY: Record<LanguageCode, Record<string, string>> = {
  ru: {
    title:"Мой профиль", login:"Войти",signup:"Регистрация",first:"Имя",last:"Фамилия",
    email:"Электронная почта",password:"Пароль (не менее 12 символов)",phone:"Телефон",
    instagram:"Instagram (необязательно)",contact:"Предпочтительный способ связи",
    save:"Сохранить изменения",saving:"Сохраняем…",loading:"Загрузка…",
    logout:"Выйти",welcome:"С возвращением!",create:"Создать аккаунт",need:"Зарегистрируйся, чтобы иметь доступ к билетам с любого устройства.",
    note:"Подтверждение email и восстановление пароля работают только при настроенном почтовом провайдере. Используй уникальный пароль.",
    visits:"Посещений",tickets:"Мои билеты",profile:"Данные профиля",
    accountCreated:"Аккаунт создан.",updated:"Профиль обновлён.",required:"Заполни обязательные поля.",
    emailUsed:"На этот email уже зарегистрирован аккаунт. Попробуй войти.",
    credentials:"Неверный email или пароль.",rate:"Слишком много попыток. Повтори через 10 минут.",
    authExpired:"Сессия истекла. Войди повторно.",back:"К событиям",passwordHint:"Пароль нужен для входа с другого устройства.",
  },
  en: {
    title:"My profile",login:"Log in",signup:"Sign up",first:"First name",last:"Last name",
    email:"Email",password:"Password (at least 12 characters)",phone:"Phone",
    instagram:"Instagram (optional)",contact:"Preferred contact method",save:"Save changes",
    saving:"Saving…",loading:"Loading…",logout:"Log out",welcome:"Welcome back!",
    create:"Create account",need:"Register to access your tickets from any device.",
    note:"Email verification and password recovery require a configured email provider. Use a unique password.",
    visits:"Check-ins",tickets:"My tickets",profile:"Profile details",
    accountCreated:"Account created.",updated:"Profile updated.",required:"Complete the required fields.",
    emailUsed:"An account with this email already exists. Try logging in.",
    credentials:"Invalid email or password.",rate:"Too many attempts. Try again in 10 minutes.",
    authExpired:"Session expired. Log in again.",back:"Back to events",passwordHint:"Use this password when logging in on another device.",
  },
  cs: {
    title:"Můj profil",login:"Přihlásit se",signup:"Registrace",first:"Jméno",last:"Příjmení",
    email:"E-mail",password:"Heslo (alespoň 12 znaků)",phone:"Telefon",
    instagram:"Instagram (nepovinné)",contact:"Preferovaný kontakt",save:"Uložit změny",
    saving:"Ukládání…",loading:"Načítání…",logout:"Odhlásit se",welcome:"Vítej zpět!",
    create:"Vytvořit účet",need:"Zaregistruj se a měj vstupenky dostupné na každém zařízení.",
    note:"Ověření e-mailu a obnovení hesla vyžadují aktivní e-mailovou službu.",
    visits:"Návštěvy",tickets:"Moje vstupenky",profile:"Údaje profilu",
    accountCreated:"Účet vytvořen.",updated:"Profil aktualizován.",required:"Vyplň povinná pole.",
    emailUsed:"Účet s tímto e-mailem již existuje. Přihlas se.",
    credentials:"Nesprávný e-mail nebo heslo.",rate:"Příliš mnoho pokusů. Zkus to za 10 minut.",
    authExpired:"Přihlášení vypršelo. Přihlas se znovu.",back:"Zpět na události",passwordHint:"Toto heslo použiješ při přihlášení z jiného zařízení.",
  },
  uk: {
    title:"Мій профіль",login:"Увійти",signup:"Реєстрація",first:"Ім’я",last:"Прізвище",
    email:"Електронна пошта",password:"Пароль (не менше 12 символів)",phone:"Телефон",
    instagram:"Instagram (необов’язково)",contact:"Бажаний спосіб зв’язку",
    save:"Зберегти зміни",saving:"Зберігаємо…",loading:"Завантаження…",
    logout:"Вийти",welcome:"З поверненням!",create:"Створити акаунт",
    need:"Зареєструйся, щоб бачити квитки з будь-якого пристрою.",
    note:"Підтвердження email і відновлення пароля потребують налаштованої пошти. Використовуй унікальний пароль.",
    visits:"Відвідувань",tickets:"Мої квитки",profile:"Дані профілю",
    accountCreated:"Акаунт створено.",updated:"Профіль оновлено.",required:"Заповни обов’язкові поля.",
    emailUsed:"Акаунт з таким email уже існує. Спробуй увійти.",
    credentials:"Невірний email або пароль.",rate:"Забагато спроб. Повтори через 10 хвилин.",
    authExpired:"Сесія завершилась. Увійди повторно.",back:"До подій",passwordHint:"Використовуй цей пароль для входу з іншого пристрою.",
  },
};

type ContactPreference = "email" | "phone" | "telegram" | "instagram";

export function ProfileClient() {
  const {language} = useLanguage();
  const tr = COPY[language];
  const [mode, setMode] = useState<"login"|"signup">("login");
  const [telegramProfile, setTelegramProfile] = useState<TelegramAuthResult|null>(null);
  const [profile, setProfile] = useState<WebProfile|null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [sessionCount, setSessionCount] = useState<number | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [instagram, setInstagram] = useState("");
  const [contact, setContact] = useState<ContactPreference>("email");
  const [verificationCode,setVerificationCode]=useState("");
  const [resetOpen,setResetOpen]=useState(false);
  const [mailReady,setMailReady]=useState<boolean|null>(null);
  const [resetCode,setResetCode]=useState("");
  const [resetPassword,setResetPassword]=useState("");
  const [accountRole, setAccountRole] = useState<"participant"|"organizer">("participant");
  const [linkRequest, setLinkRequest] = useState<{challenge:string;bot_link:string}|null>(null);
  const [incomingLink, setIncomingLink] = useState("");
  const [linkConfirmed, setLinkConfirmed] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  const [mfaLinkAction, setMfaLinkAction] = useState<"current"|"browser"|null>(null);
  const [mfaLinkSetup, setMfaLinkSetup] = useState(false);
  const [mfaLinkCode, setMfaLinkCode] = useState("");
  const [mfaLinkBusy, setMfaLinkBusy] = useState(false);


  useEffect(() => {
    let mounted = true;
    void getVerifiedTelegramSession().then(tg => {
      if (mounted) setTelegramProfile(tg);
    }).catch(() => { /* Signed Telegram login is optional for browser users. */ });
    void getMailStatus().then(data=>{if(mounted)setMailReady(data.available===true);}).catch(()=>{if(mounted)setMailReady(false);});
    const pendingLink = new URLSearchParams(window.location.search).get("telegram_link") || "";
    if (/^[a-zA-Z0-9_-]{24,100}$/.test(pendingLink)) setIncomingLink(pendingLink);
    // The Google OAuth callback writes an HttpOnly cookie and redirects here.
    // The browser-session marker is not a credential; it merely asks the
    // gateway to validate that cookie. A missing/invalid cookie is rejected
    // server-side and restoreWebProfile() clears the marker on 401.
    if (new URLSearchParams(window.location.search).get("google") === "success") {
      window.localStorage.setItem("tickettreat_web_auth", "browser-session");
    }
    restoreWebProfile()
      .then((p) => { if(mounted && p) loadProfile(p); })
      .catch(() => { if (mounted) setError("Connection to the profile service failed."); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  // Browser tab checks the one-time handshake until Telegram confirms it.
  useEffect(() => {
    if (!linkRequest) return;
    let mounted=true;
    let checking=false;
    const check=async()=>{
      if(checking)return;
      const token=getWebToken();if(!token)return;
      checking=true;
      try {
        const result=await getTelegramAccountLinkStatus(token,linkRequest.challenge);
        if(!mounted)return;
        if(result.linked) {
          setLinkRequest(null);
          const updated=await getWebProfile(token);
          if(mounted) {loadProfile(updated);setNotice("Telegram successfully linked.");}
        } else if(result.status!=="pending") {
          setLinkRequest(null);
          setError("Telegram link expired. Start again.");
        }
      } catch { /* A transient network error does not consume the challenge. */ }
      finally {checking=false;}
    };
    void check();
    const interval=window.setInterval(()=>{void check();},2500);
    return ()=>{mounted=false;window.clearInterval(interval);};
  },[linkRequest]);

  // Privileged website sessions must complete a new TOTP assertion before
  // linking identities. Preserve the backend's MFA enforcement.
  function handleTelegramLinkError(err:unknown, action:"current"|"browser"){
    const detail=err instanceof Error ? err.message : String(err);
    if(detail==="mfa_challenge_required" || detail==="mfa_enrollment_required"){
      setMfaLinkAction(action);
      setMfaLinkSetup(detail==="mfa_enrollment_required");
      setMfaLinkCode("");
      setError("");
      return;
    }
    setError(readableError(err));
  }

  async function linkCurrentTelegram(){
    const token=getWebToken();
    const initData=(await import("@/lib/telegram")).getTelegramWebApp()?.initData;
    if(!token||!initData){setError("Open the account link inside @TicketTreatBot while signed into the website.");return;}
    setBusy(true);setError("");setNotice("");
    try{
      await linkTelegramToWebsite(token,initData);
      loadProfile(await getWebProfile(token));
      setMfaLinkAction(null);
      setNotice(language==="ru"?"Telegram успешно привязан.":"Telegram successfully linked.");
    }catch(e){handleTelegramLinkError(e,"current");}
    finally{setBusy(false);}
  }

  async function verifyMfaAndResumeLink(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    const action=mfaLinkAction;
    if(!action||!/^[0-9]{6}$/.test(mfaLinkCode))return;
    setMfaLinkBusy(true);setError("");
    try{
      const verified=await elevateMFA(mfaLinkCode);
      if(!verified.elevated)throw new Error("mfa_challenge_required");
      setMfaLinkAction(null);
      setMfaLinkCode("");
      if(action==="current")await linkCurrentTelegram();
      else await beginTelegramLink();
    }catch(err){
      const detail=err instanceof Error?err.message:String(err);
      if(detail==="invalid_mfa_code")setError(language==="ru"?"Неверный или уже использованный код. Введи новый код из приложения-аутентификатора.":"Invalid or already used code. Enter a new code from your authenticator.");
      else handleTelegramLinkError(err,action);
    }finally{setMfaLinkBusy(false);}
  }

  async function beginTelegramLink(){
    const token=getWebToken();if(!token)return;
    setLinkBusy(true);setError("");setNotice("");
    try {
      const result=await startTelegramAccountLink(token);
      setLinkRequest({challenge:result.challenge,bot_link:result.bot_link});
      window.open(result.bot_link,"_blank","noopener,noreferrer");
    }catch(e){handleTelegramLinkError(e,"browser");}
    finally{setLinkBusy(false);}
  }

  async function approveTelegramLink(){
    const initData=(await import("@/lib/telegram")).getTelegramWebApp()?.initData;
    if(!initData||!incomingLink||!telegramProfile) {
      setError("Open this confirmation inside @TicketTreatBot.");
      return;
    }
    setLinkBusy(true);setError("");
    try {
      const result=await claimTelegramAccountLink(incomingLink,initData);
      if(result.linked){
        setLinkConfirmed(true);
        setNotice("Telegram and website accounts are connected. All available tickets are shared.");
      }
    }catch(e){setError(readableError(e));}
    finally{setLinkBusy(false);}
  }

  function loadProfile(p: WebProfile) {
    setProfile(p);
    storeGuest(p.guest);
    setEmail(p.account.email);
    setFirstName(p.account.first_name);
    setLastName(p.account.last_name);
    setPhone(p.account.phone || "");
    setInstagram(p.account.instagram || "");
    setContact(p.account.contact_preference);
    const token = getWebToken();
    if (token) void getWebSessions(token).then(result => setSessionCount(result.sessions.length)).catch(() => setSessionCount(null));
  }

  function readableError(err: unknown): string {
    const raw = err instanceof Error ? err.message : "Error";
    const code = (err as {status?:number})?.status;
    if (raw === "email_already_registered") return tr.emailUsed;
    if (raw === "invalid_credentials") return tr.credentials;
    if (code === 429) return tr.rate;
    if (code === 401) return tr.authExpired;
    if (code === 422) return tr.required;
    return raw;
  }

  async function submitAuth(e: FormEvent) {
    e.preventDefault();
    setError(""); setNotice(""); setBusy(true);
    try {
      const result = mode === "signup"
        ? await signupWebAccount({
            email: email.trim(), password,
            first_name: firstName.trim(), last_name: lastName.trim(),
            phone: phone.trim() || null, instagram: instagram.trim() || null,
            contact_preference: contact,
            account_role: accountRole,
            country_code:"CZ",city:"",
            guest_token: getStoredGuestToken(),
            language,
          })
        : await loginWebAccount(email.trim(), password);
      setWebAuth(result);
      loadProfile(result.profile);
      setNotice(mode === "signup" ? tr.accountCreated : tr.welcome);
      setPassword("");
    } catch(err) { setError(readableError(err)); }
    finally { setBusy(false); }
  }

  async function submitProfile(e: FormEvent) {
    e.preventDefault();
    const token = getWebToken();
    if (!token) { setError(tr.authExpired); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await updateWebProfile(token, {
        first_name:firstName.trim(), last_name:lastName.trim(),
        phone:phone.trim()||null, instagram:instagram.trim()||null,
        contact_preference:contact,
        country_code:"CZ",city:"",
      });
      loadProfile(result);
      setNotice(tr.updated);
    } catch(err) { setError(readableError(err)); }
    finally { setBusy(false); }
  }

  async function updatePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const token = getWebToken();
    if (!token) {setError(tr.authExpired);return;}
    if(newPassword.length < 12 || newPassword.length > 128) {
      setError(language === "ru" ? "Новый пароль должен содержать 12–128 символов." : "New password must be 12–128 characters.");
      return;
    }
    if(newPassword !== confirmPassword) {
      setError(language === "ru" ? "Пароли не совпадают." : "Passwords do not match.");
      return;
    }
    setBusy(true);setError("");setNotice("");
    try {
      const auth = await changeWebPassword(token,oldPassword,newPassword);
      setWebAuth(auth);
      loadProfile(auth.profile);
      setOldPassword("");setNewPassword("");setConfirmPassword("");
      setNotice(language === "ru" ? "Пароль изменён. Все другие устройства вышли из аккаунта." :
        language === "cs" ? "Heslo bylo změněno. Ostatní zařízení byla odhlášena." :
        language === "uk" ? "Пароль змінено. Інші пристрої вийшли з акаунта." :
        "Password updated. All other devices were signed out.");
    }catch(err){setError(readableError(err));}
    finally{setBusy(false);}
  }

  async function signOutAllDevices() {
    const token=getWebToken();
    if(!token)return;
    if(!window.confirm(language === "ru" ? "Завершить все сессии?" : "Sign out of all devices?"))return;
    setBusy(true);setError("");setNotice("");
    try{
      await logoutAllWebSessions(token);
      clearWebAuth();setProfile(null);setSessionCount(null);setMode("login");
      setOldPassword("");setNewPassword("");setConfirmPassword("");
    }catch(err){setError(readableError(err));}
    finally{setBusy(false);}
  }

  async function logOut() {
    const token = getWebToken();
    clearWebAuth(); setProfile(null); setMode("login"); setNotice("");
    if (token) { try { await logoutWebAccount(token); } catch { /* local logout already complete */ } }
    setPassword("");
  }

  const details = (
    <>
      <div className="two-col">
        <label>{tr.first}<input required maxLength={100} autoComplete="given-name" value={firstName} onChange={e=>setFirstName(e.target.value)} /></label>
        <label>{tr.last}<input required maxLength={100} autoComplete="family-name" value={lastName} onChange={e=>setLastName(e.target.value)} /></label>
      </div>
      <label>{tr.phone}<input type="tel" maxLength={40} autoComplete="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+420 ..." /></label>
      <label>{tr.instagram}<input maxLength={100} value={instagram} onChange={e=>setInstagram(e.target.value)} placeholder="@username" /></label>
      <label>{tr.contact}
        <select value={contact} onChange={e=>setContact(e.target.value as ContactPreference)}>
          <option value="email">Email</option>
          <option value="phone">{tr.phone}</option>
          <option value="telegram">Telegram</option>
          <option value="instagram">Instagram</option>
        </select>
      </label>
    </>
  );

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="page auth-container">
        <Link href="/" className="back-link">← {tr.back}</Link>
        {incomingLink && <section className="panel form-stack" aria-label="Telegram account linking">
          <h2>{language==="ru"?"Подтверждение Telegram":"Confirm Telegram account"}</h2>
          {linkConfirmed ? <p role="status">{language==="ru"?"✓ Аккаунты связаны. Вернись на сайт и открой «Мои билеты».":"✓ Accounts linked. Return to the website to see your tickets."}</p> : <>
            <p className="form-note">{language==="ru"?"Подтверди привязку этого Telegram к веб-аккаунту TicketTreat. Не передавай ссылку другим.":"Confirm linking this Telegram account to your TicketTreat website account. Never share the link."}</p>
            {!telegramProfile && <p className="form-note">{language==="ru"?"Открой эту ссылку внутри @TicketTreatBot, чтобы Telegram подтвердил твою личность.":"Open this link from @TicketTreatBot to verify your Telegram identity."}</p>}
            <button type="button" className="button button-primary" disabled={!telegramProfile||linkBusy}
              onClick={()=>{void approveTelegramLink();}}>{linkBusy?"…":language==="ru"?"Подтвердить привязку":"Confirm link"}</button>
          </>}
        </section>}

        {loading ? <div className="state-card">{tr.loading}</div> : profile ? (
          <>
            <section className="panel profile-overview">
              <div className="profile-top">
                <div className="profile-avatar">{profile.account.first_name.charAt(0).toUpperCase()}</div>
                <div className="profile-identity">
                  <h1>{profile.account.first_name} {profile.account.last_name}</h1>
                  <p>{profile.account.email}</p>
                </div>
              </div>
              <div className="profile-identity-meta">
                <span className="profile-role-chip">
                  {profile.account.role === "participant" ? "Participant" : "Organizer"}
                </span>
              </div>
              <div className="profile-facts">
                <div className="profile-fact"><span>{tr.visits}</span><strong>{profile.guest.visits}</strong></div>
                <div className="profile-fact"><span>{tr.tickets}</span><Link href="/tickets" className="button button-outline">→ {tr.tickets}</Link></div>
              </div>
              {profile.email_verified && <section className="panel form-stack">
                <h3>{language==="ru"?"Telegram и TicketTreat":"Telegram and TicketTreat"}</h3>
                {profile.guest.telegram_id ? <p className="form-note">✓ {language==="ru"?"Telegram привязан. Сайт и бот используют одни билеты и регистрации.":"Telegram linked. Website and bot share your tickets and bookings."}</p> : <>
                  <p className="form-note">{language==="ru"?"Свяжи старый аккаунт Telegram с сайтом — билеты и очереди перенесутся без повторной регистрации. Понадобится подтвердить владение Telegram.":"Connect your existing Telegram account to this website profile without losing tickets. Telegram confirmation is required."}</p>
                  {telegramProfile && <button className="button button-outline" type="button" disabled={busy||mfaLinkBusy}
                    onClick={()=>{void linkCurrentTelegram();}}>{language==="ru"?"Привязать текущий Telegram":"Link current Telegram"}</button>}
                  <button className="button button-primary" type="button" disabled={linkBusy}
                    onClick={()=>{void beginTelegramLink();}}>
                    {linkBusy?"…":language==="ru"?"Привязать через Telegram-бота":"Connect through Telegram bot"}
                  </button>
                  {linkRequest && <div className="form-stack">
                    <p className="form-note">{language==="ru"?"В Telegram нажми «Подтвердить привязку». Ссылка действует 10 минут. Статус обновится автоматически.":"In Telegram, tap Confirm link. This link expires in 10 minutes; the status updates automatically."}</p>
                    <a className="button button-outline" href={linkRequest.bot_link} target="_blank" rel="noopener noreferrer">↗ @TicketTreatBot</a>
                  </div>}
                </>}
              </section>}
              {mfaLinkAction && <section className="panel form-stack" aria-label="Confirm account security">
                <h3>{language==="ru"?"Подтверждение безопасности":"Security confirmation"}</h3>
                <p className="form-note">{language==="ru"
                  ?"Для привязки Telegram к аккаунту организатора необходимо подтвердить двухфакторную аутентификацию. Это защищает аккаунт и билеты."
                  :"Linking Telegram to an organizer account requires two-factor authentication to protect your account and tickets."}</p>
                {mfaLinkSetup ? <>
                  <p className="form-note">{language==="ru"?"Сначала подключи приложение-аутентификатор в настройках безопасности, затем повтори привязку.":"Set up your authenticator first, then retry linking."}</p>
                  <Link href="/security/mfa" className="button button-outline">{language==="ru"?"Настроить двухфакторную защиту":"Set up two-factor authentication"}</Link>
                </> : <form className="form-stack" onSubmit={e=>{void verifyMfaAndResumeLink(e);}}>
                  <label>{language==="ru"?"Шестизначный код из приложения-аутентификатора":"Six-digit authenticator code"}
                    <input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required
                      value={mfaLinkCode} onChange={e=>setMfaLinkCode(e.target.value)}/>
                  </label>
                  <button type="submit" className="button button-primary" disabled={mfaLinkBusy||mfaLinkCode.length!==6}>{mfaLinkBusy?"…":language==="ru"?"Подтвердить и привязать Telegram":"Verify and link Telegram"}</button>
                  <Link href="/security/mfa" className="button button-outline">{language==="ru"?"Управление двухфакторной защитой":"Manage two-factor authentication"}</Link>
                </>}
              </section>}
              {!profile.email_verified && <div className="panel form-stack">
                <h3>{language==="ru"?"Подтвердить email":language==="uk"?"Підтвердити email":language==="cs"?"Ověřit e-mail":"Verify email"}</h3>
                <p className="form-note">{language==="ru"?"Отправь код подтверждения на почту и введи его здесь.": "Request a code and enter it here. Existing accounts can verify without losing tickets."}</p>
                <button type="button" className="button button-outline" disabled={busy||mailReady===false}
                  onClick={async()=>{const token=getWebToken();if(!token)return;setBusy(true);setError("");try{await requestEmailVerification(token);setNotice("Verification code sent.");}catch(e){setError(readableError(e));}finally{setBusy(false);}}}>
                  {language==="ru"?"Отправить код":"Send code"}</button>
                <form className="form-stack" onSubmit={async(e)=>{e.preventDefault();const token=getWebToken();if(!token)return;setBusy(true);setError("");try{await confirmAccountEmail(token,profile.account.email,verificationCode);loadProfile(await getWebProfile(token));setVerificationCode("");setNotice("Email verified.");}catch(err){setError(readableError(err));}finally{setBusy(false);}}}>
                  <label>{language==="ru"?"Код из письма":"Email code"}<input type="text" autoComplete="one-time-code" name="one-time-code" inputMode="numeric" pattern="[0-9]{8}" required minLength={8} maxLength={8} value={verificationCode} onChange={e=>setVerificationCode(e.target.value)}/></label>
                  <button type="submit" className="button button-primary" disabled={busy}>{language==="ru"?"Подтвердить email":"Confirm email"}</button>
                </form>
              </div>}
              {profile.email_verified&&<p className="form-note">✓ {language==="ru"?"Email подтверждён":"Email verified"}</p>}
              <p className="form-note">{tr.note}</p>
              {profile.account.role !== "participant" && <Link href="/admin" className="button button-primary">Organizer dashboard →</Link>}
            </section>
            {error && <div className="state-card state-error" role="alert">{error}</div>}
            {notice && <div className="success-banner" role="status">{notice}</div>}
            <form className="panel form-stack" onSubmit={submitProfile}>
              <h2>{tr.profile}</h2>
              <label>{tr.email}<input type="email" autoComplete="email" value={email} disabled readOnly /></label>
              {details}
              <button type="submit" className="button button-primary" disabled={busy}>{busy ? tr.saving : tr.save}</button>
            </form>
            <section className="panel form-stack">
              <h2>{language === "ru" ? "Безопасность аккаунта" :
                language === "cs" ? "Zabezpečení účtu" :
                language === "uk" ? "Безпека акаунта" : "Account security"}</h2>
              <p className="form-note">{language === "ru" ?
                "После смены пароля все другие устройства будут разлогинены." :
                "Changing your password signs out all other devices."}</p>
              <form className="form-stack" onSubmit={updatePassword}>
                <label>{language === "ru" ? "Текущий пароль" : "Current password"}
                  <input required type="password" autoComplete="current-password" value={oldPassword}
                    onChange={e=>setOldPassword(e.target.value)}/></label>
                <label>{language === "ru" ? "Новый пароль (минимум 12 символов)" : "New password (12+ characters)"}
                  <input required type="password" autoComplete="new-password" minLength={12} maxLength={128}
                    value={newPassword} onChange={e=>setNewPassword(e.target.value)}/></label>
                <label>{language === "ru" ? "Повтори новый пароль" : "Confirm new password"}
                  <input required type="password" autoComplete="new-password" minLength={12} maxLength={128}
                    value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}/></label>
                <button type="submit" className="button button-primary" disabled={busy}>
                  {language === "ru" ? "Сменить пароль" : "Change password"}</button>
              </form>
              <GoogleSignIn link />
              <p className="form-note">{language==="ru"?"Если аккаунт создан через Google, задай пароль через восстановление по email, чтобы включить двухфакторную защиту.":"For a Google-created account, set a password through email recovery before enrolling in two-factor authentication."}</p>
              <Link href="/security/mfa" className="button button-outline">Two-factor authentication</Link>
              {profile.account.role==="participant"&&<Link href="/organizer/apply" className="button button-outline">Become an organizer</Link>}
              <Link href="/privacy" className="button button-outline">
                {language==="ru"?"Мои данные и запрос на удаление":language==="uk"?"Мої дані та запит на видалення":language==="cs"?"Moje údaje a žádost o výmaz":"My data and erasure request"}
              </Link>
              <div className="security-session-row">
                <p>{language === "ru" ? "Активных сессий" : "Active sessions"}: <strong>{sessionCount ?? "—"}</strong></p>
                <button type="button" className="button button-outline" onClick={signOutAllDevices}
                  disabled={busy}>{language === "ru" ? "Выйти на всех устройствах" : "Sign out everywhere"}</button>
              </div>
            </section>
            <div className="profile-actions"><button type="button" className="button button-outline" onClick={logOut}>{tr.logout}</button></div>
          </>
        ) : (
          <>
            <h1>{tr.title}</h1>
            {telegramProfile && <section className="panel telegram-verified-profile">
              <span className="status status-success">✓ Telegram verified</span>
              <h2>{telegramProfile.telegram.first_name}</h2>
              <p>{language === "ru" ?
                "Ты уже авторизован через Telegram и можешь записываться на ивенты в Mini App. Твои записи через бота доступны в разделе билетов." :
                "You are signed in through Telegram and can book events in Mini App. Existing bot registrations appear in My tickets."}</p>
              <Link href="/tickets" className="button button-outline">{language === "ru" ? "Мои билеты" : language === "cs" ? "Moje vstupenky" : language === "uk" ? "Мої квитки" : "My tickets"}</Link>
              <small>{language === "ru" ?
                "Веб-аккаунт с email существует отдельно. Для доступа с компьютера используй регистрацию или вход ниже; автоматического объединения аккаунтов пока нет." :
                "Email accounts are separate. To use TicketTreat on the web, sign up or log in below; accounts are not automatically merged."}</small>
            </section>}
            <p className="form-note">{tr.need}</p>
            <div className="auth-tabs" role="tablist">
              <button type="button" className={mode==="signup"?"active":""} onClick={()=>{setMode("signup");setError("");}}>{tr.signup}</button>
              <button type="button" className={mode==="login"?"active":""} onClick={()=>{setMode("login");setError("");}}>{tr.login}</button>
            </div>
            {error && <div className="state-card state-error" role="alert">{error}</div>}
            {notice && <div className="success-banner" role="status">{notice}</div>}
            <form className="panel form-stack" onSubmit={submitAuth}>
              <h2>{mode==="signup"?tr.create:tr.login}</h2>
              <GoogleSignIn />
              {mode==="signup" && (
                <fieldset className="event-language-fieldset">
                  <legend>{language==="en"?"Register as":language==="cs"?"Typ účtu":language==="uk"?"Зареєструватися як":"Зарегистрироваться как"}</legend>
                  <div className="role-options">
                    <label><input type="radio" name="account_role" value="participant" checked={accountRole==="participant"} onChange={()=>setAccountRole("participant")} />
                      {language==="en"?"Event participant":language==="cs"?"Účastník akcí":language==="uk"?"Учасник подій":"Участник ивентов"}</label>
                    <label><input type="radio" name="account_role" value="organizer" checked={accountRole==="organizer"} onChange={()=>setAccountRole("organizer")} />
                      {language==="en"?"Event organizer":language==="cs"?"Pořadatel":language==="uk"?"Організатор подій":"Организатор ивентов"}</label>
                  </div>
                </fieldset>
              )}
              {mode==="signup" && details}
              <label>{tr.email}<input type="email" required maxLength={255} autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} /></label>
              <label>{tr.password}<input type="password" required minLength={mode==="signup"?12:1} maxLength={128} autoComplete={mode==="signup"?"new-password":"current-password"} value={password} onChange={e=>setPassword(e.target.value)} /></label>
              {mode==="signup" && <p className="tt-legal-at-collection">
                {language==="ru"?"Перед регистрацией ознакомься с ":language==="uk"?"Перед реєстрацією ознайомся з ":language==="cs"?"Před registrací si přečti ":"Before creating an account, read the "}
                <Link href="/privacy-policy" target="_blank" rel="noopener noreferrer">{language==="ru"?"политикой конфиденциальности":language==="uk"?"політикою конфіденційності":language==="cs"?"zásady ochrany osobních údajů":"Privacy Policy"}</Link>
                {" "}{language==="ru"?"и ":language==="uk"?"та ":language==="cs"?"a ":"and "}
                <Link href="/terms" target="_blank" rel="noopener noreferrer">{language==="ru"?"условиями использования":language==="uk"?"умовами користування":language==="cs"?"obchodní podmínky":"Terms of Service"}</Link>.
                {" "}{language==="ru"?"Создание аккаунта не означает согласия на маркетинговые рассылки.":language==="uk"?"Створення акаунта не означає згоди на маркетингові розсилки.":language==="cs"?"Registrace neznamená souhlas s marketingovým zasíláním.":"Creating an account does not consent to marketing."}
              </p>}
              <p className="form-note">{mode==="signup"?tr.passwordHint:tr.note}</p>
              <button className="button button-primary" type="submit" disabled={busy}>{busy?tr.loading:mode==="signup"?tr.create:tr.login}</button>
            </form>
            <button type="button" className="button button-outline" onClick={()=>setResetOpen(v=>!v)}>
              {language==="ru"?"Забыли пароль?":language==="uk"?"Забули пароль?":language==="cs"?"Zapomenuté heslo?":"Forgot password?"}
            </button>
            {resetOpen&&<section className="panel form-stack">
              <h3>{language==="ru"?"Восстановление пароля":"Password recovery"}</h3>
              <p className="form-note">{language==="ru"?"Если аккаунт существует, на эту почту придёт код для сброса пароля. Код также подтверждает владение почтой.":"If the account exists, a reset code will be sent to this address. This also verifies the email."}</p>
              {mailReady===false&&<p role="alert" className="state-card state-error">{
                language==="ru"?"Отправка писем сейчас недоступна. Администратору TicketTreat нужно проверить Resend, домен отправителя и переменные EMAIL_NOTIFICATIONS_ENABLED / EMAIL_FROM / RESEND_API_KEY.":
                "Email sending is unavailable. TicketTreat support must verify Resend, sender domain and email environment variables."
              }</p>}
              <label>Email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
              <button type="button" className="button button-outline" disabled={busy||mailReady===false||!email.includes("@")} onClick={async()=>{setBusy(true);setError("");try{await requestPasswordReset(email);setNotice(language==="ru"?"Если адрес подтверждён, письмо отправлено.":"If an eligible account exists, a code was sent.");}catch(e){setError(readableError(e));}finally{setBusy(false);}}}>
                {language==="ru"?"Отправить код":"Send reset code"}
              </button>
              <form className="form-stack" onSubmit={async(e)=>{e.preventDefault();setBusy(true);setError("");try{await confirmPasswordReset(email,resetCode,resetPassword);setResetOpen(false);setResetCode("");setResetPassword("");setNotice(language==="ru"?"Пароль изменён. Войди с новым паролем.":"Password changed. Sign in with the new password.");}catch(err){setError(readableError(err));}finally{setBusy(false);}}}>
                <label>{language==="ru"?"Код из письма":"Email code"}<input required minLength={8} maxLength={8} pattern="[0-9]{8}" autoComplete="one-time-code" name="one-time-code" inputMode="numeric" value={resetCode} onChange={e=>setResetCode(e.target.value)}/></label>
                <label>{language==="ru"?"Новый пароль (12+ символов)":"New password (12+ characters)"}<input type="password" required minLength={12} maxLength={128} value={resetPassword} onChange={e=>setResetPassword(e.target.value)}/></label>
                <button type="submit" className="button button-primary" disabled={busy}>{language==="ru"?"Сбросить пароль":"Reset password"}</button>
              </form>
            </section>}
            <p className="form-note">{tr.note}</p>
          </>
        )}
      </main>
    </div>
  );
}
