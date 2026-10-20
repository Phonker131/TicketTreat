"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useLanguage } from "@/components/LanguageProvider";
import { getStoredGuestToken, clearWebAuth, getWebToken, restoreWebProfile, setWebAuth, storeGuest } from "@/lib/session";
import { loginWebAccount, logoutWebAccount, signupWebAccount, updateWebProfile } from "@/lib/api";
import type { LanguageCode, WebProfile } from "@/lib/types";

const COPY: Record<LanguageCode, Record<string, string>> = {
  ru: {
    title:"Мой профиль", login:"Войти",signup:"Регистрация",first:"Имя",last:"Фамилия",
    email:"Электронная почта",password:"Пароль (не менее 10 символов)",phone:"Телефон",
    instagram:"Instagram (необязательно)",contact:"Предпочтительный способ связи",
    save:"Сохранить изменения",saving:"Сохраняем…",loading:"Загрузка…",
    logout:"Выйти",welcome:"С возвращением!",create:"Создать аккаунт",need:"Зарегистрируйся, чтобы иметь доступ к билетам с любого устройства.",
    note:"Демо-версия: подтверждение email и восстановление пароля пока не реализованы. Используй уникальный пароль.",
    visits:"Посещений",tickets:"Мои билеты",profile:"Данные профиля",
    accountCreated:"Аккаунт создан.",updated:"Профиль обновлён.",required:"Заполни обязательные поля.",
    emailUsed:"На этот email уже зарегистрирован аккаунт. Попробуй войти.",
    credentials:"Неверный email или пароль.",rate:"Слишком много попыток. Повтори через 10 минут.",
    authExpired:"Сессия истекла. Войди повторно.",back:"К событиям",passwordHint:"Пароль нужен для входа с другого устройства.",
  },
  en: {
    title:"My profile",login:"Log in",signup:"Sign up",first:"First name",last:"Last name",
    email:"Email",password:"Password (at least 10 characters)",phone:"Phone",
    instagram:"Instagram (optional)",contact:"Preferred contact method",save:"Save changes",
    saving:"Saving…",loading:"Loading…",logout:"Log out",welcome:"Welcome back!",
    create:"Create account",need:"Register to access your tickets from any device.",
    note:"Demo version: email verification and password reset are not available yet. Use a unique password.",
    visits:"Check-ins",tickets:"My tickets",profile:"Profile details",
    accountCreated:"Account created.",updated:"Profile updated.",required:"Complete the required fields.",
    emailUsed:"An account with this email already exists. Try logging in.",
    credentials:"Invalid email or password.",rate:"Too many attempts. Try again in 10 minutes.",
    authExpired:"Session expired. Log in again.",back:"Back to events",passwordHint:"Use this password when logging in on another device.",
  },
  cs: {
    title:"Můj profil",login:"Přihlásit se",signup:"Registrace",first:"Jméno",last:"Příjmení",
    email:"E-mail",password:"Heslo (alespoň 10 znaků)",phone:"Telefon",
    instagram:"Instagram (nepovinné)",contact:"Preferovaný kontakt",save:"Uložit změny",
    saving:"Ukládání…",loading:"Načítání…",logout:"Odhlásit se",welcome:"Vítej zpět!",
    create:"Vytvořit účet",need:"Zaregistruj se a měj vstupenky dostupné na každém zařízení.",
    note:"Demo verze: ověření e-mailu a obnovení hesla zatím nejsou dostupné. Použij jedinečné heslo.",
    visits:"Návštěvy",tickets:"Moje vstupenky",profile:"Údaje profilu",
    accountCreated:"Účet vytvořen.",updated:"Profil aktualizován.",required:"Vyplň povinná pole.",
    emailUsed:"Účet s tímto e-mailem již existuje. Přihlas se.",
    credentials:"Nesprávný e-mail nebo heslo.",rate:"Příliš mnoho pokusů. Zkus to za 10 minut.",
    authExpired:"Přihlášení vypršelo. Přihlas se znovu.",back:"Zpět na události",passwordHint:"Toto heslo použiješ při přihlášení z jiného zařízení.",
  },
  uk: {
    title:"Мій профіль",login:"Увійти",signup:"Реєстрація",first:"Ім’я",last:"Прізвище",
    email:"Електронна пошта",password:"Пароль (не менше 10 символів)",phone:"Телефон",
    instagram:"Instagram (необов’язково)",contact:"Бажаний спосіб зв’язку",
    save:"Зберегти зміни",saving:"Зберігаємо…",loading:"Завантаження…",
    logout:"Вийти",welcome:"З поверненням!",create:"Створити акаунт",
    need:"Зареєструйся, щоб бачити квитки з будь-якого пристрою.",
    note:"Демо-версія: підтвердження email та відновлення пароля ще недоступні. Використовуй унікальний пароль.",
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
  const [mode, setMode] = useState<"login"|"signup">("signup");
  const [profile, setProfile] = useState<WebProfile|null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [instagram, setInstagram] = useState("");
  const [contact, setContact] = useState<ContactPreference>("email");

  useEffect(() => {
    let mounted = true;
    restoreWebProfile()
      .then((p) => { if(mounted && p) loadProfile(p); })
      .catch(() => { if (mounted) setError("Connection to the profile service failed."); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  function loadProfile(p: WebProfile) {
    setProfile(p);
    storeGuest(p.guest);
    setEmail(p.account.email);
    setFirstName(p.account.first_name);
    setLastName(p.account.last_name);
    setPhone(p.account.phone || "");
    setInstagram(p.account.instagram || "");
    setContact(p.account.contact_preference);
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
            guest_token: getStoredGuestToken(),
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
      });
      loadProfile(result);
      setNotice(tr.updated);
    } catch(err) { setError(readableError(err)); }
    finally { setBusy(false); }
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
        {loading ? <div className="state-card">{tr.loading}</div> : profile ? (
          <>
            <section className="panel">
              <div className="profile-top">
                <div className="profile-avatar">{profile.account.first_name.charAt(0).toUpperCase()}</div>
                <div><h1>{profile.account.first_name} {profile.account.last_name}</h1><p>{profile.account.email}</p></div>
              </div>
              <div className="profile-facts">
                <div className="profile-fact"><span>{tr.visits}</span><strong>{profile.guest.visits}</strong></div>
                <div className="profile-fact"><span>{tr.tickets}</span><Link href="/tickets" className="button button-outline">→ {tr.tickets}</Link></div>
              </div>
              <p className="form-note">{tr.note}</p>
            </section>
            {error && <div className="state-card state-error" role="alert">{error}</div>}
            {notice && <div className="success-banner" role="status">{notice}</div>}
            <form className="panel form-stack" onSubmit={submitProfile}>
              <h2>{tr.profile}</h2>
              <label>{tr.email}<input type="email" autoComplete="email" value={email} disabled readOnly /></label>
              {details}
              <button type="submit" className="button button-primary" disabled={busy}>{busy ? tr.saving : tr.save}</button>
            </form>
            <div className="profile-actions"><button type="button" className="button button-outline" onClick={logOut}>{tr.logout}</button></div>
          </>
        ) : (
          <>
            <h1>{tr.title}</h1>
            <p className="form-note">{tr.need}</p>
            <div className="auth-tabs" role="tablist">
              <button type="button" className={mode==="signup"?"active":""} onClick={()=>{setMode("signup");setError("");}}>{tr.signup}</button>
              <button type="button" className={mode==="login"?"active":""} onClick={()=>{setMode("login");setError("");}}>{tr.login}</button>
            </div>
            {error && <div className="state-card state-error" role="alert">{error}</div>}
            {notice && <div className="success-banner" role="status">{notice}</div>}
            <form className="panel form-stack" onSubmit={submitAuth}>
              <h2>{mode==="signup"?tr.create:tr.login}</h2>
              {mode==="signup" && details}
              <label>{tr.email}<input type="email" required maxLength={255} autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} /></label>
              <label>{tr.password}<input type="password" required minLength={mode==="signup"?10:1} maxLength={128} autoComplete={mode==="signup"?"new-password":"current-password"} value={password} onChange={e=>setPassword(e.target.value)} /></label>
              <p className="form-note">{mode==="signup"?tr.passwordHint:tr.note}</p>
              <button className="button button-primary" type="submit" disabled={busy}>{busy?tr.loading:mode==="signup"?tr.create:tr.login}</button>
            </form>
            <p className="form-note">{tr.note}</p>
          </>
        )}
      </main>
    </div>
  );
}
