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
    "explain": "{tr.explain}",
    "status": "Status",
    "pending": "Pending review",
    "requested": "Requested",
    "due": "Response due",
    "withdraw": "Withdraw request",
    "confirm": "Confirm with your current password",
    "submit": "Submit erasure request",
    "final": "{tr.final}",
    "login": "Please sign in to manage your data.",
    "registered": "Your erasure request has been registered.",
    "withdrawn": "Your erasure request has been withdrawn."
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
    "withdrawn": "Žádost o výmaz byla vzata zpět."
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
    "withdrawn": "Запрос на удаление отозван."
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
    "withdrawn": "Запит на видалення відкликано."
  }
};
export function PrivacyClient(){
  const {language}=useLanguage();const tr=WORDS[language];
  const show=(value:string)=>value.startsWith("msg:")?tr[value.slice(4)]||value:value;
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
      <p className="form-note">{tr.final}</p>
    </section>
  </main></div>;
}
