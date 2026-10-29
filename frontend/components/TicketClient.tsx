"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { AppHeader } from "@/components/AppHeader";
import { useLanguage } from "@/components/LanguageProvider";
import { cancelDemoTicket, getDemoTicket, getWalletStatus } from "@/lib/api";
import { formatDate, formatPrice } from "@/lib/format";
import {venueStartEpoch} from "@/lib/venue-time";
import { t } from "@/lib/i18n";
import { getWebToken, restoreGuest } from "@/lib/session";
import { getTelegramWebApp } from "@/lib/telegram";
import type { DemoTicket } from "@/lib/types";

const words = {
  ru:{pass:"ВХОДНОЙ БИЛЕТ",ticket:"Номер билета",organizer:"ОРГАНИЗАТОР",wallet:"Добавить в Apple Wallet",
    qr:"Покажи этот QR-код на входе",invalid:"Билет отменён и недействителен",downloadError:"Не удалось добавить билет в Apple Wallet."},
  uk:{pass:"ВХІДНИЙ КВИТОК",ticket:"Номер квитка",organizer:"ОРГАНІЗАТОР",wallet:"Додати до Apple Wallet",
    qr:"Покажи QR-код на вході",invalid:"Квиток скасовано",downloadError:"Не вдалося додати квиток до Apple Wallet."},
  cs:{pass:"VSTUPENKA",ticket:"Číslo vstupenky",organizer:"POŘADATEL",wallet:"Přidat do Apple Wallet",
    qr:"Ukaž tento QR kód u vstupu",invalid:"Vstupenka je zrušena",downloadError:"Vstupenku nelze přidat do Apple Wallet."},
  en:{pass:"EVENT ADMISSION",ticket:"Ticket number",organizer:"ORGANIZER",wallet:"Add to Apple Wallet",
    qr:"Show this QR code at the entrance",invalid:"This ticket was cancelled",downloadError:"Unable to add ticket to Apple Wallet."}
};

