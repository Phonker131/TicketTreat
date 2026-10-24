"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/components/LanguageProvider";
import { isTelegramWebApp, getTelegramWebApp } from "@/lib/telegram";
import { t } from "@/lib/i18n";
import { getManageMe,getBookingConfig } from "@/lib/api";
import { getWebToken } from "@/lib/session";

export function AppHeader() {
  const { language } = useLanguage();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuReady, setMenuReady] = useState(false);
  const menuLabel = language==="ru"?"Меню":language==="cs"?"Menu":language==="uk"?"Меню":"Menu";
  const menuAction = menuOpen
    ? (language==="ru"?"Закрыть меню":language==="cs"?"Zavřít nabídku":language==="uk"?"Закрити меню":"Close menu")
    : (language==="ru"?"Открыть меню":language==="cs"?"Otevřít nabídku":language==="uk"?"Відкрити меню":"Open menu");
  const [insideTelegram, setInsideTelegram] = useState(false);
  const [canOrganize, setCanOrganize] = useState(false);
  const [demoEnabled,setDemoEnabled] = useState(false);
  // Public account is fixed while the Czech pilot uses one official Telegram bot.
  const botUrl = "https://t.me/TicketTreatBot";
  useEffect(()=>{getBookingConfig().then(config=>setDemoEnabled(config.demo_payment_mode)).catch(()=>{});},[]);

  useEffect(() => setInsideTelegram(isTelegramWebApp()), []);
  // Until hydration attaches event handlers, a mobile tap must not appear to
  // succeed while silently doing nothing. Enable the toggle only when ready.
  useEffect(() => setMenuReady(true), []);

  // Close the mobile menu after navigation, including browser back/forward.
  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [menuOpen]);

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

        <nav id="tt-primary-nav" aria-label={language==="ru"?"Основная навигация":language==="cs"?"Hlavní navigace":language==="uk"?"Основна навігація":"Main navigation"} className={`topbar-nav${menuOpen ? " is-open" : ""}`} onClick={(event) => {
          if ((event.target as HTMLElement).closest("a")) setMenuOpen(false);
        }}>
          <Link href="/">{t(language, "home")}</Link>
          <Link href="/tickets">{t(language, "tickets")}</Link>
          <Link href="/loyalty">{language==="ru"?"Награды":language==="cs"?"Odměny":language==="uk"?"Нагороди":"Rewards"}</Link>
          <Link href="/profile">{t(language, "profile")}</Link>
          <Link href="/support">{language==="ru"?"Поддержка":language==="cs"?"Podpora":language==="uk"?"Підтримка":"Support"}</Link>
          {canOrganize && <Link href="/admin">{t(language, "admin")}</Link>}
        </nav>

        <div className="topbar-actions">
          {demoEnabled&&<span className="demo-pill">{t(language, "demo")}</span>}
          {<a className="mode-pill mode-pill-link" href={botUrl} target="_blank" rel="noopener noreferrer"
            aria-label={language==="ru"?"Открыть бота TicketTreat в Telegram":"Open TicketTreat Telegram bot"}
            onClick={e=>{const telegram=getTelegramWebApp();if(insideTelegram && telegram?.openTelegramLink){e.preventDefault();telegram.openTelegramLink(botUrl);}}}>
            Telegram Mini App ↗
          </a>}
          <button type="button" className="topbar-menu-toggle" disabled={!menuReady} aria-controls="tt-primary-nav" aria-expanded={menuOpen} aria-label={menuAction} onClick={() => setMenuOpen(open => !open)}>
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
              {menuOpen ? <path d="M5 5l14 14M19 5L5 19" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
            <span>{menuLabel}</span>
          </button>
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
