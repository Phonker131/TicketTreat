"use client";
import {FormEvent,useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {AppHeader} from "@/components/AppHeader";
import {useLanguage} from "@/components/LanguageProvider";
import {restoreWebProfile} from "@/lib/session";

const messages={
  en:{title:"Verify your email",lead:"We sent an eight-digit security code to the email address shared by Facebook. Enter it to finish creating your TicketTreat account.",code:"Email verification code",consent:"I accept the Terms of Service and acknowledge the Privacy Policy.",submit:"Confirm email and create account",expired:"The code is incorrect or expired. You can restart Facebook sign-in to request a new one.",failed:"Verification could not be completed. Please try again.",missing:"Start Facebook sign-in again to request a new code.",conflict:"An account already exists with this email. Sign in to it and link Facebook from your profile.",back:"Back to sign-in",busy:"Verifying…"},
  cs:{title:"Ověřte svůj e-mail",lead:"Na e-mail poskytnutý Facebookem jsme poslali osmimístný bezpečnostní kód. Zadejte ho pro dokončení registrace TicketTreat.",code:"Ověřovací kód z e-mailu",consent:"Souhlasím s podmínkami používání a beru na vědomí zásady ochrany osobních údajů.",submit:"Ověřit e-mail a vytvořit účet",expired:"Kód je nesprávný nebo vypršel. Spusťte přihlášení přes Facebook znovu.",failed:"Ověření se nezdařilo. Zkuste to znovu.",missing:"Spusťte přihlášení přes Facebook znovu a vyžádejte si nový kód.",conflict:"Účet s tímto e-mailem již existuje. Přihlaste se do něj a propojte Facebook v profilu.",back:"Zpět na přihlášení",busy:"Ověřujeme…"},
  ru:{title:"Подтверди email",lead:"Мы отправили восьмизначный код на адрес, который передал Facebook. Введи его, чтобы завершить регистрацию TicketTreat.",code:"Код из письма",consent:"Я принимаю условия использования и ознакомился с политикой конфиденциальности.",submit:"Подтвердить email и создать аккаунт",expired:"Неправильный или просроченный код. Запусти Facebook-вход заново.",failed:"Не удалось проверить код. Попробуй ещё раз.",missing:"Запусти вход через Facebook снова, чтобы получить новый код.",conflict:"Аккаунт с этой почтой уже есть. Войди в него и привяжи Facebook.",back:"Вернуться к входу",busy:"Проверяем…"},
  uk:{title:"Підтвердіть email",lead:"Ми надіслали восьмизначний код на адресу, яку надав Facebook. Введіть його для реєстрації TicketTreat.",code:"Код із листа",consent:"Я приймаю умови користування та ознайомився з політикою конфіденційності.",submit:"Підтвердити email і створити акаунт",expired:"Неправильний або протермінований код. Запустіть вхід через Facebook знову.",failed:"Не вдалося перевірити код. Спробуйте ще раз.",missing:"Знову запустіть вхід через Facebook для нового коду.",conflict:"Акаунт із цією поштою вже існує. Увійдіть і прив'яжіть Facebook.",back:"Повернутися до входу",busy:"Перевіряємо…"},
};

export function FacebookEmailVerification(){
  const {language}=useLanguage();const tr=messages[language];const router=useRouter();
  const [code,setCode]=useState("");const [accepted,setAccepted]=useState(false);
  const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  async function confirm(event:FormEvent){
    event.preventDefault();setError("");setBusy(true);
    try {
      const response=await fetch("/api/gateway/demo/auth/facebook/confirm",{
        method:"POST",headers:{"Content-Type":"application/json","X-TicketTreat-Client":"1"},
        body:JSON.stringify({code,privacy_accepted:accepted,privacy_version:"2026-10"}),
      });
      const data=await response.json();
      if(!response.ok){
        setError(data.detail==="invalid_or_expired_code"?tr.expired:
          data.detail==="facebook_pending_required"?tr.missing:
          data.detail==="facebook_link_required"?tr.conflict:tr.failed);
        return;
      }
      // The server set an HttpOnly session cookie; only a marker reaches JS.
      const profile=await restoreWebProfile();
      if(!profile){setError(tr.failed);return;}
      router.replace("/profile");
    }catch{setError(tr.failed);}finally{setBusy(false);}
  }
  return <div className="app-shell"><AppHeader/><main className="page auth-container">
    <Link href="/profile" className="back-link">{tr.back}</Link>
    <h1>{tr.title}</h1><p className="form-note">{tr.lead}</p>
    <form className="panel form-stack" onSubmit={e=>void confirm(e)}>
      {error&&<p role="alert" className="state-card state-error">{error}</p>}
      <label>{tr.code}<input type="text" inputMode="numeric" autoComplete="one-time-code"
        pattern="[0-9]{8}" minLength={8} maxLength={8} required value={code}
        onChange={e=>setCode(e.target.value.replace(/[^0-9]/g,"").slice(0,8))}/></label>
      <label className="form-note"><input type="checkbox" checked={accepted} required
        onChange={e=>setAccepted(e.target.checked)}/> {tr.consent}</label>
      <p className="form-note"><Link href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</Link>
      {" · "}<Link href="/privacy-policy" target="_blank" rel="noopener noreferrer">Privacy Policy</Link></p>
      <button type="submit" className="button button-primary" disabled={busy||code.length!==8||!accepted}>
        {busy?tr.busy:tr.submit}
      </button>
    </form>
  </main></div>;
}
