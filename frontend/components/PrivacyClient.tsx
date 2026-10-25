"use client";
import Link from "next/link";
import {FormEvent,useEffect,useState} from "react";
import {AppHeader} from "@/components/AppHeader";
import {useLanguage} from "@/components/LanguageProvider";
import type {LanguageCode} from "@/lib/types";
import {getWebToken} from "@/lib/session";
import {
  getPrivacyRequest,submitPrivacyRequest,withdrawPrivacyRequest,
  type PrivacyRequestStatus,
} from "@/lib/api";

const WORDS:Record<LanguageCode,Record<string,string>>={
  "en": {
    "back": "Back to profile",
    "title": "Privacy and personal data",
    "policyIntro": "Read our",
    "policyLink": "Privacy Policy",
    "policyOutro": "for a description of how information is processed.",
    "erasure": "Account erasure request",
    "explain": "You can request the deletion of your TicketTreat account and personal data. We review requests because active bookings, organizer records or legal obligations may require some information to be kept.",
    "status": "Status",
    "pending": "Pending review",
    "requested": "Requested",
    "due": "Response due",
    "withdraw": "Withdraw request",
    "confirm": "Confirm with your current password",
    "submit": "Submit erasure request",
    "final": "Submitting a request does not immediately cancel bookings or erase financial records. For other data rights, including access, contact TicketTreat Support.",
    "login": "Please sign in to manage your data.",
    "registered": "Your erasure request has been registered.",
    "withdrawn": "Your erasure request has been withdrawn.",
    "mfa_challenge_required": "Your administrator session needs two-factor verification before you can continue.",
    "mfa_enrollment_required": "Your administrator account needs an authenticator app configured before you can continue.",
    "password_confirmation_failed": "The password is incorrect. Please try again.",
    "mfaAction": "Verify two-factor authentication",
    "googleHint": "Signed up with Google and never set a password? Use Forgot password on the sign-in screen to set one through your verified email before submitting this request.",
    "support": "Contact support about personal data",
    "helper": "Unable to use this form? You can still contact our support team about your privacy rights."
  },
  "cs": {
    "back": "Zpět na profil",
    "title": "Soukromí a osobní údaje",
    "policyIntro": "Přečtěte si naše",
    "policyLink": "Zásady ochrany osobních údajů",
    "policyOutro": "s popisem způsobu zpracování osobních údajů.",
    "erasure": "Žádost o výmaz účtu",
    "explain": "Můžete požádat o výmaz účtu TicketTreat a osobních údajů. Žádosti kontrolujeme, protože záznamy o registracích, činnost pořadatelů nebo zákonné povinnosti mohou vyžadovat uchování některých údajů.",
    "status": "Stav",
    "pending": "Čeká na posouzení",
    "requested": "Podáno",
    "due": "Termín odpovědi",
    "withdraw": "Vzít žádost zpět",
    "confirm": "Potvrďte aktuálním heslem",
    "submit": "Odeslat žádost o výmaz",
    "final": "Odeslání žádosti automaticky neruší registrace ani nemaže účetní doklady. Další práva v oblasti soukromí, včetně přístupu k údajům, můžete uplatnit prostřednictvím podpory TicketTreat v zápatí stránky.",
    "login": "Pro správu osobních údajů se přihlaste.",
    "registered": "Žádost o výmaz byla zaznamenána.",
    "withdrawn": "Žádost o výmaz byla vzata zpět.",
    "mfa_challenge_required": "Pro pokračování je třeba ověřit administrátorskou relaci pomocí dvoufaktorového ověření.",
    "mfa_enrollment_required": "Nejprve je třeba pro administrátorský účet nastavit ověřovací aplikaci.",
    "password_confirmation_failed": "Heslo není správné. Zkuste to znovu.",
    "mfaAction": "Ověřit dvoufaktorové přihlášení",
    "googleHint": "Zaregistrovali jste se přes Google a nemáte heslo? Pomocí možnosti Zapomenuté heslo na přihlašovací stránce si nejprve nastavte heslo přes ověřený e-mail.",
    "support": "Kontaktovat podporu ohledně osobních údajů",
    "helper": "Pokud formulář nemůžete použít, můžete se ve věci svých práv obrátit na naši podporu."
  },
  "ru": {
    "back": "Назад в профиль",
    "title": "Конфиденциальность и персональные данные",
    "policyIntro": "Ознакомься с нашей",
    "policyLink": "Политикой конфиденциальности",
    "policyOutro": "с описанием обработки персональных данных.",
    "erasure": "Запрос на удаление аккаунта",
    "explain": "Ты можешь запросить удаление аккаунта TicketTreat и персональных данных. Запрос проверяется, поскольку записи о мероприятиях и данные, требуемые законом, иногда необходимо сохранить.",
    "status": "Статус",
    "pending": "Ожидает рассмотрения",
    "requested": "Подано",
    "due": "Срок ответа",
    "withdraw": "Отозвать запрос",
    "confirm": "Подтверди текущим паролем",
    "submit": "Отправить запрос на удаление",
    "final": "Отправка запроса не отменяет автоматически регистрации и не удаляет финансовые записи. По другим вопросам персональных данных, включая право доступа, обратись в поддержку TicketTreat по ссылке внизу сайта.",
    "login": "Войди в аккаунт для управления данными.",
    "registered": "Запрос на удаление зарегистрирован.",
    "withdrawn": "Запрос на удаление отозван.",
    "mfa_challenge_required": "Для продолжения необходимо подтвердить сессию администратора через двухфакторную аутентификацию.",
    "mfa_enrollment_required": "Перед продолжением нужно настроить приложение-аутентификатор для администраторского аккаунта.",
    "password_confirmation_failed": "Неверный пароль. Попробуй ещё раз.",
    "mfaAction": "Подтвердить двухфакторную аутентификацию",
    "googleHint": "Зарегистрировался через Google и не задавал пароль? Открой «Забыли пароль?» на экране входа и установи пароль через подтверждённую почту перед отправкой запроса.",
    "support": "Обратиться в поддержку по вопросам данных",
    "helper": "Если не получается воспользоваться формой, запрос о персональных данных можно отправить через поддержку."
  },
  "uk": {
    "back": "Назад до профілю",
    "title": "Конфіденційність і персональні дані",
    "policyIntro": "Ознайомся з нашою",
    "policyLink": "Політикою конфіденційності",
    "policyOutro": "з описом обробки особистих даних.",
    "erasure": "Запит на видалення акаунта",
    "explain": "Ти можеш запросити видалення акаунта TicketTreat та особистих даних. Запит перевіряється, оскільки записи про події та дані, які вимагає закон, іноді потрібно зберігати.",
    "status": "Статус",
    "pending": "Очікує розгляду",
    "requested": "Подано",
    "due": "Термін відповіді",
    "withdraw": "Відкликати запит",
    "confirm": "Підтвердь поточним паролем",
    "submit": "Надіслати запит на видалення",
    "final": "Надсилання запиту не скасовує автоматично реєстрації та не видаляє фінансові записи. Щодо інших прав на особисті дані, включно з доступом до них, звернись до підтримки TicketTreat за посиланням унизу сайту.",
    "login": "Увійди в акаунт для керування даними.",
    "registered": "Запит на видалення зареєстровано.",
    "withdrawn": "Запит на видалення відкликано.",
    "mfa_challenge_required": "Для продовження потрібно підтвердити сеанс адміністратора через двофакторну автентифікацію.",
    "mfa_enrollment_required": "Спочатку потрібно налаштувати застосунок-автентифікатор для акаунта адміністратора.",
    "password_confirmation_failed": "Неправильний пароль. Спробуй ще раз.",
    "mfaAction": "Підтвердити двофакторну автентифікацію",
    "googleHint": "Зареєструвався через Google і не встановлював пароль? Скористайся «Забули пароль?» на сторінці входу та встанови пароль через підтверджену пошту перед поданням запиту.",
    "support": "Звернутися до підтримки з питань даних",
    "helper": "Якщо форму не вдається використати, запит щодо особистих даних можна надіслати через підтримку."
  }
};
export function PrivacyClient(){
  const {language}=useLanguage();const tr=WORDS[language];
  const show=(value:string)=>tr[value.startsWith("msg:")?value.slice(4):value]||value;
  const needsMfa=error==="mfa_challenge_required"||error==="mfa_enrollment_required";
  const [details,setDetails]=useState<PrivacyRequestStatus|null>(null);
  const [password,setPassword]=useState("");
  const [pending,setPending]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");

  async function reload(){
    if(!getWebToken()){setError("msg:login");return;}
    const status=await getPrivacyRequest();
    setDetails(status);
  }

  useEffect(()=>{void reload().catch(e=>setError(String(e)));},[]);

  async function send(e:FormEvent){
    e.preventDefault();setPending(true);setError("");setNotice("");
    try{
      await submitPrivacyRequest(password);
      setPassword("");
      await reload();
      setNotice("msg:registered");
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setPending(false);}
  }

  async function withdraw(){
    setPending(true);setError("");setNotice("");
    try{
      await withdrawPrivacyRequest();
      await reload();
      setNotice("msg:withdrawn");
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setPending(false);}
  }

  return <div className="app-shell"><AppHeader/><main className="page">
    <Link href="/profile" className="back-link">← {tr.back}</Link>
    <h1>{tr.title}</h1>
    <p className="form-note">{tr.policyIntro} <Link href="/privacy-policy">{tr.policyLink}</Link> {tr.policyOutro}</p>
    <section className="panel form-stack">
      <h2>{tr.erasure}</h2>
      <p className="form-note">{tr.explain}</p>
      {error&&<p role="alert" className="state-card state-error">{show(error)}</p>}
      {needsMfa&&<Link className="button button-outline" href="/security/mfa">{tr.mfaAction}</Link>}
      {notice&&<p className="success-banner">{show(notice)}</p>}
      {details?.status==="pending"?
        <>
          <p><strong>{tr.status}:</strong> {tr.pending}</p>
          <p className="form-note">{tr.requested}: {details.requested_at?new Date(details.requested_at).toLocaleString(language):"—"}</p>
          <p className="form-note">{tr.due}: {details.response_due_at?new Date(details.response_due_at).toLocaleDateString(language):"—"}</p>
          <button className="button button-outline" type="button" disabled={pending} onClick={withdraw}>{tr.withdraw}</button>
        </>:
        <form onSubmit={send} className="form-stack">
          <label>{tr.confirm}
            <input type="password" autoComplete="current-password" minLength={1} maxLength={128}
              required value={password} onChange={e=>setPassword(e.target.value)}/>
          </label>
          <button type="submit" className="button button-primary" disabled={pending||!getWebToken()}>{tr.submit}</button>
        </form>
      }
      <p className="form-note">{tr.googleHint}</p>
      <p className="form-note">{tr.final}</p>
      <p className="form-note">{tr.helper} <Link href="/support">{tr.support}</Link></p>
    </section>
  </main></div>;
}
