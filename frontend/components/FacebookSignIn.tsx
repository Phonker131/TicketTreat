"use client";

import {useEffect,useState} from "react";
import Link from "next/link";
import {useLanguage} from "@/components/LanguageProvider";
import {FacebookMark} from "@/components/AuthProviderMarks";
import {getWebToken} from "@/lib/session";
import {getTelegramWebApp} from "@/lib/telegram";

const translations={
  en:{login:"Continue with Facebook",link:"Link Facebook",password:"Your TicketTreat password",required:"Enter your existing TicketTreat password first.",bad:"Incorrect password.",mfa:"Finish two-factor verification in Account security before linking Facebook.",expired:"Sign in to TicketTreat again.",unavailable:"Facebook sign-in is not available yet.",embedded:"Open TicketTreat in a normal browser to sign in with Facebook.",failed:"Facebook sign-in failed or expired. Try again.",provider_failed:"Facebook could not verify this login.",cancelled:"Facebook sign-in was cancelled.",conflict:"This Facebook account is already connected to another TicketTreat account.",link_required:"That email is already used. Sign in to your existing TicketTreat account and link Facebook from Account security.",email_required:"Facebook did not share an email address. Sign in with email instead, then connect Facebook from your profile.",success:"Facebook connected successfully.",rate:"Too many attempts. Try again later."},
  cs:{login:"Pokračovat přes Facebook",link:"Propojit Facebook",password:"Heslo k účtu TicketTreat",required:"Nejdřív zadejte heslo ke stávajícímu účtu TicketTreat.",bad:"Nesprávné heslo.",mfa:"Před propojením Facebooku dokončete dvoufázové ověření.",expired:"Přihlaste se znovu do TicketTreat.",unavailable:"Přihlášení přes Facebook zatím není dostupné.",embedded:"Přihlášení přes Facebook otevřete v běžném prohlížeči.",failed:"Přihlášení přes Facebook se nezdařilo nebo vypršelo.",provider_failed:"Facebook nemohl ověřit přihlášení.",cancelled:"Přihlášení přes Facebook bylo zrušeno.",conflict:"Tento Facebook účet je již propojen s jiným účtem TicketTreat.",link_required:"Tento e-mail již používá jiný účet. Přihlaste se do něj a propojte Facebook v zabezpečení účtu.",email_required:"Facebook neposkytl e-mail. Přihlaste se e-mailem a pak propojte Facebook v profilu.",success:"Facebook byl úspěšně připojen.",rate:"Příliš mnoho pokusů. Zkuste to později."},
  ru:{login:"Продолжить через Facebook",link:"Привязать Facebook",password:"Пароль TicketTreat",required:"Сначала введи пароль существующего аккаунта.",bad:"Неверный пароль.",mfa:"Пройди двухфакторную проверку перед привязкой Facebook.",expired:"Войди в TicketTreat заново.",unavailable:"Вход через Facebook пока недоступен.",embedded:"Для входа через Facebook открой обычный браузер.",failed:"Вход через Facebook не удался или истёк.",provider_failed:"Facebook не смог подтвердить вход.",cancelled:"Вход через Facebook отменён.",conflict:"Этот Facebook уже связан с другим аккаунтом TicketTreat.",link_required:"Такая почта уже зарегистрирована. Войди в свой аккаунт и привяжи Facebook в настройках безопасности.",email_required:"Facebook не передал email. Войди через почту и привяжи Facebook в профиле.",success:"Facebook успешно подключён.",rate:"Слишком много попыток. Повтори позже."},
  uk:{login:"Продовжити через Facebook",link:"Прив'язати Facebook",password:"Пароль TicketTreat",required:"Спочатку введіть пароль наявного акаунта.",bad:"Невірний пароль.",mfa:"Пройдіть двофакторну перевірку перед прив'язкою Facebook.",expired:"Увійдіть у TicketTreat знову.",unavailable:"Вхід через Facebook поки недоступний.",embedded:"Відкрийте звичайний браузер для входу через Facebook.",failed:"Вхід через Facebook не вдався або час минув.",provider_failed:"Facebook не зміг підтвердити вхід.",cancelled:"Вхід через Facebook скасовано.",conflict:"Цей Facebook вже під'єднано до іншого акаунта TicketTreat.",link_required:"Ця пошта вже використовується. Увійдіть у свій акаунт і прив'яжіть Facebook у налаштуваннях.",email_required:"Facebook не надав email. Увійдіть через пошту та прив'яжіть Facebook у профілі.",success:"Facebook успішно під'єднано.",rate:"Забагато спроб. Спробуйте пізніше."},
};