export function TicketClient() {
  const {language} = useLanguage();
  const tr = words[language];
  const params = useParams<{id: string}>();
  const search = useSearchParams();
  const [ticket, setTicket] = useState<DemoTicket | null>(null);
  const [qr, setQr] = useState("");
  const [flipped,setFlipped] = useState(false);
  const [clock,setClock] = useState<number|null>(null);
  useEffect(()=>{
    const sync=()=>setClock(Date.now());
    sync();
    const timer=window.setInterval(sync,1000);
    document.addEventListener("visibilitychange",sync);
    return()=>{window.clearInterval(timer);document.removeEventListener("visibilitychange",sync);};
  },[]);
  const [loading, setLoading] = useState(true);
  const [walletEnabled, setWalletEnabled] = useState(false);
  const [walletBusy, setWalletBusy] = useState(false);
  const [message, setMessage] = useState<string|null>(search.get("paid") === "1" ? "paymentSuccess" :
    search.get("registered") === "1" ? "registered" : null);
  const ticketText={
    ru:{front:"Назад к билету",back:"Показать QR",until:"До начала",guest:"ГОСТЬ",started:"Ивент начался",days:"д",hours:"ч",minutes:"мин",seconds:"с"},
    cs:{front:"Zpět ke vstupence",back:"Zobrazit QR",until:"Do začátku",guest:"HOST",started:"Akce začala",days:"d",hours:"h",minutes:"min",seconds:"s"},
    uk:{front:"Назад до квитка",back:"Показати QR",until:"До початку",guest:"ГІСТЬ",started:"Подія почалася",days:"д",hours:"год",minutes:"хв",seconds:"с"},
    en:{front:"Back to ticket",back:"Show QR",until:"Until start",guest:"GUEST",started:"Event started",days:"d",hours:"h",minutes:"min",seconds:"s"}
  }[language];
  const countdown=(()=>{
    if(!ticket?.event?.starts_at||clock===null)return null;
    const target=venueStartEpoch(ticket.event.starts_at);
    if(!Number.isFinite(target))return null;
    const remaining=Math.max(0,Math.floor((target-clock)/1000));
    return {
      started:target<=clock,
      days:Math.floor(remaining/86400),
      hours:Math.floor((remaining%86400)/3600),
      minutes:Math.floor((remaining%3600)/60),
      seconds:remaining%60
    };
  })();
  const digits=(value:number)=>String(value).padStart(2,"0");
  const translateMessage=(value:string)=>value==="registered"?t(language,"ticketReady") :
    value==="walletError"?tr.downloadError :
    ["paymentSuccess","loadError","cancelledTicket"].includes(value)?t(language,value as "paymentSuccess"|"loadError"|"cancelledTicket"):value;

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    const load = async () => {
      const guest = await restoreGuest();
      if (!guest || !params?.id) throw new Error("login_required");
      const data = await getDemoTicket(guest.access_token, params.id);
      const image = data.ticket_status==="active"
        ? await QRCode.toDataURL(`TICKETTREAT:TICKET:${data.qr_token}`, {width: 360, margin: 2})
        : "";
      if (mounted) {setTicket(data);setQr(image);}
    };
    void load().catch(()=>{if(mounted)setMessage("loadError");})
      .finally(()=>{if(mounted)setLoading(false);});
    void getWalletStatus().then(status=>{if(mounted)setWalletEnabled(status.enabled===true);}).catch(()=>{});
    return ()=>{mounted=false;};
  },[params?.id,language]);

  async function cancel() {
    if (!ticket || !window.confirm(t(language,"cancelTicket"))) return;
    const guest = await restoreGuest();
    if (!guest) {setMessage("loadError");return;}
    try{
      const result = await cancelDemoTicket(guest.access_token, ticket.id);
      setTicket(result.ticket);
      setQr("");
      setMessage("cancelledTicket");
    }catch{setMessage("loadError");}
  }

  async function addToWallet() {
    if (!ticket || ticket.ticket_status!=="active" || walletBusy) return;
    const url=`/api/gateway/demo/me/tickets/${ticket.id}/wallet`;
    const webSession=getWebToken()==="browser-session";
    // Native iOS Safari can directly handle the application/vnd.apple.pkpass MIME type.
    // The gateway supplies the scoped HttpOnly browser cookie for this GET only.
    if(webSession && !getTelegramWebApp()?.initData){window.location.assign(url);return;}
    setWalletBusy(true);
    try{
      const initData=getTelegramWebApp()?.initData;
      const response=await fetch(url,{cache:"no-store",headers:{
        "X-TicketTreat-Client":"1",
        ...(webSession?{Authorization:"Bearer browser-session"}:{}),
        ...(initData?{"X-Telegram-Init-Data":initData}:{})
      }});
      if(!response.ok)throw new Error("wallet_failed");
      const blob=await response.blob();
      const objectUrl=URL.createObjectURL(new Blob([blob],{type:"application/vnd.apple.pkpass"}));
      const anchor=document.createElement("a");
      anchor.href=objectUrl;anchor.download=`tickettreat-${ticket.id}.pkpass`;
      document.body.appendChild(anchor);anchor.click();anchor.remove();
      window.setTimeout(()=>URL.revokeObjectURL(objectUrl),30000);
    }catch{setMessage("walletError");}
    finally{setWalletBusy(false);}
  }

  return <div className="app-shell">
    <AppHeader/>
    <main className="page narrow-page">
      <Link href="/tickets" className="back-link">← {t(language,"tickets")}</Link>
      {message&&<div className="success-banner" role="status">{translateMessage(message)}</div>}
      {loading?<div className="state-card">{t(language,"loading")}</div>:
       !ticket?<div className="state-card state-error">{t(language,"loadError")}</div>:
       <article className={`ticket-card tt-pass tt-interactive-ticket ${flipped?"is-flipped":""} ${ticket.ticket_status==="cancelled"?"ticket-card-cancelled":""}`}>
         <div className="tt-ticket-front" aria-hidden={flipped} inert={flipped}>
         <div className="ticket-top tt-pass-top">
           <span className="tt-pass-brand">TICKETTREAT</span>
           <span className="tt-pass-category">{tr.pass}</span>
         </div>
         {ticket.event?.image_url&&<div className="tt-pass-photo" style={{backgroundImage:`url("${ticket.event.image_url.replace(/"/g,"%22")}")`}}/>}
         <div className="ticket-main tt-pass-body">
           <p className="eyebrow">TICKETTREAT / #{ticket.code}</p>
           <h1>{ticket.event?.title||"TicketTreat"}</h1>
           <p className="tt-pass-organizer">{tr.organizer} · {ticket.event?.organizer||"TicketTreat"}</p>
           <div className="ticket-facts tt-pass-facts">
             <div><span>{t(language,"startsAt")}</span><strong>{formatDate(ticket.event?.starts_at||null,language)}</strong></div>
             <div><span>{t(language,"location")}</span><strong>{ticket.event?.location||"Czechia"}</strong></div>
             <div><span>{t(language,"price")}</span><strong>{ticket.event?formatPrice(ticket.event,language):`${ticket.payment_amount} ${ticket.currency}`}</strong></div>
           </div>
           <div className="tt-pass-countdown" role="timer" aria-live="off">
             <span>{ticketText.until}</span>
             {!countdown?<strong>—</strong>:countdown.started?<strong>{ticketText.started}</strong>:
              <div className="tt-countdown-values">
                {countdown.days>0&&<span><strong>{countdown.days}</strong><small>{ticketText.days}</small></span>}
                <span><strong>{digits(countdown.hours)}</strong><small>{ticketText.hours}</small></span>
                <span><strong>{digits(countdown.minutes)}</strong><small>{ticketText.minutes}</small></span>
                <span><strong>{digits(countdown.seconds)}</strong><small>{ticketText.seconds}</small></span>
              </div>}
           </div>
           {ticket.ticket_status==="active"&&qr?
             <button type="button" className="button button-primary button-wide" onClick={()=>setFlipped(true)}>{ticketText.back} ↗</button>:
             <div className="tt-pass-revoked" role="status">{tr.invalid}</div>}
           <div className="ticket-status-grid tt-pass-status">
             <span className={`status ${ticket.ticket_status==="active"?"status-success":"status-danger"}`}>{ticket.ticket_status==="active"?(language==="ru"?"ДЕЙСТВИТЕЛЕН":language==="cs"?"PLATNÁ":language==="uk"?"ДІЙСНИЙ":"VALID"):tr.invalid}</span>
             <span className={`status ${ticket.checked_in_at?"status-success":"status-muted"}`}>
               {ticket.checked_in_at?t(language,"checkedIn"):t(language,"notCheckedIn")}
             </span>
           </div>
           {walletEnabled&&ticket.ticket_status==="active"&&
             <button type="button" className="button button-primary button-wide tt-pass-wallet"
               disabled={walletBusy} onClick={()=>void addToWallet()}>
               <span aria-hidden="true"></span> {tr.wallet}
             </button>}
           {ticket.ticket_status==="active"&&!ticket.checked_in_at&&
             <button type="button" className="button button-outline button-wide"
               onClick={()=>void cancel()}>{t(language,"cancelTicket")}</button>}
         </div></div>
         <div className="tt-ticket-back" aria-hidden={!flipped} inert={!flipped}>
           <div className="tt-ticket-back-header"><strong>TICKETTREAT</strong><span>{ticket.code}</span></div>
           <h2>{ticket.event?.title||"TicketTreat"}</h2>
           {ticket.ticket_status==="active"&&qr?
             <div className="tt-pass-qr"><img src={qr} alt="QR code for TicketTreat check-in"/><strong>{ticket.code}</strong><p>{tr.qr}</p></div>:
             <div className="tt-pass-revoked" role="status">{tr.invalid}</div>}
           <p className="tt-ticket-guest"><small>{ticketText.guest}</small><strong>{[ticket.guest?.first_name,ticket.guest?.last_name].filter(Boolean).join(" ")||"—"}</strong></p>
           <div className="tt-ticket-barcode" aria-hidden="true"/><small>{ticket.code}</small>
           <button type="button" className="button button-secondary button-wide" onClick={()=>setFlipped(false)}>{ticketText.front} ↗</button>
         </div>
       </article>}
    </main>
  </div>;
}
