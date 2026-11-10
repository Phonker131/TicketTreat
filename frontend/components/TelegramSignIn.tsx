"use client";

import {useEffect,useState} from "react";
import {useLanguage} from "@/components/LanguageProvider";
import {getWebToken} from "@/lib/session";
import {getTelegramWebApp} from "@/lib/telegram";

const words={
  en:{
    signIn:"Continue with Telegram",link:"Connect Telegram to this account",
    failed:"Telegram sign-in failed or expired. Please try again.",
    conflict:"Both accounts are already in use. Open the existing account-link tool below; tickets will not be merged without verification.",
    cancelled:"Telegram sign-in was cancelled.",unavailable:"Telegram sign-in is not configured yet.",
    linked:"Telegram sign-in is complete.",opening:"Opening Telegram…",
    embedded:"You are already using Telegram Mini App. Sign in to your existing email/Google account below to connect both identities.",
    loginFirst:"Sign in to your TicketTreat account first."
  },
  cs:{
    signIn:"Pokračovat přes Telegram",link:"Propojit Telegram s tímto účtem",
    failed:"Přihlášení přes Telegram se nepodařilo nebo vypršelo. Zkus to znovu.",
    conflict:"Oba účty již existují. Použij níže původní propojení účtů; vstupenky se bez ověření nesloučí.",
    cancelled:"Přihlášení přes Telegram bylo zrušeno.",unavailable:"Přihlášení přes Telegram zatím není nastavené.",
    linked:"Přihlášení přes Telegram bylo dokončeno.",opening:"Otevírání Telegramu…",
    embedded:"Jsi v Telegram Mini App. Přihlas se níže ke svému stávajícímu účtu e-mailem či přes Google a bezpečně jej propoj.",
    loginFirst:"Nejprve se přihlas ke svému účtu TicketTreat."
  },
  ru:{
    signIn:"Продолжить с Telegram",link:"Подключить Telegram к аккаунту",
    failed:"Вход через Telegram не завершён или истёк.",conflict:"Аккаунты уже существуют отдельно. Используй резервное связывание ниже.",
    cancelled:"Вход через Telegram отменён.",unavailable:"Вход через Telegram пока не настроен.",
    linked:"Вход через Telegram выполнен.",opening:"Открываем Telegram…",
    embedded:"Ты уже в Mini App. Войди в существующий аккаунт ниже, чтобы объединить подтверждённые учётные записи.",
    loginFirst:"Сначала войди в TicketTreat."
  },
  uk:{
    signIn:"Продовжити через Telegram",link:"Підключити Telegram до акаунта",
    failed:"Вхід через Telegram не завершено або термін минув.",conflict:"Облікові записи існують окремо. Використай резервне пов'язування нижче.",
    cancelled:"Вхід через Telegram скасовано.",unavailable:"Вхід через Telegram ще не налаштовано.",
    linked:"Вхід через Telegram виконано.",opening:"Відкриваємо Telegram…",
    embedded:"Ти вже в Mini App. Увійди до наявного акаунта нижче, щоб безпечно поєднати два входи.",
    loginFirst:"Спочатку увійди в TicketTreat."
  }
};

export function TelegramSignIn({link=false}:{link?:boolean}) {
  const {language}=useLanguage();const tr=words[language];
  const [enabled,setEnabled]=useState(false);
  const [ready,setReady]=useState(false);
  const [busy,setBusy]=useState(false);
  const [embedded,setEmbedded]=useState(false);
  const [message,setMessage]=useState("");

  useEffect(()=>{
    setEmbedded(Boolean(getTelegramWebApp()?.initData));
    void fetch("/api/gateway/demo/auth/telegram/status",{cache:"no-store"})
      .then(r=>r.json()).then(v=>setEnabled(v.enabled===true))
      .catch(()=>{}).finally(()=>setReady(true));
    const result=new URLSearchParams(window.location.search).get("telegram");
    if(result && ["success","failed","conflict","cancelled","unavailable"].includes(result))
      setMessage(result);
  },[]);

  async function begin() {
    if(link && !getWebToken()){setMessage("loginFirst");return;}
    setMessage("");setBusy(true);
    try {
      const response=await fetch("/api/gateway/demo/auth/telegram/start",{
        method:"POST",cache:"no-store",
        headers:{"Content-Type":"application/json","X-TicketTreat-Client":"1",
          ...(link?{Authorization:"Bearer browser-session"}:{})},
        body:JSON.stringify({link}),
      });
      if(!response.ok)throw new Error("unavailable");
      const data=await response.json();
      const uri=new URL(data.url);
      if(uri.origin!=="https://oauth.telegram.org"||uri.pathname!=="/auth")
        throw new Error("unavailable");
      window.location.assign(uri.href);
    }catch{setMessage("unavailable");setBusy(false);}
  }

  return <div className="form-stack">
    {message && <p className={message==="success"?"form-note":"state-card state-error"} role="status">
      {tr[message as keyof typeof tr] || tr.failed}
    </p>}
    {ready && embedded && !link && <p className="form-note">{tr.embedded}</p>}
    {ready && !embedded && !enabled && !link &&
      <p className="form-note" role="status">{tr.unavailable}</p>}
    {ready && !embedded && enabled &&
      <button type="button" className="button button-outline"
        disabled={busy} onClick={()=>void begin()}>
        {busy?tr.opening:link?tr.link:tr.signIn}
      </button>}
  </div>;
}