type Message=keyof typeof translations.en;

export function FacebookSignIn({compact=false,link=false}:{compact?:boolean;link?:boolean}){
  const {language}=useLanguage();const tr=translations[language];
  const [enabled,setEnabled]=useState(false);
  const [busy,setBusy]=useState(false);
  const [password,setPassword]=useState("");
  const [message,setMessage]=useState<Message|null>(null);
  const [embedded,setEmbedded]=useState(false);
  useEffect(()=>{
    setEmbedded(Boolean(getTelegramWebApp()?.initData));
    void fetch("/api/gateway/demo/auth/facebook/status",{cache:"no-store"})
      .then(r=>r.json()).then(data=>setEnabled(data.enabled===true)).catch(()=>{});
    const url=new URL(window.location.href);
    const result=url.searchParams.get("facebook");
    if(result && ["success","failed","provider_failed","cancelled","link_required","email_required","conflict"].includes(result)){
      setMessage(result as Message);
      url.searchParams.delete("facebook");
      window.history.replaceState(null,"",url);
    }
  },[]);

  async function begin(){
    setMessage(null);
    if(link && !password.trim()){setMessage("required");return;}
    if(link && !getWebToken()){setMessage("expired");return;}
    setBusy(true);
    try {
      const headers:Record<string,string>={"Content-Type":"application/json","X-TicketTreat-Client":"1"};
      if(link)headers.Authorization="Bearer browser-session";
      const response=await fetch("/api/gateway/demo/auth/facebook/start",{
        method:"POST",headers,body:JSON.stringify({link,current_password:link?password:undefined}),
      });
      const data=await response.json();setPassword("");
      if(!response.ok){
        const reason=typeof data?.detail==="string"?data.detail:"";
        setMessage(reason==="invalid_current_password"?"bad":
          reason==="mfa_enrollment_required" || reason==="mfa_challenge_required"?"mfa":
          reason==="login_required" || reason==="invalid_session"?"expired":
          response.status===429?"rate":"unavailable");
        return;
      }
      const url=new URL(data.url);
      if(url.origin!=="https://www.facebook.com" || !/^\/v[0-9]+\.[0-9]+\/dialog\/oauth$/.test(url.pathname))
        throw new Error("Invalid login provider");
      window.location.assign(url.href);
    }catch{setMessage("unavailable");}finally{setBusy(false);}
  }
  if(compact && !enabled)return null;
  return <div className={compact?`tt-auth-provider${message?" tt-auth-provider--expanded":""}`:"form-stack"}>
    {message && <div className={message==="success"?"form-note":"state-card state-error"} role="alert">{tr[message]}</div>}
    {!compact && !enabled && <p className="form-note">{tr.unavailable}</p>}
    {!compact && enabled && embedded && <p className="form-note">{tr.embedded}</p>}
    {link && enabled && !embedded && <>
      <label>{tr.password}<input type="password" autoComplete="current-password" maxLength={128}
        value={password} onChange={e=>setPassword(e.target.value)}/></label>
      <p className="form-note">{language==="cs"?"Pro propojení zadejte heslo TicketTreat, nikoli Facebook.":
        "Use your TicketTreat password (not your Facebook password) to connect accounts."}</p>
    </>}
    {(compact || enabled) && <button type="button"
      className={compact?"tt-auth-provider-button tt-auth-provider-facebook":"button button-outline"}
      title={embedded?tr.embedded:link?tr.link:tr.login} aria-label={link?tr.link:tr.login}
      disabled={!enabled||embedded||busy} onClick={()=>void begin()}>
      {compact?<FacebookMark/>:busy?"…":link?tr.link:tr.login}
    </button>}
    {!compact && message==="link_required" && <p className="form-note"><Link href="/password-recovery">
      {language==="cs"?"Obnovit heslo":language==="ru"?"Восстановить пароль":"Forgot password"}
    </Link></p>}
  </div>;
}
