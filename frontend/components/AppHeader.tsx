"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/components/LanguageProvider";
import { isTelegramWebApp, getTelegramWebApp } from "@/lib/telegram";
import { t } from "@/lib/i18n";
import { getManageMe,getBookingConfig } from "@/lib/api";
import { getWebToken } from "@/lib/session";

export function AppHeader() {
  const { language } = useLanguage();
  const [insideTelegram, setInsideTelegram] = useState(false);
  const [canOrganize, setCanOrganize] = useState(false);
  const [demoEnabled,setDemoEnabled] = useState(false);
  const botUsername = (process.env.NEXT_PUBLIC_BOT_USERNAME || "").trim().replace(/^@/, "");
  const botUrl = /^[a-zA-Z0-9_]{5,32}$/.test(botUsername) ? `https://t.me/${botUsername}` : null;
  useEffect(()=>{getBookingConfig().then(config=>setDemoEnabled(config.demo_payment_mode)).catch(()=>{});},[]);

  useEffect(() => setInsideTelegram(isTelegramWebApp()), []);

  useEffect(() => {
    let live=true;
    async function refresh() {
      const token=getWebToken();
      if(!token){if(live)setCanOrganize(false);return;}
      try {
        const me=await getManageMe(token);
        if(live)setCanOrganize(me.role==="organizer"||me.role==="global_admin");
      } catch {if(live)setCanOrganize(false);}
    }
    refresh();
    window.addEventListener("tickettreat-auth-change",refresh);
    return()=>{live=false;window.removeEventListener("tickettreat-auth-change",refresh)};
  }, []);

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href="/" className="wordmark" aria-label="TicketTreat">
          <img src="/tickettreat-wordmark.svg" className="wordmark-logo" width="584" height="120" alt="TicketTreat" />
        </Link>

        <nav className="topbar-nav">
          <Link href="/">{t(language, "home")}</Link>
          <Link href="/tickets">{t(language, "tickets")}</Link>
          <Link href="/profile">{t(language, "profile")}</Link>
          {canOrganize && <Link href="/admin">{t(language, "admin")}</Link>}
        </nav>

        <div className="topbar-actions">
          {demoEnabled&&<span className="demo-pill">{t(language, "demo")}</span>}
          {botUrl && <a className="mode-pill mode-pill-link" href={botUrl} target="_blank" rel="noopener noreferrer"
            aria-label={language==="ru"?"Открыть бота TicketTreat в Telegram":"Open TicketTreat Telegram bot"}
            onClick={e=>{const telegram=getTelegramWebApp();if(insideTelegram && telegram?.openTelegramLink){e.preventDefault();telegram.openTelegramLink(botUrl);}}}>
            Telegram Mini App ↗
          </a>}
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
