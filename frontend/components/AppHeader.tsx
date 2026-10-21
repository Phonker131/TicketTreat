"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/components/LanguageProvider";
import { isTelegramWebApp } from "@/lib/telegram";
import { t } from "@/lib/i18n";
import { getManageMe,getBookingConfig } from "@/lib/api";
import { getWebToken } from "@/lib/session";

export function AppHeader() {
  const { language } = useLanguage();
  const [insideTelegram, setInsideTelegram] = useState(false);
  const [canOrganize, setCanOrganize] = useState(false);
  const [demoEnabled,setDemoEnabled] = useState(false);
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
    window.addEventListener("crowdly-auth-change",refresh);
    return()=>{live=false;window.removeEventListener("crowdly-auth-change",refresh)};
  }, []);

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href="/" className="wordmark" aria-label="TicketTreat">
          <img src="/tickettreat-mark.svg" className="wordmark-icon" width="36" height="36" alt="" aria-hidden="true" />
          <span>TicketTreat</span>
        </Link>

        <nav className="topbar-nav">
          <Link href="/">{t(language, "home")}</Link>
          <Link href="/tickets">{t(language, "tickets")}</Link>
          <Link href="/profile">{t(language, "profile")}</Link>
          {canOrganize && <Link href="/admin">{t(language, "admin")}</Link>}
        </nav>

        <div className="topbar-actions">
          {demoEnabled&&<span className="demo-pill">{t(language, "demo")}</span>}
          <span className="mode-pill">
            {insideTelegram ? t(language, "telegramMode") : t(language, "webMode")}
          </span>
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
