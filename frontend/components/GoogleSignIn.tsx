"use client";
import {useEffect,useState} from "react";
import {useLanguage} from "@/components/LanguageProvider";
import {getWebToken} from "@/lib/session";
import {getTelegramWebApp} from "@/lib/telegram";

const copy = {
  en: {login:"Continue with Google",link:"Link Google account",password:"Confirm your current password",unavailable:"Google sign-in is temporarily unavailable.",provider_failed:"Google could not verify this sign-in. Contact TicketTreat support if it persists.",failed:"Google sign-in failed or expired. Please try again.",cancelled:"Google sign-in was cancelled.",link_required:"This email already has an account. Sign in with your password, then link Google in Account security.",conflict:"This Google account is already linked. Sign in to its existing account.",success:"Google sign-in completed.",embedded:"Open this website in your browser to sign in with Google.",proof:"Check your password and, for organizer/admin accounts, complete two-factor authentication first."},
  ru: {login:"Продолжить с Google",link:"Привязать Google",password:"Подтверди текущий пароль",unavailable:"Вход через Google временно недоступен.",provider_failed:"Google не смог подтвердить вход. Если ошибка повторится, обратись в поддержку TicketTreat.",failed:"Вход через Google не завершён или устарел. Попробуй ещё раз.",cancelled:"Вход через Google отменён.",link_required:"Аккаунт с этой почтой уже есть. Войди по паролю и привяжи Google в разделе безопасности.",conflict:"Этот Google-аккаунт уже привязан. Войди в существующий аккаунт.",success:"Вход через Google выполнен.",embedded:"Открой сайт в обычном браузере для входа через Google.",proof:"Проверь пароль. Для организаторов и администраторов сначала пройди двухфакторную проверку."},
  cs: {login:"Pokračovat přes Google",link:"Propojit účet Google",password:"Potvrď aktuální heslo",unavailable:"Přihlášení přes Google je dočasně nedostupné.",provider_failed:"Přihlášení Google se nepodařilo ověřit. Kontaktuj podporu TicketTreat.",failed:"Přihlášení selhalo nebo vypršelo. Zkus to znovu.",cancelled:"Přihlášení bylo zrušeno.",link_required:"Účet s tímto e-mailem již existuje. Přihlas se heslem a propoj Google v zabezpečení účtu.",conflict:"Tento účet Google je již propojen. Přihlas se k existujícímu účtu.",success:"Přihlášení přes Google dokončeno.",embedded:"Pro přihlášení přes Google otevři web v prohlížeči.",proof:"Zkontroluj heslo. Pořadatelé a administrátoři musí nejprve dokončit dvoufaktorové ověření."},
  uk: {login:"Продовжити з Google",link:"Прив’язати Google",password:"Підтвердь поточний пароль",unavailable:"Вхід через Google тимчасово недоступний.",provider_failed:"Google не вдалося підтвердити вхід. Якщо помилка повториться, звернися до підтримки TicketTreat.",failed:"Вхід не завершено або час минув. Спробуй ще раз.",cancelled:"Вхід через Google скасовано.",link_required:"Акаунт з цією поштою вже є. Увійди за паролем і прив’яжи Google в розділі безпеки.",conflict:"Цей Google-акаунт уже прив’язаний. Увійди в наявний акаунт.",success:"Вхід через Google виконано.",embedded:"Відкрий сайт у браузері для входу через Google.",proof:"Перевір пароль. Для організаторів і адміністраторів спочатку пройди двофакторну перевірку."},
};
export function GoogleSignIn({link=false}:{link?:boolean}) {
  const {language}=useLanguage();const tr=copy[language];
  const [enabled,setEnabled]=useState(false);const [busy,setBusy]=useState(false);
  const [password,setPassword]=useState("");const [message,setMessage]=useState("");
  const [embedded,setEmbedded]=useState(false);
  useEffect(()=>{
    setEmbedded(Boolean(getTelegramWebApp()?.initData));
    void fetch("/api/gateway/demo/auth/google/status",{cache:"no-store"}).then(r=>r.json()).then(d=>setEnabled(d.enabled===true)).catch(()=>{});
    const url=new URL(window.location.href);const result=url.searchParams.get("google");
    if (result && ["success","failed","provider_failed","cancelled","link_required","conflict"].includes(result)) {
      setMessage(result);url.searchParams.delete("google");window.history.replaceState(null,"",url);
    }
  },[]);
  async function start() {
    setBusy(true);setMessage("");
    try {
      const headers:Record<string,string>={"Content-Type":"application/json","X-TicketTreat-Client":"1"};
      if(link) headers.Authorization="Bearer "+getWebToken();
      const response=await fetch("/api/gateway/demo/auth/google/start",{method:"POST",headers,
        body:JSON.stringify({link,current_password:link?password:undefined})});
      const data=await response.json();setPassword("");
      if(!response.ok) {setMessage(response.status===401||response.status===403?"proof":"unavailable");return;}
      const url=new URL(data.url);
      if(url.origin!=="https://accounts.google.com") throw new Error("Invalid provider");
      window.location.assign(url.href);
    } catch {setMessage("unavailable");} finally {setBusy(false);}
  }
  return <div className="form-stack">
    {message && <div className={message==="link_required"||message==="provider_failed"||message==="failed"?"state-card state-error":"form-note"} role="status">
      {tr[message as keyof typeof tr] || tr.failed}
      {message==="link_required" && <p style={{margin:"8px 0 0"}}>
        {language==="ru"?"Это не новая регистрация. Войди с прежним паролем ниже, затем открой «Безопасность аккаунта» → «Привязать Google». Данные и билеты сохранятся.":
        language==="cs"?"Nejde o novou registraci. Přihlas se dosavadním heslem a pak v Zabezpečení účtu propoj Google.":
        language==="uk"?"Це не нова реєстрація. Увійди з наявним паролем, потім прив’яжи Google у налаштуваннях безпеки.":
        "You don't need to sign up again. Sign in below with your existing password, then use Account security → Link Google. Your tickets stay in the same account."}
      </p>}
    </div>}
    {!enabled && !embedded && <p className="form-note" role="status">{tr.unavailable}</p>}
    {enabled && (embedded ? <p className="form-note">{tr.embedded}</p> : <>
      {link && <label>{tr.password}<input type="password" autoComplete="current-password" maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/></label>}
      <button type="button" className="button button-outline" disabled={busy || (link&&!password)} onClick={()=>void start()}>{link?tr.link:tr.login}</button>
    </>)}
  </div>;
}
